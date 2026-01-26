import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Register() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [step, setStep] = useState<'form' | 'verify'>('form')
    const [acceptTerms, setAcceptTerms] = useState(false)

    const { signUp, signInWithGoogle, signInWithGithub, error, clearError, isBypassed, isConfigured } = useAuth()
    const navigate = useNavigate()

    // Redirect when bypass is active - skip registration
    useEffect(() => {
        if (isBypassed) {
            console.log('🔓 Bypass active - skipping registration page')
            navigate('/')
        }
    }, [isBypassed, navigate])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        clearError()

        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match')
            return
        }
        if (!acceptTerms) {
            alert('Please accept the terms and conditions')
            return
        }

        setIsLoading(true)
        try {
            await signUp(formData.email, formData.password)
            // Show verification step
            setStep('verify')
        } catch (err) {
            console.error('Registration failed:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleGoogleSignUp = async () => {
        clearError()
        try {
            await signInWithGoogle()
            navigate('/')
        } catch (err) {
            console.error('Google signup failed:', err)
        }
    }

    const handleGithubSignUp = async () => {
        clearError()
        try {
            await signInWithGithub()
            navigate('/')
        } catch (err) {
            console.error('GitHub signup failed:', err)
        }
    }

    const getPasswordStrength = () => {
        const password = formData.password
        if (!password) return { strength: 0, label: '' }

        let strength = 0
        if (password.length >= 8) strength++
        if (/[A-Z]/.test(password)) strength++
        if (/[0-9]/.test(password)) strength++
        if (/[^A-Za-z0-9]/.test(password)) strength++

        const labels = ['', 'Weak', 'Fair', 'Good', 'Strong']
        return { strength, label: labels[strength] }
    }

    const passwordStrength = getPasswordStrength()

    return (
        <div className="auth-container">
            <div className="auth-bg-gradient" />

            <div className="auth-card">
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

                {step === 'form' ? (
                    <>
                        <div className="auth-header">
                            <h1 className="auth-title">Create your account</h1>
                            <p className="auth-subtitle">Start translating sign language in seconds</p>
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
                                <button type="button" className="social-btn" onClick={handleGoogleSignUp}>
                                    <svg width="20" height="20" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Sign up with Google
                                </button>
                                <button type="button" className="social-btn" onClick={handleGithubSignUp}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                    </svg>
                                    Sign up with GitHub
                                </button>
                            </div>

                            <div className="auth-divider">
                                <span>or continue with email</span>
                            </div>

                            {/* Name Input */}
                            <div className="form-group">
                                <label htmlFor="name" className="form-label">Full name</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                        <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        className="form-input"
                                        placeholder="Enter your name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
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
                                        name="email"
                                        type="email"
                                        className="form-input"
                                        placeholder="Enter your email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="form-group">
                                <label htmlFor="password" className="form-label">Password</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? "text" : "password"}
                                        className="form-input"
                                        placeholder="Create a password"
                                        value={formData.password}
                                        onChange={handleChange}
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
                                {formData.password && (
                                    <div className="password-strength">
                                        <div className="strength-bar">
                                            <div
                                                className={`strength-fill strength-${passwordStrength.strength}`}
                                                style={{ width: `${(passwordStrength.strength / 4) * 100}%` }}
                                            />
                                        </div>
                                        <span className={`strength-label strength-${passwordStrength.strength}`}>
                                            {passwordStrength.label}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Confirm Password Input */}
                            <div className="form-group">
                                <label htmlFor="confirmPassword" className="form-label">Confirm password</label>
                                <div className="input-wrapper">
                                    <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <input
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        className="form-input"
                                        placeholder="Confirm your password"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                    {formData.confirmPassword && (
                                        <div className="input-validation">
                                            {formData.password === formData.confirmPassword ? (
                                                <svg className="validation-icon valid" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <svg className="validation-icon invalid" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18" />
                                                    <line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Terms Checkbox */}
                            <div className="form-checkbox">
                                <input
                                    type="checkbox"
                                    id="terms"
                                    className="checkbox-input"
                                    checked={acceptTerms}
                                    onChange={(e) => setAcceptTerms(e.target.checked)}
                                />
                                <label htmlFor="terms" className="checkbox-label">
                                    I agree to the <Link to="/terms" className="form-link">Terms of Service</Link> and <Link to="/privacy" className="form-link">Privacy Policy</Link>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <button type="submit" className="btn btn-primary auth-submit" disabled={isLoading}>
                                {isLoading ? (
                                    <div className="btn-loader" />
                                ) : (
                                    'Create account'
                                )}
                            </button>
                        </form>

                        <p className="auth-footer">
                            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
                        </p>
                    </>
                ) : (
                    <>
                        {/* Email Verification */}
                        <div className="auth-header">
                            <div className="verify-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                    <polyline points="22,6 12,13 2,6" />
                                </svg>
                            </div>
                            <h1 className="auth-title">Verify your email</h1>
                            <p className="auth-subtitle">
                                We've sent a verification link to<br />
                                <strong>{formData.email}</strong>
                            </p>
                        </div>

                        <div className="auth-form">
                            <div className="verification-info">
                                <p>Please check your inbox and click the verification link to continue.</p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-primary auth-submit"
                                onClick={() => navigate('/mfa-setup')}
                            >
                                Continue to MFA Setup
                            </button>

                            <div className="resend-code">
                                <span>Didn't receive the email?</span>
                                <button type="button" className="resend-btn">Resend email</button>
                            </div>

                            <button
                                type="button"
                                className="auth-back-btn"
                                onClick={() => setStep('form')}
                            >
                                ← Back to registration
                            </button>
                        </div>
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

export default Register
