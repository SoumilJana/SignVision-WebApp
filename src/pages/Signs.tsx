import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'

function Signs() {
    const [searchQuery, setSearchQuery] = useState('')
    const [filter, setFilter] = useState('all')

    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

    const gestures = [
        { name: 'Hello', description: 'Greeting gesture' },
        { name: 'Thank You', description: 'Gratitude expression' },
        { name: 'Please', description: 'Polite request' },
        { name: 'Sorry', description: 'Apology gesture' },
        { name: 'Yes', description: 'Affirmative response' },
        { name: 'No', description: 'Negative response' },
        { name: 'Help', description: 'Request assistance' },
        { name: 'Stop', description: 'Halt signal' },
    ]

    // Filter signs based on search
    const filteredAlphabet = alphabet.filter(letter =>
        letter.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const filteredGestures = gestures.filter(gesture =>
        gesture.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gesture.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const [selectedSign, setSelectedSign] = useState<any>(null); // State for modal

    const openModal = (item: any) => {
        setSelectedSign(item);
    };

    const closeModal = () => {
        setSelectedSign(null);
    };

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
                    <Link to="/" className="nav-tab">
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
                    <Link to="/signs" className="nav-tab active">
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

            {/* Main Content */}
            <main className="signs-main">
                {/* Page Title */}
                <div className="signs-header">
                    <h1 className="signs-title">Sign Language Library</h1>
                    <p className="signs-subtitle">Browse and learn sign language gestures</p>
                </div>

                {/* Search and Filter */}
                <div className="signs-toolbar">
                    <div className="search-container">
                        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search signs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="filter-dropdown">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">All</option>
                            <option value="letters">Letters</option>
                            <option value="gestures">Gestures</option>
                        </select>
                    </div>
                </div>

                {/* Signs Section */}
                {(filter === 'all' || filter === 'letters') && filteredAlphabet.length > 0 && (
                    <section className="signs-section">
                        <h2 className="section-title">Signs</h2>
                        <div className="signs-alphabet-grid">
                            {filteredAlphabet.map(letter => (
                                <div
                                    key={letter}
                                    className="sign-card"
                                    onClick={() => openModal({ type: 'letter', value: letter, title: `Letter ${letter}` })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <span className="sign-letter">{letter}</span>
                                    <span className="sign-label">Letter {letter}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Gestures Section */}
                {(filter === 'all' || filter === 'gestures') && filteredGestures.length > 0 && (
                    <section className="gestures-section">
                        <h2 className="section-title">Gestures</h2>
                        <div className="gestures-grid">
                            {filteredGestures.map(gesture => (
                                <div
                                    key={gesture.name}
                                    className="gesture-card"
                                    onClick={() => openModal({ type: 'gesture', ...gesture, title: gesture.name })}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <h3 className="gesture-name">{gesture.name}</h3>
                                    <p className="gesture-description">{gesture.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Learning Tips Section */}
                <section className="learning-tips-section">
                    <h2 className="learning-tips-title">Learning Tips</h2>
                    <ul className="learning-tips-list">
                        <li className="tip-item">
                            <span className="tip-bullet">•</span>
                            <span>Click on any sign to see a detailed demonstration</span>
                        </li>
                        <li className="tip-item">
                            <span className="tip-bullet">•</span>
                            <span>Practice each sign slowly to build muscle memory</span>
                        </li>
                        <li className="tip-item">
                            <span className="tip-bullet">•</span>
                            <span>Use the translator to test your understanding</span>
                        </li>
                    </ul>
                </section>
            </main>

            {/* Modal */}
            <Modal
                isOpen={!!selectedSign}
                onClose={closeModal}
                title={selectedSign?.title}
            >
                <div className="sign-modal-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div className="placeholder-media" style={{
                        width: '100%',
                        height: '300px',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: 'var(--border-radius)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        border: '1px dashed var(--border-color)'
                    }}>
                        {/* Placeholder Content */}
                        <div style={{ textAlign: 'center' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '12px', opacity: 0.5 }}>
                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                                <line x1="7" y1="2" x2="7" y2="22"></line>
                                <line x1="17" y1="2" x2="17" y2="22"></line>
                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                <line x1="2" y1="7" x2="7" y2="7"></line>
                                <line x1="2" y1="17" x2="7" y2="17"></line>
                                <line x1="17" y1="17" x2="22" y2="17"></line>
                                <line x1="17" y1="7" x2="22" y2="7"></line>
                            </svg>
                            <p>Image/Video Placeholder for {selectedSign?.title}</p>
                        </div>
                    </div>
                    {selectedSign?.description && (
                        <p className="modal-description" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            {selectedSign.description}
                        </p>
                    )}
                </div>
            </Modal>

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

export default Signs
