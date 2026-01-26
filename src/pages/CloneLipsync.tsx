import { Link } from 'react-router-dom'

function CloneLipsync() {
    return (
        <div className="app-container">
            <main style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
                <div className="card fade-in">
                    <div className="card-header">Clone Lipsync</div>
                    <div className="card-body" style={{ textAlign: 'center', padding: 48 }}>
                        <div style={{
                            fontSize: 64,
                            marginBottom: 16,
                            opacity: 0.5
                        }}>
                            👄
                        </div>
                        <h2 style={{
                            fontSize: 20,
                            fontWeight: 500,
                            marginBottom: 8,
                            color: 'var(--text-primary)'
                        }}>
                            Coming Soon
                        </h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            Generate lip-synced avatar videos from text or speech.
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

export default CloneLipsync
