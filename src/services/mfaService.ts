/**
 * MFA Service
 * ===========
 * Handles Multi-Factor Authentication operations with Firebase.
 * Currently supports SMS-based phone verification.
 */

import {
    multiFactor,
    PhoneAuthProvider,
    PhoneMultiFactorGenerator,
    TotpMultiFactorGenerator,
    TotpSecret,
    type MultiFactorResolver,
    type User,
    RecaptchaVerifier,
    type MultiFactorInfo,
    getMultiFactorResolver
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { BYPASS_MFA } from '../config/devConfig';
import QRCode from 'qrcode';

// Store recaptcha verifier instance
let recaptchaVerifier: RecaptchaVerifier | null = null;
let verificationId: string | null = null;

/**
 * Initialize recaptcha verifier for phone authentication
 */
export const initRecaptcha = (containerId: string): RecaptchaVerifier | null => {
    if (BYPASS_MFA || !auth) return null;

    // Clear any existing verifier
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
    }

    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
            console.log('✅ reCAPTCHA verified');
        },
        'expired-callback': () => {
            console.warn('⚠️ reCAPTCHA expired');
        }
    });

    return recaptchaVerifier;
};

/**
 * Start phone MFA enrollment - sends verification code
 */
export const startPhoneMFAEnrollment = async (
    user: User,
    phoneNumber: string
): Promise<string> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating enrollment');
        return 'bypass-verification-id';
    }

    if (!auth) {
        console.error('❌ Firebase auth not initialized');
        throw new Error('Firebase auth not initialized');
    }

    if (!recaptchaVerifier) {
        console.error('❌ reCAPTCHA verifier not initialized');
        throw new Error('reCAPTCHA not initialized. Please refresh the page.');
    }

    console.log('📱 Starting phone MFA enrollment for:', phoneNumber);

    try {
        const multiFactorSession = await multiFactor(user).getSession();
        console.log('✅ Got multi-factor session');

        const phoneInfoOptions = {
            phoneNumber,
            session: multiFactorSession
        };

        const phoneAuthProvider = new PhoneAuthProvider(auth);
        console.log('📤 Sending verification code...');

        verificationId = await phoneAuthProvider.verifyPhoneNumber(
            phoneInfoOptions,
            recaptchaVerifier
        );

        console.log('✅ Verification code sent successfully');
        return verificationId;
    } catch (error) {
        console.error('❌ Phone MFA enrollment failed:', error);
        throw error;
    }
};

/**
 * Complete phone MFA enrollment with verification code
 */
export const completePhoneMFAEnrollment = async (
    user: User,
    code: string,
    displayName?: string
): Promise<void> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating enrollment completion');
        return;
    }

    if (!verificationId) {
        throw new Error('No verification in progress');
    }

    const cred = PhoneAuthProvider.credential(verificationId, code);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

    await multiFactor(user).enroll(
        multiFactorAssertion,
        displayName || 'Phone Number'
    );

    verificationId = null;
};

// ============================================
// TOTP (Authenticator App) MFA Functions
// ============================================

// Store TOTP secret temporarily during enrollment
let totpSecret: TotpSecret | null = null;

/**
 * Start TOTP MFA enrollment - generates secret and QR code
 */
export const startTOTPEnrollment = async (
    user: User
): Promise<{ secret: string; qrCodeUrl: string }> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating TOTP enrollment');
        return {
            secret: 'JBSWY3DPEHPK3PXP',
            qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
        };
    }

    if (!auth) {
        throw new Error('Firebase auth not initialized');
    }

    console.log('📱 Starting TOTP MFA enrollment');

    try {
        const multiFactorSession = await multiFactor(user).getSession();
        console.log('✅ Got multi-factor session');

        // Generate TOTP secret
        totpSecret = await TotpMultiFactorGenerator.generateSecret(multiFactorSession);
        console.log('✅ TOTP secret generated');

        // Get the secret string
        const secretKey = totpSecret.secretKey;

        // Generate QR code URL
        const otpauthUrl = totpSecret.generateQrCodeUrl(
            user.email || 'user@signvision.app',
            'SignVision'
        );

        // Generate QR code as data URL
        const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
        console.log('✅ QR code generated');

        return {
            secret: secretKey,
            qrCodeUrl
        };
    } catch (error) {
        console.error('❌ TOTP enrollment failed:', error);
        throw error;
    }
};

/**
 * Complete TOTP MFA enrollment with verification code
 */
export const completeTOTPEnrollment = async (
    user: User,
    code: string,
    displayName?: string
): Promise<void> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating TOTP enrollment completion');
        return;
    }

    if (!totpSecret) {
        throw new Error('No TOTP enrollment in progress');
    }

    console.log('🔐 Verifying TOTP code and completing enrollment');

    try {
        // Generate the multi-factor assertion from the secret and code
        const multiFactorAssertion = await TotpMultiFactorGenerator.assertionForEnrollment(
            totpSecret,
            code
        );

        // Enroll the TOTP factor
        await multiFactor(user).enroll(
            multiFactorAssertion,
            displayName || 'Authenticator App'
        );

        console.log('✅ TOTP enrollment completed');
        totpSecret = null;
    } catch (error) {
        console.error('❌ TOTP enrollment completion failed:', error);
        throw error;
    }
};

/**
 * Complete TOTP MFA sign-in with verification code
 */
export const completeTOTPSignIn = async (
    resolver: MultiFactorResolver,
    code: string,
    selectedIndex: number = 0
): Promise<void> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating TOTP sign-in');
        return;
    }

    if (!auth) {
        throw new Error('Auth not initialized');
    }

    const hint = resolver.hints[selectedIndex];

    if (hint.factorId !== TotpMultiFactorGenerator.FACTOR_ID) {
        throw new Error('Selected factor is not TOTP');
    }

    console.log('🔐 Verifying TOTP code for sign-in');

    try {
        // Generate assertion for sign-in
        const multiFactorAssertion = TotpMultiFactorGenerator.assertionForSignIn(
            hint.uid,
            code
        );

        // Resolve sign-in with TOTP
        await resolver.resolveSignIn(multiFactorAssertion);
        console.log('✅ TOTP sign-in completed');
    } catch (error) {
        console.error('❌ TOTP sign-in failed:', error);
        throw error;
    }
};

/**
 * Complete MFA sign-in with verification code
 */
export const completeMFASignIn = async (
    resolver: MultiFactorResolver,
    code: string,
    selectedIndex: number = 0
): Promise<void> => {
    if (BYPASS_MFA) {
        console.log('🔓 MFA bypassed - simulating sign-in');
        return;
    }

    if (!auth) {
        throw new Error('Auth not initialized');
    }

    const hint = resolver.hints[selectedIndex];

    if (hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) {
        throw new Error('Unsupported MFA factor');
    }

    // If we don't have a verificationId, we need to send a new code
    if (!verificationId) {
        throw new Error('No verification code sent. Please request a new code.');
    }

    const cred = PhoneAuthProvider.credential(verificationId, code);
    const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);

    await resolver.resolveSignIn(multiFactorAssertion);
    verificationId = null;
};

/**
 * Send MFA verification code during sign-in
 */
export const sendMFAVerificationCode = async (
    resolver: MultiFactorResolver,
    selectedIndex: number = 0
): Promise<string> => {
    if (BYPASS_MFA) {
        return 'bypass-verification-id';
    }

    if (!auth || !recaptchaVerifier) {
        throw new Error('Auth or reCAPTCHA not initialized');
    }

    const hint = resolver.hints[selectedIndex];

    if (hint.factorId !== PhoneMultiFactorGenerator.FACTOR_ID) {
        throw new Error('Unsupported MFA factor');
    }

    const phoneAuthProvider = new PhoneAuthProvider(auth);
    verificationId = await phoneAuthProvider.verifyPhoneNumber(
        { multiFactorHint: hint, session: resolver.session },
        recaptchaVerifier
    );

    return verificationId;
};

/**
 * Check if user has MFA enabled
 */
export const isMFAEnabled = (user: User | null): boolean => {
    if (!user) return false;
    return multiFactor(user).enrolledFactors.length > 0;
};

/**
 * Get user's enrolled MFA factors
 */
export const getEnrolledFactors = (user: User): MultiFactorInfo[] => {
    return multiFactor(user).enrolledFactors;
};

/**
 * Unenroll an MFA factor
 */
export const unenrollMFA = async (
    user: User,
    factor: MultiFactorInfo
): Promise<void> => {
    await multiFactor(user).unenroll(factor);
};

/**
 * Clean up recaptcha verifier
 */
export const cleanupRecaptcha = (): void => {
    if (recaptchaVerifier) {
        recaptchaVerifier.clear();
        recaptchaVerifier = null;
    }
    verificationId = null;
};

/**
 * Check if error is MFA required error
 */
export const isMFAError = (error: unknown): boolean => {
    return (error as { code?: string })?.code === 'auth/multi-factor-auth-required';
};

/**
 * Get MFA resolver from error
 */
export const getMFAResolver = (error: unknown): MultiFactorResolver | null => {
    if (!isMFAError(error) || !auth) return null;
    return getMultiFactorResolver(auth, error as any);
};
