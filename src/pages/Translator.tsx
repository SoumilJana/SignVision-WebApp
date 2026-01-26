import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Camera from '../components/Camera'

// Settings type
interface AppSettings {
    darkMode: boolean
    aiSentenceMode: boolean
    autoCorrect: boolean
}

// Load settings from localStorage
const loadSettings = (): AppSettings => {
    const saved = localStorage.getItem('signvision-settings')
    if (saved) {
        return JSON.parse(saved)
    }
    return {
        darkMode: true,
        aiSentenceMode: false,
        autoCorrect: true
    }
}

// Save settings to localStorage
const saveSettings = (settings: AppSettings) => {
    localStorage.setItem('signvision-settings', JSON.stringify(settings))
}

function Translator() {
    const [sentence, setSentence] = useState('')
    const [currentSign, setCurrentSign] = useState<string | null>(null)
    const [holdProgress, setHoldProgress] = useState(0)
    const [settings, setSettings] = useState<AppSettings>(loadSettings)

    // Save settings when they change
    useEffect(() => {
        saveSettings(settings)
    }, [settings])

    // Apply theme to body
    useEffect(() => {
        if (settings.darkMode) {
            document.body.classList.remove('light-mode')
        } else {
            document.body.classList.add('light-mode')
        }
    }, [settings.darkMode])

    // Handle detected sign from camera
    const handleSignDetected = useCallback((sign: string, confidence: number) => {
        if (confidence > 0.7) {
            setCurrentSign(sign)
        }
    }, [])

    // Add letter to sentence
    const handleAddLetter = useCallback((letter: string) => {
        setSentence(prev => prev + letter)
    }, [])

    // Delete last character
    const handleDelete = useCallback(() => {
        setSentence(prev => prev.slice(0, -1))
    }, [])

    // Clear all
    const handleClear = useCallback(() => {
        setSentence('')
        setCurrentSign(null)
    }, [])

    // Speak sentence using Web Speech API
    const handleSpeak = useCallback(() => {
        if (!sentence) return

        const utterance = new SpeechSynthesisUtterance(sentence)
        utterance.lang = 'en-US'
        utterance.rate = 0.9
        speechSynthesis.speak(utterance)
    }, [sentence])

    // Toggle setting
    const toggleSetting = (key: keyof AppSettings) => {
        setSettings(prev => ({
            ...prev,
            [key]: !prev[key]
        }))
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <Link to="/" className="logo">
                    <div className="logo-icon">
                        <img src="/logo.png" alt="SignVision Logo" />
                    </div>
                    <span className="logo-text">SignVision</span>
                </Link>
                <nav className="nav-tabs">
                    <Link to="/" className="nav-tab">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Home
                    </Link>
                    <Link to="/translator" className="nav-tab active">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
                        </svg>
                        Translator
                    </Link>
                    <Link to="/signs" className="nav-tab">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        Signs
                    </Link>
                    <Link to="/clone" className="nav-tab">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Clone
                    </Link>
                </nav>
            </header>

            <main className="translator-content">
                {/* Left Column - Camera and Text */}
                <div className="translator-left">
                    <div className="card translator-camera-card">
                        <div className="card-header">Live Translation</div>
                        <div className="translator-camera-wrapper">
                            <Camera
                                onSignDetected={handleSignDetected}
                                onHoldProgress={setHoldProgress}
                                onAddLetter={handleAddLetter}
                            />
                        </div>
                    </div>

                    <div className="card translator-text-card">
                        <div className="card-header">Translated Text</div>
                        <div className="translator-text-display">
                            {sentence ? (
                                <span>{sentence}<span className="text-cursor"></span></span>
                            ) : (
                                <span className="text-placeholder">Hold a sign to begin</span>
                            )}
                        </div>
                        {holdProgress > 0 && (
                            <div className="translator-progress">
                                <div className="progress-bar">
                                    <div
                                        className={`progress-bar-fill ${holdProgress > 75 ? 'almost-done' : ''}`}
                                        style={{ width: `${holdProgress}%` }}
                                    />
                                </div>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginTop: 6,
                                    fontSize: 12,
                                    color: holdProgress > 75 ? 'var(--accent-primary)' : 'var(--text-secondary)'
                                }}>
                                    <span>{holdProgress > 75 ? '⏳ Almost there!' : '🤚 Hold steady...'}</span>
                                    <span style={{ fontWeight: 600 }}>{Math.round(holdProgress)}%</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Signs, Controls, Settings */}
                <div className="translator-right">
                    {/* Hand Signs Card */}
                    <div className="card">
                        <div className="card-header">Hand Signs</div>
                        <div className="hand-signs-display">
                            {currentSign ? (
                                <span className="detected-letter">{currentSign.toUpperCase()}</span>
                            ) : (
                                <svg className="hand-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
                                    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
                                    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
                                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                                </svg>
                            )}
                        </div>
                    </div>

                    {/* Controls Card */}
                    <div className="card">
                        <div className="card-header">Controls</div>
                        <div className="controls-buttons">
                            <button
                                className="control-btn"
                                onClick={handleSpeak}
                                disabled={!sentence}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                </svg>
                                Speak
                            </button>
                            <button
                                className="control-btn"
                                onClick={handleDelete}
                                disabled={!sentence}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                                    <line x1="18" y1="9" x2="12" y2="15" />
                                    <line x1="12" y1="9" x2="18" y2="15" />
                                </svg>
                                Delete
                            </button>
                            <button
                                className="control-btn"
                                onClick={handleClear}
                                disabled={!sentence}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Settings Card */}
                    <div className="card">
                        <div className="card-header">Settings</div>
                        <div className="settings-list">
                            <div className="setting-item">
                                <span className="setting-label">Dark Mode</span>
                                <button
                                    className={`toggle-switch ${settings.darkMode ? 'active' : ''}`}
                                    onClick={() => toggleSetting('darkMode')}
                                />
                            </div>
                            <div className="setting-item">
                                <span className="setting-label">AI Sentence Mode</span>
                                <button
                                    className={`toggle-switch ${settings.aiSentenceMode ? 'active' : ''}`}
                                    onClick={() => toggleSetting('aiSentenceMode')}
                                />
                            </div>
                            <div className="setting-item">
                                <span className="setting-label">Auto Correct</span>
                                <button
                                    className={`toggle-switch ${settings.autoCorrect ? 'active' : ''}`}
                                    onClick={() => toggleSetting('autoCorrect')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <div className="footer-links">
                    <Link to="/about" className="footer-link">About SignVision</Link>
                    <Link to="/settings" className="footer-link">Settings</Link>
                </div>
                <span className="version">v2.0.0</span>
            </footer>
        </div>
    )
}

export default Translator
