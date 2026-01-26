"""
GRU Model Training for Sequence-Based Sign Language Recognition

Uses collected sequence data to train a GRU model that recognizes:
- Static signs (letters held still)
- Dynamic gestures (movements)

NOTE: Uses GRU instead of LSTM for better ONNX Runtime Web compatibility.

Input:  training/data/sequences/<label>/*.npy
Output: training/models/sign_model.pt
        training/config/labels.json
        training/config/model_config.json

Usage:
    cd WebApp
    python training/scripts/train_model.py
"""

import os
import json
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

# ============================================================
# CONFIGURATION
# ============================================================
SEQUENCE_LENGTH = 30          # Must match collect_data.py
EPOCHS = 100
BATCH_SIZE = 32
TEST_SPLIT = 0.2              # 80% train, 20% test
LEARNING_RATE = 0.001
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Paths (absolute, based on script location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(TRAINING_DIR, "data", "sequences")
MODELS_DIR = os.path.join(TRAINING_DIR, "models")
CONFIG_DIR = os.path.join(TRAINING_DIR, "config")


# ============================================================
# DATA LOADING
# ============================================================
def load_data():
    """Load all sequence data with auto-detected feature size."""
    sequences = []
    labels = []
    num_features = None
    
    print(f"📂 Loading from: {DATA_DIR}\n")
    
    if not os.path.exists(DATA_DIR):
        print(f"❌ Data directory not found: {DATA_DIR}")
        print("   Run collect_data.py first!")
        return None, None, None
    
    for label in sorted(os.listdir(DATA_DIR)):
        label_dir = os.path.join(DATA_DIR, label)
        if not os.path.isdir(label_dir):
            continue
        
        npy_files = [f for f in os.listdir(label_dir) if f.endswith('.npy')]
        print(f"  {label}: {len(npy_files)} samples")
        
        for filename in npy_files:
            filepath = os.path.join(label_dir, filename)
            sequence = np.load(filepath)
            
            # Auto-detect feature size from first file
            if num_features is None and len(sequence.shape) == 2:
                num_features = sequence.shape[1]
                print(f"\n  📐 Detected: {num_features} features per frame")
                print(f"     Sequence shape: ({SEQUENCE_LENGTH}, {num_features})\n")
            
            if len(sequence.shape) == 2 and sequence.shape[0] == SEQUENCE_LENGTH:
                sequences.append(sequence)
                labels.append(label)
            else:
                print(f"    ⚠️ Skipping {filename} - shape: {sequence.shape}")
    
    if len(sequences) == 0:
        return None, None, None
    
    return np.array(sequences), np.array(labels), num_features


# ============================================================
# MODEL - Using GRU for better ONNX compatibility
# ============================================================
class SignModel(nn.Module):
    """
    GRU-based model for sequence classification.
    Uses GRU instead of LSTM for better ONNX Runtime Web compatibility.
    
    Architecture:
    - 2 GRU layers (64 → 64)
    - Dense layers for classification
    """
    def __init__(self, num_features, num_classes):
        super(SignModel, self).__init__()
        
        # Use simpler architecture for better ONNX compatibility
        self.gru = nn.GRU(
            input_size=num_features,
            hidden_size=64,
            num_layers=2,
            batch_first=True,
            dropout=0.2
        )
        
        self.fc1 = nn.Linear(64, 32)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(0.3)
        self.fc2 = nn.Linear(32, num_classes)
    
    def forward(self, x):
        # GRU: output shape is [batch, seq, hidden]
        out, _ = self.gru(x)
        # Take last timestep
        out = out[:, -1, :]
        # Classification
        out = self.fc1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        return out


# ============================================================
# TRAINING
# ============================================================
def train_epoch(model, dataloader, criterion, optimizer):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    for X_batch, y_batch in dataloader:
        X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
        
        optimizer.zero_grad()
        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = torch.max(outputs.data, 1)
        total += y_batch.size(0)
        correct += (predicted == y_batch).sum().item()
    
    return total_loss / len(dataloader), correct / total


def evaluate(model, dataloader, criterion):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        for X_batch, y_batch in dataloader:
            X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
            
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            
            total_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total += y_batch.size(0)
            correct += (predicted == y_batch).sum().item()
            
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(y_batch.cpu().numpy())
    
    return total_loss / len(dataloader), correct / total, all_preds, all_labels


# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "=" * 60)
    print("  SIGN MODEL TRAINING (PyTorch GRU)")
    print("  Sequence-Based Sign Language Recognition")
    print("=" * 60 + "\n")
    print(f"🖥️ Device: {DEVICE}")
    
    # Create output directories
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CONFIG_DIR, exist_ok=True)
    
    # Load data
    X, y_labels, num_features = load_data()
    
    if X is None:
        print("\n❌ No data found!")
        return
    
    unique_classes = np.unique(y_labels)
    print(f"\n📊 Dataset Summary:")
    print(f"   Total samples: {len(X)}")
    print(f"   Classes: {len(unique_classes)}")
    print(f"   Features: {num_features} per frame × {SEQUENCE_LENGTH} frames")
    
    # Encode labels
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(y_labels)
    classes = list(label_encoder.classes_)
    
    # Save configuration
    config = {
        'sequence_length': SEQUENCE_LENGTH,
        'num_features': int(num_features),
        'num_classes': len(classes),
        'labels': classes
    }
    
    config_path = os.path.join(CONFIG_DIR, 'model_config.json')
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"\n💾 Config: {config_path}")
    
    labels_path = os.path.join(CONFIG_DIR, 'labels.json')
    with open(labels_path, 'w') as f:
        json.dump(classes, f)
    print(f"💾 Labels: {labels_path}")
    
    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SPLIT, random_state=42, stratify=y
    )
    print(f"\n📈 Split: {len(X_train)} train / {len(X_test)} test ({int(TEST_SPLIT*100)}%)")
    
    # Convert to PyTorch tensors
    X_train_t = torch.FloatTensor(X_train)
    y_train_t = torch.LongTensor(y_train)
    X_test_t = torch.FloatTensor(X_test)
    y_test_t = torch.LongTensor(y_test)
    
    train_dataset = TensorDataset(X_train_t, y_train_t)
    test_dataset = TensorDataset(X_test_t, y_test_t)
    
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    # Create model
    model = SignModel(num_features, len(classes)).to(DEVICE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)
    
    print(f"\n🏗️ Model: {sum(p.numel() for p in model.parameters())} parameters")
    
    # Train
    print("\n" + "=" * 60)
    print("  TRAINING")
    print("=" * 60 + "\n")
    
    best_val_acc = 0
    patience = 20
    patience_counter = 0
    
    for epoch in range(EPOCHS):
        train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer)
        val_loss, val_acc, _, _ = evaluate(model, test_loader, criterion)
        
        scheduler.step(val_loss)
        
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch {epoch+1:3d}/{EPOCHS}: "
                  f"Train Loss={train_loss:.4f}, Acc={train_acc*100:.1f}% | "
                  f"Val Loss={val_loss:.4f}, Acc={val_acc*100:.1f}%")
        
        # Save best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            torch.save(model.state_dict(), os.path.join(MODELS_DIR, 'sign_model_best.pt'))
        else:
            patience_counter += 1
        
        # Early stopping
        if patience_counter >= patience:
            print(f"\n⏹️ Early stopping at epoch {epoch+1}")
            break
    
    # Load best model for evaluation
    model.load_state_dict(torch.load(os.path.join(MODELS_DIR, 'sign_model_best.pt'), weights_only=True))
    
    # Evaluate
    print("\n" + "=" * 60)
    print("  RESULTS")
    print("=" * 60)
    
    test_loss, test_acc, all_preds, all_labels = evaluate(model, test_loader, criterion)
    print(f"\n✅ Test Accuracy: {test_acc * 100:.2f}%")
    print(f"   Test Loss: {test_loss:.4f}")
    
    # Classification report
    print("\n📋 Classification Report:")
    print(classification_report(all_labels, all_preds, target_names=classes))
    
    # Save final model
    model_path = os.path.join(MODELS_DIR, 'sign_model.pt')
    torch.save(model.state_dict(), model_path)
    print(f"\n💾 Model saved: {model_path}")
    
    print("\n" + "=" * 60)
    print("  🎉 TRAINING COMPLETE!")
    print("=" * 60)
    print(f"\n  Next step: python training/scripts/convert_to_onnx.py")
    print(f"  Models saved to: {MODELS_DIR}/")


if __name__ == "__main__":
    main()
