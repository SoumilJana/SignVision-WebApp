"""
Sequence Data Collector with Hand and Pose Detection

Uses MediaPipe Tasks API (0.10.30+) to detect:
- Pose (body landmarks including nose, shoulders)
- Left hand (21 landmarks)
- Right hand (21 landmarks)

Features:
- Both hands detected simultaneously (via Pose wrist positions + Hand landmarker)
- Zero-padding if a hand is not visible
- Fixed output size: 159 features (63 per hand + 33 pose)

Data stored in: ../data/sequences/<label>/<sample>.npy

Usage:
    cd training/scripts
    python collect_data.py

Controls:
    [a-z]   Set label for static letters
    [0]     Enter custom gesture name
    [SPACE] Start recording (30 frames)
    [s]     Show statistics
    [d]     Toggle debug lines (nose-to-wrist)
    [q]     Quit
"""

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import os
import time
import urllib.request

# ============================================================
# CONFIGURATION
# ============================================================
SEQUENCE_LENGTH = 30          # Frames per sequence (~2 seconds at 15 FPS)
FPS_TARGET = 15               # Recording frame rate

# Paths (absolute, based on script location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(TRAINING_DIR, "data", "sequences")
MODELS_DIR = os.path.join(TRAINING_DIR, "models")

# Feature configuration
HAND_FEATURES = 63            # 21 landmarks × 3 coords per hand
USE_POSE = True               # Include body landmarks
POSE_LANDMARKS_COUNT = 11     # nose, shoulders, elbows, wrists, hips
POSE_FEATURES = POSE_LANDMARKS_COUNT * 3 if USE_POSE else 0
TOTAL_FEATURES = HAND_FEATURES * 2 + POSE_FEATURES  # 159 with pose

# Model URLs
HAND_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
POSE_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"

# ============================================================
# DOWNLOAD MODELS
# ============================================================
def download_model(url, filename):
    """Download model if not exists."""
    filepath = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(filepath):
        os.makedirs(MODELS_DIR, exist_ok=True)
        print(f"📥 Downloading {filename}...")
        urllib.request.urlretrieve(url, filepath)
        print(f"✅ Downloaded: {filepath}")
    return filepath


# ============================================================
# MEDIAPIPE SETUP
# ============================================================
def create_hand_landmarker(model_path):
    """Create hand landmarker with VIDEO mode."""
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    return vision.HandLandmarker.create_from_options(options)


def create_pose_landmarker(model_path):
    """Create pose landmarker with VIDEO mode."""
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=vision.RunningMode.VIDEO,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5
    )
    return vision.PoseLandmarker.create_from_options(options)


# Pose landmark indices we use: nose, shoulders, elbows, wrists, hips
POSE_INDICES = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26]


# ============================================================
# FEATURE EXTRACTION
# ============================================================
def normalize_hand_landmarks(landmarks):
    """Normalize hand landmarks - wrist centered, scale invariant."""
    if landmarks is None:
        return np.zeros(HAND_FEATURES)
    
    coords = np.array([[lm.x, lm.y, lm.z] for lm in landmarks])
    base = coords[0]  # Wrist
    coords -= base
    max_val = np.max(np.abs(coords))
    if max_val > 1e-6:
        coords /= max_val
    return coords.flatten()


def extract_pose_subset(pose_landmarks):
    """Extract pose landmarks relevant for gestures."""
    if pose_landmarks is None:
        return np.zeros(POSE_FEATURES)
    
    features = []
    for idx in POSE_INDICES[:POSE_LANDMARKS_COUNT]:
        if idx < len(pose_landmarks):
            lm = pose_landmarks[idx]
            features.extend([lm.x, lm.y, lm.z])
        else:
            features.extend([0.0, 0.0, 0.0])
    
    return np.array(features)


def extract_all_features(hand_result, pose_result):
    """Extract features from both hands and pose. Always fixed size."""
    left_hand = None
    right_hand = None
    
    # Process hand results
    if hand_result and hand_result.hand_landmarks:
        for i, handedness in enumerate(hand_result.handedness):
            label = handedness[0].category_name
            landmarks = hand_result.hand_landmarks[i]
            if label == "Left":
                # Note: In mirrored video, "Left" appears on right side
                right_hand = landmarks
            else:
                left_hand = landmarks
    
    left_features = normalize_hand_landmarks(left_hand)
    right_features = normalize_hand_landmarks(right_hand)
    features = np.concatenate([left_features, right_features])
    
    if USE_POSE:
        pose_landmarks = None
        if pose_result and pose_result.pose_landmarks:
            pose_landmarks = pose_result.pose_landmarks[0]
        pose = extract_pose_subset(pose_landmarks)
        features = np.concatenate([features, pose])
    
    return features.astype(np.float32)


# ============================================================
# VISUALIZATION
# ============================================================
def draw_hand_landmarks(frame, hand_result):
    """Draw hand landmarks on frame."""
    if not hand_result or not hand_result.hand_landmarks:
        return
    
    h, w = frame.shape[:2]
    connections = [
        (0, 1), (1, 2), (2, 3), (3, 4),  # Thumb
        (0, 5), (5, 6), (6, 7), (7, 8),  # Index
        (0, 9), (9, 10), (10, 11), (11, 12),  # Middle
        (0, 13), (13, 14), (14, 15), (15, 16),  # Ring
        (0, 17), (17, 18), (18, 19), (19, 20),  # Pinky
        (5, 9), (9, 13), (13, 17)  # Palm
    ]
    
    for i, landmarks in enumerate(hand_result.hand_landmarks):
        handedness = hand_result.handedness[i][0].category_name
        # Blue for left (appears on right in mirror), Green for right
        color = (255, 100, 100) if handedness == "Right" else (100, 255, 100)
        
        points = [(int(lm.x * w), int(lm.y * h)) for lm in landmarks]
        
        # Draw connections
        for start, end in connections:
            cv2.line(frame, points[start], points[end], color, 2)
        
        # Draw points
        for pt in points:
            cv2.circle(frame, pt, 4, color, -1)


def draw_pose_landmarks(frame, pose_result):
    """Draw pose landmarks on frame."""
    if not pose_result or not pose_result.pose_landmarks:
        return
    
    h, w = frame.shape[:2]
    landmarks = pose_result.pose_landmarks[0]
    
    # Draw only key pose connections
    connections = [
        (11, 12),  # Shoulders
        (11, 13), (13, 15),  # Left arm
        (12, 14), (14, 16),  # Right arm
        (11, 23), (12, 24),  # Torso
        (23, 24)  # Hips
    ]
    
    for start, end in connections:
        if start < len(landmarks) and end < len(landmarks):
            pt1 = (int(landmarks[start].x * w), int(landmarks[start].y * h))
            pt2 = (int(landmarks[end].x * w), int(landmarks[end].y * h))
            cv2.line(frame, pt1, pt2, (200, 200, 200), 1)
    
    # Draw key points
    for idx in POSE_INDICES:
        if idx < len(landmarks):
            lm = landmarks[idx]
            pt = (int(lm.x * w), int(lm.y * h))
            cv2.circle(frame, pt, 3, (128, 128, 128), -1)


def draw_debug_lines(frame, pose_result):
    """Draw nose-to-wrist connections for debugging."""
    if not pose_result or not pose_result.pose_landmarks:
        return
    
    h, w = frame.shape[:2]
    landmarks = pose_result.pose_landmarks[0]
    
    if len(landmarks) < 17:
        return
    
    nose = landmarks[0]
    nose_px = (int(nose.x * w), int(nose.y * h))
    
    left_wrist = landmarks[15]
    left_wrist_px = (int(left_wrist.x * w), int(left_wrist.y * h))
    
    right_wrist = landmarks[16]
    right_wrist_px = (int(right_wrist.x * w), int(right_wrist.y * h))
    
    # Draw lines: Nose to wrists
    cv2.line(frame, nose_px, left_wrist_px, (255, 0, 255), 2)   # Magenta
    cv2.line(frame, nose_px, right_wrist_px, (0, 255, 255), 2)  # Yellow
    
    cv2.circle(frame, nose_px, 8, (0, 0, 255), -1)
    cv2.putText(frame, "L", left_wrist_px, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)
    cv2.putText(frame, "R", right_wrist_px, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)


# ============================================================
# FILE MANAGEMENT
# ============================================================
def get_next_sample_number(label_dir):
    """Get next available sample number."""
    if not os.path.exists(label_dir):
        os.makedirs(label_dir)
        return 0
    existing = [f for f in os.listdir(label_dir) if f.endswith('.npy')]
    if not existing:
        return 0
    return max(int(f.replace('.npy', '')) for f in existing) + 1


def get_data_stats():
    """Get statistics about collected data."""
    stats = {}
    if not os.path.exists(DATA_DIR):
        return stats
    
    for label in os.listdir(DATA_DIR):
        label_dir = os.path.join(DATA_DIR, label)
        if os.path.isdir(label_dir):
            count = len([f for f in os.listdir(label_dir) if f.endswith('.npy')])
            stats[label] = count
    return stats


# ============================================================
# MAIN
# ============================================================
def main():
    print("\n" + "=" * 60)
    print("  SEQUENCE DATA COLLECTOR")
    print("  Hand + Pose Detection (MediaPipe Tasks API)")
    print("=" * 60)
    print(f"""
📁 Data saved to: {os.path.abspath(DATA_DIR)}
📐 Features per frame: {TOTAL_FEATURES}
   - Left hand:  {HAND_FEATURES} features
   - Right hand: {HAND_FEATURES} features
   - Body pose:  {POSE_FEATURES} features

Controls:
  [a-z]   Set label (letters)
  [0]     Enter gesture name
  [SPACE] Start recording ({SEQUENCE_LENGTH} frames)
  [d]     Toggle debug lines
  [s]     Show statistics
  [q]     Quit
    """)
    
    # Download models if needed
    hand_model_path = download_model(HAND_MODEL_URL, "hand_landmarker.task")
    pose_model_path = download_model(POSE_MODEL_URL, "pose_landmarker.task")
    
    # Create landmarkers
    print("🔄 Loading models...")
    hand_landmarker = create_hand_landmarker(hand_model_path)
    pose_landmarker = create_pose_landmarker(pose_model_path)
    print("✅ Models loaded!")
    
    # Load existing stats
    samples_collected = get_data_stats()
    if samples_collected:
        print("📊 Existing data:")
        for label, count in sorted(samples_collected.items()):
            print(f"   {label}: {count} samples")
        print()
    
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    if not cap.isOpened():
        print("Error: Could not open camera")
        return
    
    current_label = None
    is_recording = False
    current_sequence = []
    frame_delay = 1.0 / FPS_TARGET
    last_frame_time = 0
    show_debug_lines = True
    frame_timestamp = 0
    
    print("📷 Camera ready!")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            continue
        
        frame = cv2.flip(frame, 1)
        h, w = frame.shape[:2]
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        # Increment timestamp (needs to be monotonically increasing for VIDEO mode)
        frame_timestamp += 33  # ~30fps in milliseconds
        
        # Run detection
        hand_result = hand_landmarker.detect_for_video(mp_image, frame_timestamp)
        pose_result = pose_landmarker.detect_for_video(mp_image, frame_timestamp)
        
        # Draw landmarks
        draw_pose_landmarks(frame, pose_result)
        draw_hand_landmarks(frame, hand_result)
        
        # Debug lines
        if show_debug_lines:
            draw_debug_lines(frame, pose_result)
        
        # UI Overlay
        cv2.rectangle(frame, (0, 0), (450, 180), (0, 0, 0), -1)
        
        label_text = current_label.upper() if current_label else "Not Set"
        cv2.putText(frame, f"Label: {label_text}", (15, 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Hand detection status
        left_ok = False
        right_ok = False
        if hand_result and hand_result.handedness:
            for h in hand_result.handedness:
                if h[0].category_name == "Right":
                    left_ok = True  # Mirrored
                else:
                    right_ok = True
        
        left_sym = "Y" if left_ok else "X"
        right_sym = "Y" if right_ok else "X"
        cv2.putText(frame, f"L:{left_sym}  R:{right_sym}", (15, 70),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
        
        if is_recording:
            cv2.putText(frame, f"REC: {len(current_sequence)}/{SEQUENCE_LENGTH}", (15, 105),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 100, 255), 2)
            cv2.circle(frame, (430, 35), 12, (0, 0, 255), -1)
            progress = len(current_sequence) / SEQUENCE_LENGTH
            cv2.rectangle(frame, (15, 155), (435, 170), (60, 60, 60), -1)
            cv2.rectangle(frame, (15, 155), (15 + int(420 * progress), 170), (0, 255, 0), -1)
        else:
            status = "SPACE to record" if current_label else "Set label first"
            color = (0, 255, 0) if current_label else (0, 165, 255)
            cv2.putText(frame, status, (15, 105), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        count = samples_collected.get(current_label, 0) if current_label else 0
        cv2.putText(frame, f"Samples: {count}", (15, 140),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        debug_text = "[D]ebug: ON" if show_debug_lines else "[D]ebug: OFF"
        cv2.putText(frame, debug_text, (w - 140, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
        
        cv2.imshow("Sequence Data Collector", frame)
        
        # Recording logic
        if is_recording:
            current_time = time.time()
            if current_time - last_frame_time >= frame_delay:
                features = extract_all_features(hand_result, pose_result)
                current_sequence.append(features)
                last_frame_time = current_time
                
                if len(current_sequence) >= SEQUENCE_LENGTH:
                    label_dir = os.path.join(DATA_DIR, current_label)
                    sample_num = get_next_sample_number(label_dir)
                    
                    sequence_array = np.array(current_sequence)
                    filepath = os.path.join(label_dir, f"{sample_num}.npy")
                    np.save(filepath, sequence_array)
                    
                    samples_collected[current_label] = samples_collected.get(current_label, 0) + 1
                    print(f"✅ Saved: {current_label}/{sample_num}.npy ({sequence_array.shape})")
                    
                    is_recording = False
                    current_sequence = []
        
        # Key handling
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord('q'):
            break
        elif key == ord(' '):
            if current_label:
                if not is_recording:
                    is_recording = True
                    current_sequence = []
                    last_frame_time = time.time()
                    print(f"🔴 Recording '{current_label}'...")
                else:
                    is_recording = False
                    current_sequence = []
                    print("⏹️ Cancelled")
        elif key == ord('d'):
            show_debug_lines = not show_debug_lines
        elif key == ord('s'):
            print("\n📊 Statistics:")
            total = 0
            for label, count in sorted(samples_collected.items()):
                print(f"   {label}: {count} samples")
                total += count
            print(f"   Total: {total}\n")
        elif key == ord('0'):
            print("Enter gesture name: ", end='', flush=True)
            gesture = input().strip().lower().replace(' ', '_')
            if gesture:
                current_label = gesture
                print(f"📝 Label: '{current_label}'")
        elif 97 <= key <= 122:
            current_label = chr(key)
            is_recording = False
            current_sequence = []
            print(f"📝 Label: '{current_label}'")
    
    cap.release()
    cv2.destroyAllWindows()
    hand_landmarker.close()
    pose_landmarker.close()
    
    print("\n" + "=" * 60)
    print(f"  Data saved to: {os.path.abspath(DATA_DIR)}")
    print("  Next: python train_model.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
