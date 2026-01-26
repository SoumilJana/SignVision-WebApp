import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    initRecaptcha,
    cleanupRecaptcha,
    startPhoneMFAEnrollment,
    completePhoneMFAEnrollment,
    startTOTPEnrollment,
    completeTOTPEnrollment
} from '../services/mfaService'
import { type User } from 'firebase/auth'
import { BYPASS_MFA } from '../config/devConfig'

function MFASetup() {
    const [step, setStep] = useState<'choose' | 'sms' | 'authenticator' | 'authenticator-verify' | 'verifying' | 'success'>('choose')
    const [phoneNumber, setPhoneNumber] = useState('')
    const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', ''])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [totpSecret, setTotpSecret] = useState('')
    const [totpQRCode, setTotpQRCode] = useState('')

    const { user, hasMFAEnabled, logOut } = useAuth()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await logOut()
        navigate('/login')
    }

    // Initialize recaptcha on mount
    useEffect(() => {
        initRecaptcha('recaptcha-container-setup')
        return () => cleanupRecaptcha()
    }, [])

    // Check if user already has MFA enabled
    useEffect(() => {
        if (hasMFAEnabled) {
            setStep('success')
        }
    }, [hasMFAEnabled])

    const handleCodeChange = (index: number, value: string, idPrefix: string = 'setup-mfa') => {
        if (value.length > 1) return
        if (!/^\d*$/.test(value)) return // Only allow digits

        const newCode = [...verificationCode]
        newCode[index] = value
        setVerificationCode(newCode)

        // Auto-focus next input
        if (value && index < 5) {
            const nextInput = document.getElementById(`${idPrefix}-${index + 1}`)
            nextInput?.focus()
        }
    }

    const handleCodeKeyDown = (index: number, e: React.KeyboardEvent, idPrefix: string = 'setup-mfa') => {
        if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
            const prevInput = document.getElementById(`${idPrefix}-${index - 1}`)
            prevInput?.focus()
        }
    }

    const handleSendCode = async () => {
        if (!user || !phoneNumber) {
            setError('Please enter a valid phone number')
            return
        }

        // Validate phone number format (basic)
        const phoneRegex = /^\+[1-9]\d{6,14}$/
        if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
            setError('Please enter a valid phone number with country code (e.g., +91 98765 43210)')
            return
        }

        setError(null)
        setIsLoading(true)

        try {
            if (BYPASS_MFA) {
                // Simulate sending code in bypass mode
                setStep('verifying')
            } else {
                await startPhoneMFAEnrollment(user as User, phoneNumber.replace(/\s/g, ''))
                setStep('verifying')
            }
        } catch (err: unknown) {
            console.error('Failed to send verification code:', err)
            const firebaseError = err as { code?: string; message?: string }
            const errorCode = firebaseError?.code
            const errorMessage = firebaseError?.message
            console.error('Error code:', errorCode)
            console.error('Error message:', errorMessage)

            if (errorCode === 'auth/invalid-phone-number') {
                setError('Invalid phone number format. Use format: +91 98765 43210')
            } else if (errorCode === 'auth/too-many-requests') {
                setError('Too many attempts. Please try again later.')
            } else if (errorCode === 'auth/operation-not-allowed') {
                setError('Phone authentication is not enabled. Please enable it in Firebase Console.')
            } else if (errorCode === 'auth/billing-not-enabled') {
                setError('SMS limit reached (Spark Plan). Please add this number to "Phone numbers for testing" in Firebase Console to bypass billing.')
            } else if (errorCode === 'auth/requires-recent-login') {
                setError('Please log out and log in again to set up MFA.')
            } else if (errorCode === 'auth/unverified-email') {
                setError('Please verify your email before setting up MFA.')
            } else if (errorMessage) {
                setError(`Error: ${errorMessage}`)
            } else {
                setError('Failed to send verification code. Check browser console for details.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyCode = async () => {
        const code = verificationCode.join('')
        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code')
            return
        }

        if (!user) {
            setError('You must be logged in to set up MFA')
            return
        }

        setError(null)
        setIsLoading(true)

        try {
            if (BYPASS_MFA) {
                // Simulate verification in bypass mode
                await logOut()
                navigate('/login')
            } else {
                await completePhoneMFAEnrollment(user as User, code, 'Phone')
                await logOut()
                navigate('/login')
            }
        } catch (err: unknown) {
            console.error('Verification failed:', err)
            const errorCode = (err as { code?: string })?.code
            if (errorCode === 'auth/invalid-verification-code') {
                setError('Invalid verification code. Please try again.')
            } else if (errorCode === 'auth/code-expired') {
                setError('Code expired. Please request a new one.')
                setStep('sms')
            } else {
                setError('Verification failed. Please try again.')
            }
            // Reset code on error
            setVerificationCode(['', '', '', '', '', ''])
        } finally {
            setIsLoading(false)
        }
    }

    const handleResendCode = async () => {
        setVerificationCode(['', '', '', '', '', ''])
        await handleSendCode()
    }

    const handleStartAuthenticator = async () => {
        if (!user) {
            setError('You must be logged in to set up MFA')
            return
        }

        setError(null)
        setIsLoading(true)

        try {
            if (BYPASS_MFA) {
                // Simulate TOTP setup in bypass mode
                setTotpSecret('JBSWY3DPEHPK3PXP')
                setTotpQRCode('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
                setStep('authenticator')
            } else {
                const { secret, qrCodeUrl } = await startTOTPEnrollment(user as User)
                setTotpSecret(secret)
                setTotpQRCode(qrCodeUrl)
                setStep('authenticator')
            }
        } catch (err: unknown) {
            console.error('Failed to start authenticator setup:', err)
            const firebaseError = err as { code?: string; message?: string }
            const errorMessage = firebaseError?.message
            if (errorMessage) {
                setError(`Error: ${errorMessage}`)
            } else {
                setError('Failed to setup authenticator. Check browser console for details.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyAuthenticator = async () => {
        const code = verificationCode.join('')
        if (code.length !== 6) {
            setError('Please enter the complete 6-digit code')
            return
        }

        if (!user) {
            setError('You must be logged in to set up MFA')
            return
        }

        setError(null)
        setIsLoading(true)

        try {
            if (BYPASS_MFA) {
                // Simulate verification in bypass mode
                await logOut()
                navigate('/login')
            } else {
                await completeTOTPEnrollment(user as User, code, 'Authenticator App')
                await logOut()
                navigate('/login')
            }
        } catch (err: unknown) {
            console.error('Verification failed:', err)
            const errorCode = (err as { code?: string })?.code
            if (errorCode === 'auth/invalid-verification-code') {
                setError('Invalid verification code. Please try again.')
            } else {
                setError('Verification failed. Please try again.')
            }
            // Reset code on error
            setVerificationCode(['', '', '', '', '', ''])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="auth-container">
            {/* Recaptcha container (invisible) */}
            <div id="recaptcha-container-setup" />

            <div className="auth-bg-gradient" />

            <div className="auth-card auth-card-wide">
                <Link to="/" className="auth-logo">
                    <div className="auth-logo-icon">
                        <img src="/logo.png" alt="SignVision Logo" />
                    </div>
                    <span className="auth-logo-text">SignVision</span>
                </Link>

                {/* Bypass notice */}
                {BYPASS_MFA && (
                    <div className="auth-notice">
                        <span className="notice-badge dev">MFA BYPASS ACTIVE</span>
                    </div>
                )}

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

                {step === 'choose' && (
                    <>
                        <div className="auth-header">
                            <div className="mfa-setup-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Secure Your Account</h1>
                            <p className="auth-subtitle">Set up two-factor authentication to protect your account</p>
                        </div>

                        <div className="mfa-options-grid">
                            <button className="mfa-option-card" onClick={handleStartAuthenticator}>
                                <div className="mfa-option-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                        <line x1="12" y1="18" x2="12.01" y2="18" />
                                    </svg>
                                </div>
                                <div className="mfa-option-content">
                                    <h3>Authenticator App</h3>
                                    <p>Use Google Authenticator or similar apps</p>
                                </div>
                                <div className="mfa-option-badge recommended">Recommended</div>
                            </button>

                            <button className="mfa-option-card" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                <div className="mfa-option-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                </div>
                                <div className="mfa-option-content">
                                    <h3>SMS Text Message</h3>
                                    <p>Receive verification codes via SMS to your phone</p>
                                </div>
                                <div className="mfa-option-badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Coming Soon</div>
                            </button>

                            <button className="mfa-option-card" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                                <div className="mfa-option-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                </div>
                                <div className="mfa-option-content">
                                    <h3>Email Verification</h3>
                                    <p>Receive verification codes via email</p>
                                </div>
                                <div className="mfa-option-badge" style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>Coming Soon</div>
                            </button>
                        </div>

                        <div className="mfa-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '24px' }}>
                            <button type="button" className="auth-back-btn" onClick={handleLogout}>
                                🔓 Log out and sign in again
                            </button>
                            <Link to="/settings" className="auth-back-btn" style={{ opacity: 0.7 }}>
                                ← Back to settings
                            </Link>
                        </div>
                    </>
                )}

                {step === 'sms' && (
                    <>
                        <div className="auth-header">
                            <h1 className="auth-title">Set up SMS Verification</h1>
                            <p className="auth-subtitle">Enter your phone number to receive verification codes</p>
                        </div>

                        <div className="auth-form">
                            <div className="form-group">
                                <label htmlFor="phone" className="form-label">Phone number (with country code)</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    <input
                                        id="phone"
                                        type="tel"
                                        className="form-input"
                                        placeholder="+91 98765 43210"
                                        value={phoneNumber}
                                        onChange={(e) => setPhoneNumber(e.target.value)}
                                    />
                                </div>
                                <p className="form-hint" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Include country code (e.g., +91 for India, +1 for USA)
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary auth-submit"
                                onClick={handleSendCode}
                                disabled={isLoading || !phoneNumber}
                            >
                                {isLoading ? (
                                    <div className="btn-loader" />
                                ) : (
                                    'Send Verification Code'
                                )}
                            </button>

                            <div className="sms-notice">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="16" x2="12" y2="12" />
                                    <line x1="12" y1="8" x2="12.01" y2="8" />
                                </svg>
                                <span>Standard messaging rates may apply</span>
                            </div>

                            <button type="button" className="auth-back-btn" onClick={() => setStep('choose')}>
                                ← Back to options
                            </button>
                        </div>
                    </>
                )}
                {step === 'authenticator' && (
                    <>
                        <div className="auth-header">
                            <div className="mfa-setup-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                    <line x1="12" y1="18" x2="12.01" y2="18" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Set up Authenticator App</h1>
                            <p className="auth-subtitle">Scan the QR code with your authenticator app</p>
                        </div>

                        <div className="auth-form">
                            <div className="form-group" style={{ textAlign: 'center' }}>
                                <div style={{ background: 'white', padding: '20px', borderRadius: '12px', display: 'inline-block', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                    <img src={totpQRCode} alt="QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
                                </div>
                                <p className="form-hint" style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    Use Google Authenticator, Authy, or any TOTP app
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Or enter this code manually:</label>
                                <div className="input-wrapper">
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={totpSecret}
                                        readOnly
                                        style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '2px', textAlign: 'center' }}
                                        onClick={(e) => { e.currentTarget.select(); navigator.clipboard.writeText(totpSecret) }}
                                    />
                                </div>
                                <p className="form-hint" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    Click to copy • Keep this secret safe
                                </p>
                            </div>

                            <button type="button" className="btn btn-primary auth-submit" onClick={() => { setVerificationCode(['', '', '', '', '', '']); setStep('authenticator-verify') }}>
                                Continue to Verify
                            </button>

                            <button type="button" className="auth-back-btn" onClick={() => setStep('choose')}>
                                ← Back to options
                            </button>
                        </div>
                    </>
                )}

                {step === 'authenticator-verify' && (
                    <>
                        <div className="auth-header">
                            <div className="verify-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                    <line x1="12" y1="18" x2="12.01" y2="18" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Verify Authenticator</h1>
                            <p className="auth-subtitle">Enter the 6-digit code from your authenticator app</p>
                        </div>

                        <div className="auth-form">
                            <div className="form-group">
                                <div className="mfa-inputs">
                                    {verificationCode.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`setup-auth-${index}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="mfa-input"
                                            value={digit}
                                            onChange={(e) => handleCodeChange(index, e.target.value, 'setup-auth')}
                                            onKeyDown={(e) => handleCodeKeyDown(index, e, 'setup-auth')}
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button type="button" className="btn btn-primary auth-submit" onClick={handleVerifyAuthenticator} disabled={isLoading || verificationCode.join('').length !== 6}>
                                {isLoading ? <div className="btn-loader" /> : 'Verify & Enable'}
                            </button>

                            <p className="form-hint" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
                                The code changes every 30 seconds
                            </p>

                            <button type="button" className="auth-back-btn" onClick={() => setStep('authenticator')}>
                                ← Back to QR code
                            </button>
                        </div>
                    </>
                )}



                {step === 'verifying' && (
                    <>
                        <div className="auth-header">
                            <div className="verify-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Verify Your Phone</h1>
                            <p className="auth-subtitle">
                                Enter the 6-digit code sent to {phoneNumber}
                            </p>
                        </div>

                        <div className="auth-form">
                            <div className="form-group">
                                <div className="mfa-inputs">
                                    {verificationCode.map((digit, index) => (
                                        <input
                                            key={index}
                                            id={`setup-mfa-${index}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="mfa-input"
                                            value={digit}
                                            onChange={(e) => handleCodeChange(index, e.target.value)}
                                            onKeyDown={(e) => handleCodeKeyDown(index, e)}
                                            autoFocus={index === 0}
                                        />
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary auth-submit"
                                onClick={handleVerifyCode}
                                disabled={isLoading || verificationCode.join('').length !== 6}
                            >
                                {isLoading ? (
                                    <div className="btn-loader" />
                                ) : (
                                    'Verify & Enable'
                                )}
                            </button>

                            <div className="mfa-options">
                                <button
                                    type="button"
                                    className="mfa-option-btn"
                                    onClick={handleResendCode}
                                    disabled={isLoading}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                    </svg>
                                    Resend code
                                </button>
                            </div>

                            <button type="button" className="auth-back-btn" onClick={() => setStep('sms')}>
                                ← Change phone number
                            </button>
                        </div>
                    </>
                )}

                {step === 'success' && (
                    <>
                        <div className="auth-header">
                            <div className="success-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                    <polyline points="22 4 12 14.01 9 11.01" />
                                </svg>
                            </div>
                            <h1 className="auth-title">MFA Enabled Successfully!</h1>
                            <p className="auth-subtitle">
                                Your account is now protected with two-factor authentication.
                                You'll need to enter a verification code each time you sign in.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="btn btn-primary auth-submit"
                            onClick={() => navigate('/')}
                        >
                            Continue to App
                        </button>
                    </>
                )}
            </div>

            <footer className="auth-page-footer">
                <Link to="/about" className="footer-link">About</Link>
                <Link to="/privacy" className="footer-link">Privacy</Link>
                <Link to="/terms" className="footer-link">Terms</Link>
            </footer>
        </div>
    )
}

export default MFASetup

