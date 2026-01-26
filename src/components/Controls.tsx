interface ControlsProps {
    onSpeak: () => void
    onDelete: () => void
    onClear: () => void
    canSpeak: boolean
}

function Controls({ onSpeak, onDelete, onClear, canSpeak }: ControlsProps) {
    return (
        <div className="controls-section">
            <button
                className={`btn ${canSpeak ? 'btn-primary' : ''}`}
                onClick={onSpeak}
                disabled={!canSpeak}
                style={{ opacity: canSpeak ? 1 : 0.5 }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                Speak Sentence
            </button>

            <button className="btn" onClick={onDelete}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
                Delete Letter
            </button>

            <button className="btn" onClick={onClear}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear All
            </button>
        </div>
    )
}

export default Controls
