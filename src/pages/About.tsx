import { Link } from 'react-router-dom'

function About() {
    return (
        <div className="app-container">
            <main style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <div className="card fade-in">
                    <div className="card-header">About SignVision</div>
                    <div className="card-body" style={{ lineHeight: 1.7 }}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <div style={{
                                fontSize: 48,
                                marginBottom: 8,
                                filter: 'drop-shadow(0 0 20px rgba(74, 158, 255, 0.3))'
                            }}>
                                🖐️
                            </div>
                            <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>
                                SignVision
                            </h1>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                v2.0.0 Web Edition
                            </p>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                            SignVision is an AI-powered sign language translator that converts
                            hand signs into readable text in real time. Built using MediaPipe
                            for hand tracking and machine learning for gesture recognition.
                        </p>

                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 16
                        }}>
                            <h3 style={{ fontSize: 14, marginBottom: 8, color: 'var(--accent-primary)' }}>
                                Features
                            </h3>
                            <ul style={{
                                color: 'var(--text-secondary)',
                                paddingLeft: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4
                            }}>
                                <li>Real-time hand sign detection</li>
                                <li>AI-powered sentence generation</li>
                                <li>Text-to-speech output</li>
                                <li>Works offline (PWA)</li>
                            </ul>
                        </div>

                        <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
                            Developed by <strong style={{ color: 'var(--text-secondary)' }}>Soumil Jana</strong>
                            <br />
                            All Rights Reserved © 2026
                        </p>
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

export default About
