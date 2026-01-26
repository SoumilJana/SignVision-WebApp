"""
Convert PyTorch Sign Model to ONNX for Web Deployment

Converts the trained PyTorch model to ONNX format for use in the web app.

Input:  training/models/sign_model.pt
Output: training/models/sign_model.onnx
        Copies to: public/lstm_model.onnx (for backwards compatibility)
                   public/lstm_labels.json
                   public/lstm_config.json

Usage:
    cd WebApp
    py -3.10 training/scripts/convert_to_onnx.py
    
NOTE: Use Python 3.10 for ONNX export (Python 3.14 has compatibility issues)
"""

import os
import json
import shutil
import torch
import torch.nn as nn

# ============================================================
# CONFIGURATION
# ============================================================
# Paths (absolute, based on script location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.dirname(SCRIPT_DIR)
WEBAPP_DIR = os.path.dirname(TRAINING_DIR)
MODELS_DIR = os.path.join(TRAINING_DIR, "models")
CONFIG_DIR = os.path.join(TRAINING_DIR, "config")
WEBAPP_PUBLIC = os.path.join(WEBAPP_DIR, "public")


# ============================================================
# MODEL (must match train_model.py)
# ============================================================
class SignModel(nn.Module):
    """GRU-based model - must match architecture in train_model.py"""
    def __init__(self, num_features, num_classes):
        super(SignModel, self).__init__()
        
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
        out, _ = self.gru(x)
        out = out[:, -1, :]
        out = self.fc1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        return out


def main():
    print("\n" + "=" * 60)
    print("  ONNX CONVERSION (PyTorch → ONNX)")
    print("  For Web App Deployment")
    print("=" * 60 + "\n")
    
    # Load config
    config_path = os.path.join(CONFIG_DIR, 'model_config.json')
    if not os.path.exists(config_path):
        print(f"❌ Config not found: {config_path}")
        print("   Run train_model.py first!")
        return
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    print(f"📋 Model config:")
    print(f"   Sequence length: {config['sequence_length']}")
    print(f"   Features: {config['num_features']}")
    print(f"   Classes: {config['num_classes']}")
    print(f"   Labels: {config['labels']}")
    
    # Load model
    model_path = os.path.join(MODELS_DIR, 'sign_model.pt')
    if not os.path.exists(model_path):
        print(f"\n❌ Model not found: {model_path}")
        print("   Run train_model.py first!")
        return
    
    print(f"\n🔄 Loading model: {model_path}")
    
    # Create model and load weights
    model = SignModel(config['num_features'], config['num_classes'])
    model.load_state_dict(torch.load(model_path, map_location='cpu', weights_only=True))
    model.eval()
    
    # Convert to ONNX
    print("🔄 Converting to ONNX...")
    
    # Create dummy input with correct shape [batch, sequence, features]
    dummy_input = torch.randn(1, config['sequence_length'], config['num_features'])
    print(f"   Input shape: {list(dummy_input.shape)}")
    
    onnx_path = os.path.join(MODELS_DIR, 'sign_model.onnx')
    
    # Export to ONNX with opset 11 for broad compatibility
    with torch.no_grad():
        torch.onnx.export(
            model,
            dummy_input,
            onnx_path,
            export_params=True,
            opset_version=11,  # Good compatibility with ONNX Runtime Web
            do_constant_folding=True,
            input_names=['input'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size'},
                'output': {0: 'batch_size'}
            }
        )
    
    print(f"✅ ONNX saved: {onnx_path}")
    
    # Check if external data was created and embed it
    data_path = onnx_path + '.data'
    if os.path.exists(data_path):
        print("🔄 Embedding external data into single file...")
        try:
            import onnx
            loaded_model = onnx.load(onnx_path, load_external_data=True)
            embedded_path = os.path.join(MODELS_DIR, 'sign_model_embedded.onnx')
            onnx.save_model(loaded_model, embedded_path, save_as_external_data=False)
            os.remove(onnx_path)
            os.remove(data_path)
            shutil.move(embedded_path, onnx_path)
            print("✅ Embedded into single file")
        except Exception as e:
            print(f"⚠️ Could not embed data: {e}")
    
    # Copy to WebApp public folder
    os.makedirs(WEBAPP_PUBLIC, exist_ok=True)
    
    # Copy ONNX model (using lstm_model.onnx for backwards compatibility)
    webapp_onnx = os.path.join(WEBAPP_PUBLIC, 'lstm_model.onnx')
    shutil.copy(onnx_path, webapp_onnx)
    print(f"\n📦 Copied to: {webapp_onnx}")
    
    # Copy labels
    labels_src = os.path.join(CONFIG_DIR, 'labels.json')
    labels_dst = os.path.join(WEBAPP_PUBLIC, 'lstm_labels.json')
    shutil.copy(labels_src, labels_dst)
    print(f"📦 Copied: lstm_labels.json")
    
    # Copy config
    config_dst = os.path.join(WEBAPP_PUBLIC, 'lstm_config.json')
    shutil.copy(config_path, config_dst)
    print(f"📦 Copied: lstm_config.json")
    
    # Verify the exported model
    try:
        import onnx
        model = onnx.load(webapp_onnx)
        onnx.checker.check_model(model)
        print("\n✅ ONNX model validated!")
        
        # Print input/output info
        for inp in model.graph.input:
            dims = [d.dim_value if d.dim_value else d.dim_param for d in inp.type.tensor_type.shape.dim]
            print(f"   Input '{inp.name}': {dims}")
        for out in model.graph.output:
            dims = [d.dim_value if d.dim_value else d.dim_param for d in out.type.tensor_type.shape.dim]
            print(f"   Output '{out.name}': {dims}")
    except Exception as e:
        print(f"⚠️ Validation skipped: {e}")
    
    print("\n" + "=" * 60)
    print("  🎉 CONVERSION COMPLETE!")
    print("=" * 60)
    print(f"\n  WebApp files updated in: {WEBAPP_PUBLIC}/")
    print("  Restart your dev server to use the new model!")
    print("\n  Files created:")
    print("    - lstm_model.onnx")
    print("    - lstm_labels.json")
    print("    - lstm_config.json")


if __name__ == "__main__":
    main()
