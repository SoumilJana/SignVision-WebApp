import { Link } from 'react-router-dom'

function Home() {
    return (
        <div className="home-container">
            {/* Header */}
            <header className="app-header">
                <Link to="/" className="logo">
                    <div className="logo-icon">
                        <img src="/logo.png" alt="SignVision Logo" />
                    </div>
                    <span className="logo-text">SignVision</span>
                </Link>
                <nav className="nav-tabs">
                    <Link to="/" className="nav-tab active">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                            <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        Home
                    </Link>
                    <Link to="/translator" className="nav-tab">
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

            {/* Hero Section */}
            <main className="home-main">
                <section className="hero-section">
                    <div className="hero-icon">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
                            <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
                            <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
                            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                        </svg>
                    </div>
                    <h1 className="hero-title">Welcome to SignVision</h1>
                    <p className="hero-subtitle">
                        Breaking down communication barriers with real-time sign language
                        translation powered by AI
                    </p>
                </section>

                {/* Feature Cards */}
                <section className="features-section">
                    <Link to="/translator" className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
                            </svg>
                        </div>
                        <h3 className="feature-title">Live Translation</h3>
                        <p className="feature-description">
                            Real-time sign language recognition and translation using advanced AI technology.
                        </p>
                    </Link>

                    <Link to="/signs" className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            </svg>
                        </div>
                        <h3 className="feature-title">Learn Signs</h3>
                        <p className="feature-description">
                            Browse and learn from our comprehensive library of sign language gestures.
                        </p>
                    </Link>

                    <Link to="/clone" className="feature-card">
                        <div className="feature-icon">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                        </div>
                        <h3 className="feature-title">Voice Clone</h3>
                        <p className="feature-description">
                            Create personalized voice output to make translations sound natural and authentic.
                        </p>
                    </Link>
                </section>

                {/* Getting Started Section */}
                <section className="getting-started-section">
                    <h2 className="getting-started-title">Getting Started</h2>
                    <div className="getting-started-steps">
                        <div className="step">
                            <span className="step-number">1</span>
                            <p className="step-text">
                                Navigate to the <Link to="/translator" className="step-link">Translator</Link> tab to start translating sign language in real-time
                            </p>
                        </div>
                        <div className="step">
                            <span className="step-number">2</span>
                            <p className="step-text">
                                Explore the <Link to="/signs" className="step-link">Signs</Link> library to learn individual gestures and their meanings
                            </p>
                        </div>
                        <div className="step">
                            <span className="step-number">3</span>
                            <p className="step-text">
                                Use <Link to="/clone" className="step-link">Clone</Link> to create a personalized voice for natural-sounding translations
                            </p>
                        </div>
                    </div>
                </section>
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

export default Home
