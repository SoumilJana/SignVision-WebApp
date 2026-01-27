import { useEffect, useRef, useState, useCallback } from 'react'
import { initModel, predict, clearPredictionCache } from '../services/SignPredictor'

// MediaPipe Holistic types
// MediaPipe Holistic types
import { Holistic, type Results } from '@mediapipe/holistic'


interface CameraProps {
    onSignDetected: (sign: string, confidence: number) => void
    onHoldProgress: (progress: number) => void
    onAddLetter: (letter: string) => void
}

function Camera({ onSignDetected, onHoldProgress, onAddLetter }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [currentPrediction, setCurrentPrediction] = useState<string | null>(null)
    const [handsStatus, setHandsStatus] = useState<{ left: boolean, right: boolean }>({ left: false, right: false })
    const [justRegistered, setJustRegistered] = useState<string | null>(null) // Visual feedback

    // Hold detection state
    const holdStartRef = useRef<number | null>(null)
    const lastPredictionRef = useRef<string | null>(null)
    const cooldownRef = useRef<number | null>(null) // Cooldown after registration
    const currentPredictionRef = useRef<string | null>(null) // For optimized state updates
    const lastHandsStatusRef = useRef<{ left: boolean, right: boolean }>({ left: false, right: false })
    const HOLD_DURATION = 1200 // 1.2 seconds to confirm
    const COOLDOWN_DURATION = 800 // 0.8 second cooldown after registration

    // Landmark smoothing with Exponential Moving Average (EMA)
    const SMOOTHING_FACTOR = 0.4 // Balanced smoothness
    const smoothedLeftHandRef = useRef<Array<{ x: number, y: number, z: number }> | null>(null)
    const smoothedRightHandRef = useRef<Array<{ x: number, y: number, z: number }> | null>(null)
    const smoothedPoseRef = useRef<Array<{ x: number, y: number, z: number }> | null>(null)

    // EMA smoothing helper function
    const smoothLandmarks = useCallback((
        newLandmarks: Array<{ x: number, y: number, z: number }> | undefined,
        previousRef: React.MutableRefObject<Array<{ x: number, y: number, z: number }> | null>
    ): Array<{ x: number, y: number, z: number }> | null => {
        if (!newLandmarks || newLandmarks.length === 0) {
            previousRef.current = null
            return null
        }

        if (!previousRef.current || previousRef.current.length !== newLandmarks.length) {
            // First frame or reset - use raw landmarks
            previousRef.current = newLandmarks.map(lm => ({ ...lm }))
            return previousRef.current
        }

        // Apply EMA: smoothed = alpha * new + (1 - alpha) * previous
        const smoothed = newLandmarks.map((lm, i) => {
            const prev = previousRef.current![i]
            return {
                x: SMOOTHING_FACTOR * lm.x + (1 - SMOOTHING_FACTOR) * prev.x,
                y: SMOOTHING_FACTOR * lm.y + (1 - SMOOTHING_FACTOR) * prev.y,
                z: SMOOTHING_FACTOR * lm.z + (1 - SMOOTHING_FACTOR) * prev.z
            }
        })

        previousRef.current = smoothed
        return smoothed
    }, [])

    // Draw hand landmarks on canvas
    const drawHandLandmarks = useCallback((
        ctx: CanvasRenderingContext2D,
        landmarks: Array<{ x: number, y: number, z: number }>,
        width: number,
        height: number,
        color: string
    ) => {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // index
            [0, 9], [9, 10], [10, 11], [11, 12], // middle
            [0, 13], [13, 14], [14, 15], [15, 16], // ring
            [0, 17], [17, 18], [18, 19], [19, 20], // pinky
            [5, 9], [9, 13], [13, 17] // palm
        ]

        ctx.strokeStyle = color
        ctx.lineWidth = 2

        connections.forEach(([start, end]) => {
            const startPoint = landmarks[start]
            const endPoint = landmarks[end]
            if (startPoint && endPoint) {
                ctx.beginPath()
                ctx.moveTo(startPoint.x * width, startPoint.y * height)
                ctx.lineTo(endPoint.x * width, endPoint.y * height)
                ctx.stroke()
            }
        })

        // Draw points
        ctx.fillStyle = '#ffffff'
        landmarks.forEach(point => {
            ctx.beginPath()
            ctx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI)
            ctx.fill()
        })
    }, [])

    // Draw pose landmarks (simplified - just key points)
    const drawPoseLandmarks = useCallback((
        ctx: CanvasRenderingContext2D,
        landmarks: Array<{ x: number, y: number, z: number }>,
        width: number,
        height: number
    ) => {
        // Only draw key pose connections
        const connections = [
            [11, 12], // shoulders
            [11, 13], [13, 15], // left arm
            [12, 14], [14, 16], // right arm
        ]

        ctx.strokeStyle = 'rgba(128, 128, 128, 0.5)'
        ctx.lineWidth = 1

        connections.forEach(([start, end]) => {
            if (start < landmarks.length && end < landmarks.length) {
                const startPoint = landmarks[start]
                const endPoint = landmarks[end]
                ctx.beginPath()
                ctx.moveTo(startPoint.x * width, startPoint.y * height)
                ctx.lineTo(endPoint.x * width, endPoint.y * height)
                ctx.stroke()
            }
        })
    }, [])

    // Process holistic results
    const onResults = useCallback(async (results: Results) => {
        if (!canvasRef.current) return

        const ctx = canvasRef.current.getContext('2d')
        if (!ctx) return

        const { width, height } = canvasRef.current
        ctx.clearRect(0, 0, width, height)

        // Update hands status - optimized to only update state when changed
        const hasLeft = !!results.leftHandLandmarks && results.leftHandLandmarks.length > 0
        const hasRight = !!results.rightHandLandmarks && results.rightHandLandmarks.length > 0
        if (hasLeft !== lastHandsStatusRef.current.left || hasRight !== lastHandsStatusRef.current.right) {
            setHandsStatus({ left: hasLeft, right: hasRight })
            lastHandsStatusRef.current = { left: hasLeft, right: hasRight }
        }

        // Apply EMA smoothing to all landmarks for fluid motion
        const smoothedLeftHand = smoothLandmarks(results.leftHandLandmarks, smoothedLeftHandRef)
        const smoothedRightHand = smoothLandmarks(results.rightHandLandmarks, smoothedRightHandRef)
        const smoothedPose = smoothLandmarks(results.poseLandmarks, smoothedPoseRef)

        // Draw pose if available (using smoothed landmarks)
        if (smoothedPose) {
            drawPoseLandmarks(ctx, smoothedPose, width, height)
        }

        // Draw left hand (blue/pink) - using smoothed landmarks
        if (smoothedLeftHand) {
            drawHandLandmarks(ctx, smoothedLeftHand, width, height, '#ff6b6b')
        }

        // Draw right hand (green) - using smoothed landmarks
        if (smoothedRightHand) {
            drawHandLandmarks(ctx, smoothedRightHand, width, height, '#4ecdc4')
        }

        // Run ONNX model inference if any hand is detected
        if (hasLeft || hasRight) {
            // IMPORTANT: Swap hands to match Python training
            // In mirrored video, MediaPipe's "left" appears on the right side
            // The Python training script swaps them, so we must do the same here
            const prediction = await predict({
                leftHand: results.rightHandLandmarks || null,  // Swapped!
                rightHand: results.leftHandLandmarks || null,  // Swapped!
                pose: results.poseLandmarks || null
            })

            if (prediction && prediction.confidence > 0.5) {
                // Optimized: only update state when prediction changes
                if (prediction.label !== currentPredictionRef.current) {
                    setCurrentPrediction(prediction.label)
                    currentPredictionRef.current = prediction.label
                }
                onSignDetected(prediction.label, prediction.confidence)

                // Check if in cooldown period after last registration
                if (cooldownRef.current !== null) {
                    const cooldownElapsed = Date.now() - cooldownRef.current
                    if (cooldownElapsed < COOLDOWN_DURATION) {
                        // Still in cooldown - don't start new hold
                        onHoldProgress(0)
                        return
                    } else {
                        // Cooldown finished
                        cooldownRef.current = null
                        setJustRegistered(null)
                    }
                }

                // Hold detection logic
                if (lastPredictionRef.current === prediction.label) {
                    if (holdStartRef.current === null) {
                        holdStartRef.current = Date.now()
                    }

                    const holdTime = Date.now() - holdStartRef.current
                    const progress = Math.min((holdTime / HOLD_DURATION) * 100, 100)
                    onHoldProgress(progress)

                    if (holdTime >= HOLD_DURATION) {
                        onAddLetter(prediction.label)
                        // Start cooldown and show visual feedback
                        setJustRegistered(prediction.label)
                        cooldownRef.current = Date.now()
                        holdStartRef.current = null
                        lastPredictionRef.current = null // Clear so same letter needs fresh hold
                        clearPredictionCache() // Clear the model's prediction cache
                        onHoldProgress(0)
                    }
                } else {
                    holdStartRef.current = Date.now()
                    lastPredictionRef.current = prediction.label
                    onHoldProgress(0)
                }
            } else {
                // Optimized: only update state when prediction changes
                if (currentPredictionRef.current !== null) {
                    setCurrentPrediction(null)
                    currentPredictionRef.current = null
                }
                holdStartRef.current = null
                lastPredictionRef.current = null
                onHoldProgress(0)
            }
        } else {
            // Optimized: only update state when prediction changes
            if (currentPredictionRef.current !== null) {
                setCurrentPrediction(null)
                currentPredictionRef.current = null
            }
            holdStartRef.current = null
            lastPredictionRef.current = null
            onHoldProgress(0)
        }
    }, [onSignDetected, onHoldProgress, onAddLetter, drawHandLandmarks, drawPoseLandmarks, smoothLandmarks])

    // Initialize camera and MediaPipe Holistic
    useEffect(() => {
        let holistic: Holistic | null = null
        let animationId: number
        let stream: MediaStream | null = null
        let isMounted = true

        const initCamera = async () => {
            try {
                console.log('📷 Requesting camera access...')

                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                        facingMode: 'user'
                    }
                })

                console.log('✅ Camera stream obtained')

                if (!isMounted || !videoRef.current) {
                    stream.getTracks().forEach(track => track.stop())
                    return
                }

                videoRef.current.srcObject = stream

                // Wait for video to be ready before playing
                await new Promise<void>((resolve, reject) => {
                    if (!videoRef.current) {
                        reject(new Error('Video element not found'))
                        return
                    }

                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play()
                            .then(() => {
                                console.log('✅ Video playing')
                                resolve()
                            })
                            .catch(err => {
                                if (err.name === 'AbortError') {
                                    console.log('ℹ️ Video play interrupted (normal during reload)')
                                    resolve()
                                } else {
                                    reject(err)
                                }
                            })
                    }

                    videoRef.current.onerror = () => {
                        reject(new Error('Video element error'))
                    }
                })

                if (!isMounted) return

                // Initialize ONNX model
                console.log('🔄 Initializing ONNX model...')
                await initModel()

                // Load MediaPipe Holistic from NPM
                console.log('🔄 Initializing MediaPipe Holistic...')

                holistic = new Holistic({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629/${file}`
                    }
                })

                holistic.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                })

                holistic.onResults(onResults)

                // Set canvas size
                if (canvasRef.current && videoRef.current) {
                    canvasRef.current.width = videoRef.current.videoWidth || 640
                    canvasRef.current.height = videoRef.current.videoHeight || 480
                }

                setIsLoading(false)
                console.log('✅ Camera and models initialized!')

                // Process frames with throttling for smoother performance
                let lastProcessTime = 0
                const FRAME_INTERVAL = 33 // ~30fps for MediaPipe (smooth and responsive)

                const processFrame = async (timestamp: number) => {
                    if (!isMounted) return

                    // Throttle MediaPipe processing
                    if (timestamp - lastProcessTime >= FRAME_INTERVAL) {
                        if (videoRef.current && holistic) {
                            try {
                                await holistic.send({ image: videoRef.current })
                            } catch (e) {
                                // Ignore errors during frame processing
                            }
                        }
                        lastProcessTime = timestamp
                    }

                    if (isMounted) {
                        animationId = requestAnimationFrame(processFrame)
                    }
                }

                requestAnimationFrame(processFrame)

            } catch (err: any) {
                console.error('Camera error:', err)
                if (isMounted) {
                    if (err.name === 'NotAllowedError') {
                        setError('Camera access denied. Please allow camera permissions in your browser settings.')
                    } else if (err.name === 'NotFoundError') {
                        setError('No camera found. Please connect a camera and refresh.')
                    } else if (err.name === 'NotReadableError') {
                        setError('Camera is in use by another application. Please close other apps using the camera.')
                    } else {
                        setError(`Camera error: ${err.message || 'Unknown error'}`)
                    }
                    setIsLoading(false)
                }
            }
        }

        initCamera()

        return () => {
            isMounted = false
            if (animationId) cancelAnimationFrame(animationId)
            if (stream) stream.getTracks().forEach(track => track.stop())
            if (holistic) holistic.close()
        }
    }, [onResults])

    if (error) {
        return (
            <div className="camera-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                    <p>{error}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="camera-container">
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--bg-card)',
                    zIndex: 10
                }}>
                    <div className="pulse" style={{ color: 'var(--text-secondary)' }}>
                        Loading camera & models...
                    </div>
                </div>
            )}
            <video
                ref={videoRef}
                className="camera-video"
                playsInline
                muted
            />
            <canvas
                ref={canvasRef}
                className="camera-overlay"
                style={{ transform: 'scaleX(-1)' }}
            />

            {/* Hand detection status */}
            <div style={{
                position: 'absolute',
                top: 16,
                right: 16,
                display: 'flex',
                gap: 8,
                fontSize: 14,
                fontWeight: 500
            }}>
                <span style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: handsStatus.left ? 'rgba(255, 107, 107, 0.8)' : 'rgba(0,0,0,0.5)',
                    color: '#fff'
                }}>
                    L {handsStatus.left ? '✓' : '✗'}
                </span>
                <span style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    background: handsStatus.right ? 'rgba(78, 205, 196, 0.8)' : 'rgba(0,0,0,0.5)',
                    color: '#fff'
                }}>
                    R {handsStatus.right ? '✓' : '✗'}
                </span>
            </div>

            {currentPrediction && (
                <div style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    background: 'rgba(0,0,0,0.7)',
                    padding: '8px 16px',
                    borderRadius: 8,
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    fontSize: 24
                }}>
                    {currentPrediction}
                </div>
            )}

            {/* Visual feedback when letter is registered */}
            {justRegistered && (
                <div style={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(46, 204, 113, 0.9)',
                    padding: '12px 24px',
                    borderRadius: 12,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 20,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    ✓ {justRegistered} added!
                </div>
            )}
        </div>
    )
}

export default Camera
