interface SentenceDisplayProps {
    sentence: string
    placeholder: string
}

function SentenceDisplay({ sentence, placeholder }: SentenceDisplayProps) {
    return (
        <div className="text-output">
            {sentence ? (
                <>
                    <span>{sentence}</span>
                    <span className="text-cursor" />
                </>
            ) : (
                <span className="text-output-placeholder">{placeholder}</span>
            )}
        </div>
    )
}

export default SentenceDisplay
