/**
 * LSTM-Based Sign Predictor Service
 * 
 * Uses ONNX Runtime Web for sequence-based sign language recognition.
 * Works with 30-frame sequences for both static letters and dynamic gestures.
 * 
 * Features:
 * - Buffers 30 frames before prediction
 * - Supports 159 features (left hand 63 + right hand 63 + pose 33)
 * - Debounce logic to prevent flickering (requires 5+ consistent predictions)
 * - Confidence threshold filtering
 */

import * as ort from 'onnxruntime-web'

// Configuration (loaded from lstm_config.json)
let CONFIG = {
    sequence_length: 30,
    num_features: 159,
    num_classes: 3,
    labels: ['a', 'b', 'c']
}

let LABELS: string[] = []

let session: ort.InferenceSession | null = null
let isLoading = false

// Sequence buffer
let frameBuffer: Float32Array[] = []

// Debounce: require consistent predictions (higher = more stable but slower)
const DEBOUNCE_COUNT = 5
let predictionHistory: string[] = []

// Frame skip for performance (only run inference every N frames)
const FRAME_SKIP = 2
let frameCounter = 0

// Cache last stable prediction - returned on skipped frames to prevent hold timer reset
let lastStablePrediction: { label: string; confidence: number } | null = null

/**
 * Initialize the LSTM ONNX model
 */
export async function initModel(): Promise<boolean> {
    if (session) return true
    if (isLoading) return false

    isLoading = true

    try {
        console.log('🔄 Loading LSTM model...')

        // Configure WASM paths
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/'

        // Load config
        try {
            const configResponse = await fetch('/lstm_config.json')
            CONFIG = await configResponse.json()
            console.log('✅ Config loaded:', CONFIG)
        } catch {
            console.warn('⚠️ lstm_config.json not found, using defaults')
        }

        // Load labels
        try {
            const labelsResponse = await fetch('/lstm_labels.json')
            LABELS = await labelsResponse.json()
            console.log('✅ Labels loaded:', LABELS)
        } catch {
            console.warn('⚠️ lstm_labels.json not found, using config labels')
            LABELS = CONFIG.labels
        }

        // Try LSTM model first, fallback to MLP
        try {
            session = await ort.InferenceSession.create('/lstm_model.onnx', {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            })
            console.log('✅ LSTM model loaded!')
            console.log('   Input:', session.inputNames)
            console.log('   Output:', session.outputNames)
        } catch {
            console.log('⚠️ LSTM model not found, falling back to MLP model')
            session = await ort.InferenceSession.create('/model.onnx', {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all'
            })
            console.log('✅ MLP model loaded (single-frame mode)')
        }

        isLoading = false
        return true

    } catch (error) {
        console.error('❌ Failed to load model:', error)
        isLoading = false
        return false
    }
}

/**
 * Normalize hand landmarks - wrist centered, scale invariant
 * Returns 63 features for a single hand
 */
function normalizeHandLandmarks(landmarks: Array<{ x: number, y: number, z: number }> | null): Float32Array {
    const features = new Float32Array(63)

    if (!landmarks || landmarks.length < 21) {
        // Return zeros if no hand detected
        return features
    }

    const coords = landmarks.map(lm => [lm.x, lm.y, lm.z])
    const base = coords[0] // Wrist

    // Center at wrist
    const centered = coords.map(c => [
        c[0] - base[0],
        c[1] - base[1],
        c[2] - base[2]
    ])

    // Scale by max value
    let maxVal = 0
    centered.forEach(c => c.forEach(v => (maxVal = Math.max(maxVal, Math.abs(v)))))
    const scale = maxVal > 1e-6 ? maxVal : 1

    // Flatten
    let idx = 0
    centered.forEach(c => {
        features[idx++] = c[0] / scale
        features[idx++] = c[1] / scale
        features[idx++] = c[2] / scale
    })

    return features
}

/**
 * Extract pose features - just the key body landmarks
 * Returns 33 features (11 landmarks × 3 coords)
 */
function extractPoseFeatures(poseLandmarks: Array<{ x: number, y: number, z: number }> | null): Float32Array {
    const features = new Float32Array(33)

    if (!poseLandmarks) {
        return features
    }

    // Indices: nose(0), shoulders(11,12), elbows(13,14), wrists(15,16), hips(23,24,25,26)
    const poseIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26]

    let idx = 0
    for (const poseIdx of poseIndices) {
        if (poseIdx < poseLandmarks.length) {
            const lm = poseLandmarks[poseIdx]
            features[idx++] = lm.x
            features[idx++] = lm.y
            features[idx++] = lm.z
        } else {
            idx += 3
        }
    }

    return features
}

/**
 * Combined feature interface for two hands + pose
 */
interface HolisticLandmarks {
    leftHand: Array<{ x: number, y: number, z: number }> | null
    rightHand: Array<{ x: number, y: number, z: number }> | null
    pose: Array<{ x: number, y: number, z: number }> | null
}

/**
 * Extract all 159 features from holistic landmarks
 */
function extractAllFeatures(landmarks: HolisticLandmarks): Float32Array {
    const leftHandFeatures = normalizeHandLandmarks(landmarks.leftHand)
    const rightHandFeatures = normalizeHandLandmarks(landmarks.rightHand)
    const poseFeatures = extractPoseFeatures(landmarks.pose)

    // Concatenate: [left:63] + [right:63] + [pose:33] = 159
    const allFeatures = new Float32Array(CONFIG.num_features)
    allFeatures.set(leftHandFeatures, 0)
    allFeatures.set(rightHandFeatures, 63)
    allFeatures.set(poseFeatures, 126)

    return allFeatures
}

/**
 * Predict sign from holistic landmarks (two hands + pose)
 * 
 * Buffers frames and predicts when buffer is full
 */
export async function predict(
    landmarks: HolisticLandmarks
): Promise<{ label: string; confidence: number } | null> {

    // Frame skip for performance - only run inference every N frames
    frameCounter++
    if (frameCounter % FRAME_SKIP !== 0) {
        // Still add features to buffer for sequence, but skip inference
        const features = extractAllFeatures(landmarks)
        frameBuffer.push(features)
        if (frameBuffer.length > CONFIG.sequence_length) {
            frameBuffer.shift()
        }
        // Return cached prediction to keep hold timer running
        return lastStablePrediction
    }

    if (!session) {
        const loaded = await initModel()
        if (!loaded) return null
    }

    try {
        const features = extractAllFeatures(landmarks)

        // Add to buffer
        frameBuffer.push(features)
        if (frameBuffer.length > CONFIG.sequence_length) {
            frameBuffer.shift()
        }

        // Only predict when buffer is full
        if (frameBuffer.length < CONFIG.sequence_length) {
            return null
        }

        // Build sequence tensor [1, 30, 159]
        const sequenceData = new Float32Array(CONFIG.sequence_length * CONFIG.num_features)
        frameBuffer.forEach((frame, i) => {
            sequenceData.set(frame, i * CONFIG.num_features)
        })

        const inputTensor = new ort.Tensor('float32', sequenceData, [1, CONFIG.sequence_length, CONFIG.num_features])

        // Run inference
        const results = await session!.run({ [session!.inputNames[0]]: inputTensor })

        // Get output
        const output = results[session!.outputNames[0]]
        const data = output.data as Float32Array

        // Find max probability
        let maxIdx = 0
        let maxVal = data[0]
        for (let i = 1; i < data.length; i++) {
            if (data[i] > maxVal) {
                maxVal = data[i]
                maxIdx = i
            }
        }

        const predictedLabel = LABELS[maxIdx] || '?'
        const confidence = maxVal

        // Apply debounce: require consistent predictions
        predictionHistory.push(predictedLabel)
        if (predictionHistory.length > DEBOUNCE_COUNT) {
            predictionHistory.shift()
        }

        // Check if last N predictions are the same
        if (predictionHistory.length >= DEBOUNCE_COUNT) {
            const allSame = predictionHistory.every(p => p === predictedLabel)

            if (allSame && confidence > 0.7) {
                const result = { label: predictedLabel.toUpperCase(), confidence }
                lastStablePrediction = result  // Cache for skipped frames
                return result
            }
        }

        // Not stable yet, return null (no flickering)
        return null

    } catch (error) {
        console.error('Prediction error:', error)
        return null
    }
}

/**
 * Legacy predict function for single-hand input (backwards compatible)
 */
export async function predictSingleHand(
    landmarks: Array<{ x: number, y: number, z: number }>
): Promise<{ label: string; confidence: number } | null> {
    // Convert single hand to holistic format
    return predict({
        leftHand: null,
        rightHand: landmarks,  // Assume it's the right hand (dominant)
        pose: null
    })
}

/**
 * Reset prediction state
 */
export function resetState(): void {
    frameBuffer = []
    predictionHistory = []
    lastStablePrediction = null
}

/**
 * Clear just the prediction cache (used after letter registration)
 */
export function clearPredictionCache(): void {
    lastStablePrediction = null
    predictionHistory = []
}

/**
 * Check if model is ready
 */
export function isModelReady(): boolean {
    return session !== null
}

/**
 * Get current config
 */
export function getConfig() {
    return CONFIG
}
