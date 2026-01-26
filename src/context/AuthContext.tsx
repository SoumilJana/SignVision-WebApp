/**
 * Authentication Context
 * ======================
 * Provides authentication state and methods throughout the app.
 * Integrates with Firebase Auth and supports dev bypass via config flags.
 * Includes MFA (Multi-Factor Authentication) support.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
    type User,
    type MultiFactorResolver,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    signInWithPopup,
    sendEmailVerification,
    sendPasswordResetEmail,
    type UserCredential,
    multiFactor,
    PhoneMultiFactorGenerator,
    TotpMultiFactorGenerator,
    setPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import { auth, googleProvider, githubProvider, isFirebaseConfigured } from '../config/firebase';
import { BYPASS_AUTH, BYPASS_MFA, MOCK_USER } from '../config/devConfig';
import {
    isMFAEnabled as checkMFAEnabled,
    isMFAError,
    getMFAResolver,
    sendMFAVerificationCode,
    completeMFASignIn as completeMFA,
    completeTOTPSignIn
} from '../services/mfaService';

// Mock user type for dev mode
interface MockUser {
    uid: string;
    email: string;
    displayName: string;
    emailVerified: boolean;
    photoURL: string | null;
}

const createMockUser = (): MockUser => ({
    uid: MOCK_USER.id,
    email: MOCK_USER.email,
    displayName: MOCK_USER.name,
    emailVerified: true,
    photoURL: null
});

interface AuthContextType {
    user: User | MockUser | null;
    loading: boolean;
    error: string | null;
    isBypassed: boolean;
    isConfigured: boolean;
    // MFA state
    mfaPending: boolean;
    mfaResolver: MultiFactorResolver | null;
    mfaPhoneHint: string | null;
    mfaFactorType: 'sms' | 'totp' | null;
    hasMFAEnabled: boolean;
    // Auth methods
    signIn: (email: string, password: string) => Promise<UserCredential | void>;
    signUp: (email: string, password: string) => Promise<UserCredential | void>;
    logOut: () => Promise<void>;
    signInWithGoogle: () => Promise<UserCredential | void>;
    signInWithGithub: () => Promise<UserCredential | void>;
    resetPassword: (email: string) => Promise<void>;
    clearError: () => void;
    // MFA methods
    sendMFACode: () => Promise<string | void>;
    completeMFASignIn: (code: string) => Promise<void>;
    cancelMFA: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | MockUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // MFA state
    const [mfaPending, setMfaPending] = useState(false);
    const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
    const [mfaPhoneHint, setMfaPhoneHint] = useState<string | null>(null);
    const [mfaFactorType, setMfaFactorType] = useState<'sms' | 'totp' | null>(null);
    const [hasMFAEnabled, setHasMFAEnabled] = useState(false);

    const isConfigured = isFirebaseConfigured();

    useEffect(() => {
        // Dev bypass - use mock user
        if (BYPASS_AUTH) {
            console.log('🔓 Auth bypassed via devConfig');
            setUser(createMockUser());
            setHasMFAEnabled(false);
            setLoading(false);
            return;
        }

        // If Firebase not configured, don't try to listen for auth changes
        if (!auth || !isConfigured) {
            setLoading(false);
            return;
        }

        // Set persistence to SESSION so user has to log in every time they open the website
        // (unless bypass is on, which is handled above)
        setPersistence(auth, browserSessionPersistence).catch((err) => {
            console.error('Error setting auth persistence:', err);
        });

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser: User | null) => {
            console.log('👤 Auth State Changed:', firebaseUser?.email || 'Logged out');
            setUser(firebaseUser);

            // Check if user has MFA enabled
            if (firebaseUser) {
                const isEnabled = checkMFAEnabled(firebaseUser);
                setHasMFAEnabled(isEnabled);

                // Debug MFA status
                try {
                    const factors = multiFactor(firebaseUser).enrolledFactors;
                    console.log('🛡️ MFA Status:', { isEnabled, factors });
                } catch (e) {
                    console.error('Error checking MFA factors:', e);
                }
            } else {
                setHasMFAEnabled(false);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [isConfigured]);

    const handleMFARequired = (err: unknown) => {
        console.log('🛡️ Handling MFA requirement error:', err);
        const resolver = getMFAResolver(err);
        console.log('🧩 MFA Resolver found:', !!resolver);

        if (resolver) {
            setMfaResolver(resolver);
            setMfaPending(true);
            console.log('✅ MFA state set to pending');

            // Extract hint and determine factor type
            const hint = resolver.hints[0];
            if (hint.factorId === PhoneMultiFactorGenerator.FACTOR_ID) {
                setMfaFactorType('sms');
                if ('phoneNumber' in hint) {
                    setMfaPhoneHint(hint.phoneNumber as string);
                    console.log('📱 Phone MFA detected:', hint.phoneNumber);
                }
            } else if (hint.factorId === TotpMultiFactorGenerator.FACTOR_ID) {
                setMfaFactorType('totp');
                console.log('🔐 TOTP MFA detected');
            }
        } else {
            console.error('❌ Could not extract MFA resolver from error');
        }
    };

    const signIn = async (email: string, password: string): Promise<UserCredential | void> => {
        setError(null);

        // Bypass auth
        if (BYPASS_AUTH) {
            setUser(createMockUser());
            return;
        }

        if (!auth) {
            setError('Firebase not configured');
            return;
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result;
        } catch (err: unknown) {
            if (isMFAError(err) && !BYPASS_MFA) {
                handleMFARequired(err);
                return;
            }
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const signUp = async (email: string, password: string): Promise<UserCredential | void> => {
        setError(null);

        if (BYPASS_AUTH) {
            setUser(createMockUser());
            return;
        }

        if (!auth) {
            setError('Firebase not configured');
            return;
        }

        try {
            const result = await createUserWithEmailAndPassword(auth, email, password);
            if (result.user) {
                await sendEmailVerification(result.user);
            }
            return result;
        } catch (err: unknown) {
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const logOut = async (): Promise<void> => {
        setError(null);
        cancelMFA();

        if (BYPASS_AUTH) {
            return; // Don't actually log out in bypass mode
        }

        if (!auth) return;

        try {
            await signOut(auth);
        } catch {
            setError('Failed to sign out');
        }
    };

    const signInWithGoogle = async (): Promise<UserCredential | void> => {
        setError(null);

        if (BYPASS_AUTH) {
            setUser(createMockUser());
            return;
        }

        if (!auth) {
            setError('Firebase not configured');
            return;
        }

        try {
            return await signInWithPopup(auth, googleProvider);
        } catch (err: unknown) {
            if (isMFAError(err) && !BYPASS_MFA) {
                handleMFARequired(err);
                return;
            }
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const signInWithGithub = async (): Promise<UserCredential | void> => {
        setError(null);

        if (BYPASS_AUTH) {
            setUser(createMockUser());
            return;
        }

        if (!auth) {
            setError('Firebase not configured');
            return;
        }

        try {
            return await signInWithPopup(auth, githubProvider);
        } catch (err: unknown) {
            if (isMFAError(err) && !BYPASS_MFA) {
                handleMFARequired(err);
                return;
            }
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const resetPassword = async (email: string): Promise<void> => {
        setError(null);

        if (BYPASS_AUTH) {
            return;
        }

        if (!auth) {
            setError('Firebase not configured');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
        } catch (err: unknown) {
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    // MFA Methods
    const sendMFACode = async (): Promise<string | void> => {
        setError(null);

        if (BYPASS_MFA) {
            return 'bypass-id';
        }

        if (!mfaResolver) {
            setError('No MFA verification pending');
            return;
        }

        try {
            return await sendMFAVerificationCode(mfaResolver, 0);
        } catch (err: unknown) {
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const completeMFASignIn = async (code: string): Promise<void> => {
        setError(null);

        if (BYPASS_MFA) {
            // In bypass mode, just clear MFA state
            cancelMFA();
            return;
        }

        if (!mfaResolver) {
            setError('No MFA verification pending');
            return;
        }

        try {
            // Use appropriate completion method based on factor type
            if (mfaFactorType === 'totp') {
                await completeTOTPSignIn(mfaResolver, code, 0);
            } else {
                await completeMFA(mfaResolver, code, 0);
            }
            cancelMFA();
        } catch (err: unknown) {
            const message = getErrorMessage((err as { code?: string }).code);
            setError(message);
            throw err;
        }
    };

    const cancelMFA = (): void => {
        setMfaPending(false);
        setMfaResolver(null);
        setMfaPhoneHint(null);
        setMfaFactorType(null);
    };

    const clearError = () => setError(null);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            isBypassed: BYPASS_AUTH,
            isConfigured,
            // MFA state
            mfaPending,
            mfaResolver,
            mfaPhoneHint,
            mfaFactorType,
            hasMFAEnabled,
            // Auth methods
            signIn,
            signUp,
            logOut,
            signInWithGoogle,
            signInWithGithub,
            resetPassword,
            clearError,
            // MFA methods
            sendMFACode,
            completeMFASignIn,
            cancelMFA
        }}>
            {children}
        </AuthContext.Provider>
    );
}

// Helper function for user-friendly error messages
function getErrorMessage(code: string | undefined): string {
    switch (code) {
        case 'auth/invalid-email':
            return 'Invalid email address';
        case 'auth/user-disabled':
            return 'This account has been disabled';
        case 'auth/user-not-found':
            return 'No account found with this email';
        case 'auth/wrong-password':
            return 'Incorrect password';
        case 'auth/email-already-in-use':
            return 'An account already exists with this email';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters';
        case 'auth/popup-closed-by-user':
            return 'Sign-in popup was closed';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later';
        case 'auth/invalid-credential':
            return 'Invalid email or password';
        case 'auth/invalid-verification-code':
            return 'Invalid verification code. Please try again';
        case 'auth/code-expired':
            return 'Verification code expired. Please request a new one';
        default:
            return 'An error occurred. Please try again';
    }
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;

