import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface AppSettings {
    aiSentenceGenerator: boolean
    autoCorrect: boolean
    textToSpeech: boolean
}

const defaultSettings: AppSettings = {
    aiSentenceGenerator: true,
    autoCorrect: true,
    textToSpeech: true
}

function Settings() {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings)

    // Load settings on mount
    useEffect(() => {
        const saved = localStorage.getItem('signvision-settings')
        if (saved) {
            setSettings(JSON.parse(saved))
        }
    }, [])

    // Save settings
    const updateSetting = (key: keyof AppSettings) => {
        const newSettings = { ...settings, [key]: !settings[key] }
        setSettings(newSettings)
        localStorage.setItem('signvision-settings', JSON.stringify(newSettings))
    }

    return (
        <div className="app-container">
            <main style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <div className="card fade-in">
                    <div className="card-header">Settings</div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                            {/* AI Sentence Generator Toggle */}
                            <div className="toggle-container">
                                <span className="toggle-label">AI Sentence Generator (Gemini)</span>
                                <div
                                    className={`toggle-switch ${settings.aiSentenceGenerator ? 'active' : ''}`}
                                    onClick={() => updateSetting('aiSentenceGenerator')}
                                />
                            </div>

                            {/* Auto-correct Toggle */}
                            <div className="toggle-container">
                                <span className="toggle-label">Auto-correct</span>
                                <div
                                    className={`toggle-switch ${settings.autoCorrect ? 'active' : ''}`}
                                    onClick={() => updateSetting('autoCorrect')}
                                />
                            </div>

                            {/* Text-to-Speech Toggle */}
                            <div className="toggle-container">
                                <span className="toggle-label">Text-to-Speech</span>
                                <div
                                    className={`toggle-switch ${settings.textToSpeech ? 'active' : ''}`}
                                    onClick={() => updateSetting('textToSpeech')}
                                />
                            </div>

                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                    <Link to="/" className="btn" style={{ maxWidth: 200, margin: '0 auto' }}>
                        ← Back to Home
                    </Link>
                </div>
            </main>

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

export default Settings
