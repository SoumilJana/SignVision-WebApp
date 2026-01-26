import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initRecaptcha, cleanupRecaptcha } from '../services/mfaService'

function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [mfaCode, setMfaCode] = useState(['', '', '', '', '', ''])
    const [codeSent, setCodeSent] = useState(false)
    const [sendingCode, setSendingCode] = useState(false)

    const {
        signIn,
        signInWithGoogle,
        signInWithGithub,
        error,
        clearError,
        isBypassed,
        isConfigured,
        mfaPending,
        mfaPhoneHint,
        mfaFactorType,
        sendMFACode,
        completeMFASignIn,
        cancelMFA,
        user
    } = useAuth()
    const navigate = useNavigate()

    // Initialize recaptcha on mount
    useEffect(() => {
        initRecaptcha('recaptcha-container')
        return () => cleanupRecaptcha()
    }, [])

    // Redirect when bypass is active or user is logged in
    useEffect(() => {
        console.log('🔍 Redirect check - user:', user?.email || 'null', 'mfaPending:', mfaPending, 'isBypassed:', isBypassed)
        if (isBypassed) {
            console.log('🔓 Bypass active - skipping login page')
            navigate('/')
            return
        }
        if (user && !mfaPending) {
            console.log('🚀 User logged in, redirecting to home...')
            navigate('/')
        }
    }, [isBypassed, user, mfaPending, navigate])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        console.log('🔐 Login form submitted')
        console.log('📧 Email:', email)
        clearError()
        setIsLoading(true)

        try {
            console.log('⏳ Calling signIn...')
            const result = await signIn(email, password)
            console.log('✅ signIn completed, result:', result ? 'UserCredential' : 'void')

            // Check return value to determine next step
            // signIn returns UserCredential on success, or void if MFA is triggered
            if (result) {
                console.log('🚀 Login successful, navigating to home')
                navigate('/')
            } else {
                console.log('🛡️ MFA challenge triggered - staying on page')
            }
        } catch (err) {
            console.error('❌ Login failed:', err)
        } finally {
            console.log('🏁 Login attempt finished, setting isLoading to false')
            setIsLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        clearError()
        try {
            await signInWithGoogle()
        } catch (err) {
            console.error('Google login failed:', err)
        }
    }

    const handleGithubLogin = async () => {
        clearError()
        try {
            await signInWithGithub()
        } catch (err) {
            console.error('GitHub login failed:', err)
        }
    }

    const handleMFAChange = (index: number, value: string) => {
        if (value.length > 1) return
        if (!/^\d*$/.test(value)) return // Only allow digits

        const newCode = [...mfaCode]
        newCode[index] = value
        setMfaCode(newCode)

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`mfa-${index + 1}`)
            nextInput?.focus()
        }
    }

    const handleMFAKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !mfaCode[index] && index > 0) {
            const prevInput = document.getElementById(`mfa-${index - 1}`)
            prevInput?.focus()
        }
    }

    const handleSendCode = async () => {
        console.log('📤 handleSendCode called')
        clearError()
        setSendingCode(true)
        try {
            console.log('⏳ Requesting MFA code from Firebase...')
            const vid = await sendMFACode()
            console.log('✅ MFA code sent! Verification ID:', vid)
            setCodeSent(true)

            // Focus input
            setTimeout(() => {
                document.getElementById('mfa-0')?.focus()
            }, 100)
        } catch (err) {
            console.error('❌ Failed to send MFA code:', err)
        } finally {
            setSendingCode(false)
        }
    }

    // Auto-send code when entering MFA mode (SMS only)
    useEffect(() => {
        if (mfaPending && mfaFactorType === 'sms' && !codeSent && !sendingCode) {
            console.log('🤖 Auto-sending SMS MFA code...')
            handleSendCode()
        } else if (mfaPending && mfaFactorType === 'totp') {
            // For TOTP, just mark as ready (no code to send)
            console.log('🔐 TOTP MFA - ready for code entry')
            setCodeSent(true)
            setTimeout(() => {
                document.getElementById('mfa-0')?.focus()
            }, 100)
        }
    }, [mfaPending, mfaFactorType, codeSent])

    const handleMFASubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const code = mfaCode.join('')

        if (code.length !== 6) {
            return
        }

        setIsLoading(true)
        try {
            await completeMFASignIn(code)
            // Redirect happens via useEffect
        } catch (err) {
            console.error('MFA verification failed:', err)
            // Reset code on error
            setMfaCode(['', '', '', '', '', ''])
        } finally {
            setIsLoading(false)
        }
    }

    const handleBackToLogin = () => {
        cancelMFA()
        setMfaCode(['', '', '', '', '', ''])
        setCodeSent(false)
    }

    return (
        <div className="auth-container">
            {/* Recaptcha container (invisible) */}
            <div id="recaptcha-container" />

            {/* Background decoration */}
            <div className="auth-bg-gradient" />

            <div className="auth-card">
                {/* Logo */}
                <Link to="/" className="auth-logo">
                    <div className="auth-logo-icon">
                        <img src="/logo.png" alt="SignVision Logo" />
                    </div>
                    <span className="auth-logo-text">SignVision</span>
                </Link>

                {/* Bypass / unconfigured warning */}
                {(isBypassed || !isConfigured) && (
                    <div className="auth-notice">
                        {isBypassed && <span className="notice-badge dev">BYPASS ACTIVE</span>}
                        {!isConfigured && <span className="notice-badge warning">Firebase not configured</span>}
                    </div>
                )}

                {!mfaPending ? (
                    <>
                        <div className="auth-header">
                            <h1 className="auth-title">Welcome back</h1>
                            <p className="auth-subtitle">Sign in to continue to SignVision</p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="auth-error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="auth-form">
                            {/* Social Login */}
                            <div className="social-login-buttons">
                                <button type="button" className="social-btn" onClick={handleGoogleLogin}>
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continue with Google
                                </button>
                                <button type="button" className="social-btn" onClick={handleGithubLogin}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                    </svg>
                                    Continue with GitHub
                                </button>
                            </div>

                            <div className="auth-divider">
                                <span>or continue with email</span>
                            </div>

                            {/* Email Input */}
                            <div className="form-group">
                                <label htmlFor="email" className="form-label">Email address</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                    <input
                                        id="email"
                                        type="email"
                                        className="form-input"
                                        placeholder="Enter your email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="form-group">
                                <div className="form-label-row">
                                    <label htmlFor="password" className="form-label">Password</label>
                                    <Link to="/forgot-password" className="form-link">Forgot password?</Link>
                                </div>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        className="form-input"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="input-action"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me */}
                            <div className="form-checkbox">
                                <input type="checkbox" id="remember" className="checkbox-input" />
                                <label htmlFor="remember" className="checkbox-label">Remember this device</label>
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
                                {isLoading ? (
                                    <div className="btn-loader" />
                                ) : (
                                    'Sign in'
                                )}
                            </button>
                        </form>

                        <p className="auth-footer">
                            Don't have an account? <Link to="/register" className="auth-link">Create one</Link>
                        </p>
                    </>
                ) : (
                    <>
                        {/* MFA Verification */}
                        <div className="auth-header">
                            <div className="mfa-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Two-Factor Authentication</h1>
                            <p className="auth-subtitle">
                                {mfaFactorType === 'totp'
                                    ? 'Enter the 6-digit code from your authenticator app'
                                    : codeSent
                                        ? `Enter the 6-digit code sent to ${mfaPhoneHint || 'your phone'}`
                                        : `Click below to receive a verification code at ${mfaPhoneHint || 'your phone'}`
                                }
                            </p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="auth-error">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                {error}
                            </div>
                        )}

                        {!codeSent ? (
                            <div className="auth-form">
                                <button
                                    type="button"
                                    className="btn btn-primary auth-submit"
                                    onClick={handleSendCode}
                                    disabled={sendingCode}
                                >
                                    {sendingCode ? (
                                        <div className="btn-loader" />
                                    ) : (
                                        <>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                            </svg>
                                            Send Verification Code
                                        </>
                                    )}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleMFASubmit} className="auth-form">
                                <div className="mfa-inputs">
                                    {mfaCode.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`mfa-${index}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="mfa-input"
                                            value={digit}
                                            onChange={(e) => handleMFAChange(index, e.target.value)}
                                            onKeyDown={(e) => handleMFAKeyDown(index, e)}
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary auth-submit"
                                    disabled={isLoading || mfaCode.join('').length !== 6}
                                >
                                    {isLoading ? (
                                        <div className="btn-loader" />
                                    ) : (
                                        'Verify Code'
                                    )}
                                </button>

                                {mfaFactorType === 'sms' && (
                                    <div className="mfa-options">
                                        <button type="button" className="mfa-option-btn" onClick={handleSendCode} disabled={sendingCode}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                            </svg>
                                            Resend code
                                        </button>
                                    </div>
                                )}

                                {mfaFactorType === 'totp' && (
                                    <p className="form-hint" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
                                        Code changes every 30 seconds
                                    </p>
                                )}
                            </form>
                        )}

                        <button
                            type="button"
                            className="auth-back-btn"
                            onClick={handleBackToLogin}
                        >
                            ← Back to login
                        </button>
                    </>
                )}
            </div>

            {/* Footer */}
            <footer className="auth-page-footer">
                <Link to="/about" className="footer-link">About</Link>
                <Link to="/privacy" className="footer-link">Privacy</Link>
                <Link to="/terms" className="footer-link">Terms</Link>
            </footer>
        </div>
    )
}

export default Login

