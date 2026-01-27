/**
 * Developer Configuration
 * =======================
 * Change these values to bypass features during development.
 * 
 * WARNING: Set all to FALSE before deploying to production!
 */

// ============================================
// BYPASS FLAGS - Set to TRUE to bypass
// ============================================

/** Bypass authentication - skip login requirement */
export const BYPASS_AUTH = true;  // ← Set to FALSE to use real Firebase auth

/** Bypass MFA verification during login */
export const BYPASS_MFA = true;  // ✅ Real MFA is now enabled
/** Bypass payment/subscription requirement */
export const BYPASS_PAYMENT = true;

// ============================================
// Mock user data when auth is bypassed
// ============================================
export const MOCK_USER = {
    id: 'dev-user-123',
    email: 'developer@signvision.local',
    name: 'Dev User',
    isPremium: true,
    plan: 'Pro'
};

// Console warning when bypasses are active
if (BYPASS_AUTH || BYPASS_MFA || BYPASS_PAYMENT) {
    console.warn(
        '%c⚠️ DEV BYPASS ACTIVE',
        'background: #ff6b00; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
        '\n• Auth:', BYPASS_AUTH,
        '\n• MFA:', BYPASS_MFA,
        '\n• Payment:', BYPASS_PAYMENT
    );
}
