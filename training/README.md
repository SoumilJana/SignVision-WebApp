# LSTM Training Pipeline

Train sequence-based LSTM models for sign language recognition with:
- **Two-hand detection** (left + right with zero-padding)
- **Body pose** (hand-body relationship)
- **Static + Dynamic** recognition

## Folder Structure

```
WebApp/
├── training/                 # This folder
│   ├── scripts/              # Python scripts
│   │   ├── collect_data.py   # Record training sequences
│   │   ├── train_model.py    # Train LSTM model
│   │   └── convert_to_onnx.py # Convert for web deployment
│   │
│   ├── data/
│   │   └── sequences/        # Collected training data
│   │       ├── a/            # Letter 'A' samples
│   │       │   ├── 0.npy     # Each: (30, 159) array
│   │       │   └── ...
│   │       ├── hello/        # Gesture samples
│   │       └── ...
│   │
│   ├── models/               # Trained models
│   │   ├── lstm_model.keras  # TensorFlow/Keras model
│   │   ├── lstm_model.tflite # Mobile version
│   │   └── lstm_model.onnx   # Web version
│   │
│   └── config/               # Configuration files
│       ├── labels.json       # Class labels
│       └── model_config.json # Model parameters
│
└── public/                   # ONNX model deployed here
    ├── lstm_model.onnx
    └── lstm_labels.json
```

## Workflow

### 1. Collect Data
```bash
cd WebApp/training/scripts
python collect_data.py
```

Controls:
- `a-z` → Set letter label
- `0` → Enter gesture name (e.g., "hello")
- `SPACE` → Record 30 frames
- `d` → Toggle debug lines (nose-to-wrist)
- `s` → Statistics
- `q` → Quit

**Collect 50-100 samples per class for good accuracy.**

### 2. Train Model
```bash
python train_model.py
```

Output:
- `../models/lstm_model.keras`
- `../config/labels.json`

### 3. Convert for Web
```bash
pip install tf2onnx  # First time only
py -3.10 training/scripts/convert_to_onnx.py
```

This automatically copies to `../../public/` (WebApp's public folder).

## Features Per Frame

| Component | Features | Description |
|-----------|----------|-------------|
| Left Hand | 63 | 21 landmarks × 3 coords (or zeros if not visible) |
| Right Hand | 63 | 21 landmarks × 3 coords (or zeros if not visible) |
| Body Pose | 33 | 11 key landmarks × 3 coords |
| **Total** | **159** | Fixed size regardless of hand visibility |

## Model Architecture

```
Input: (batch, 30, 159)
        ↓
LSTM(128) + Dropout(0.2)
        ↓
LSTM(128) + Dropout(0.2)
        ↓
LSTM(64) + Dropout(0.2)
        ↓
Dense(64) + Dropout(0.3)
        ↓
Dense(32)
        ↓
Dense(num_classes, softmax)
```
