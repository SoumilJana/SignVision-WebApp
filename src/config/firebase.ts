/**
 * Firebase Configuration
 * ======================
 * Initialize Firebase with environment variables.
 * Credentials are stored in .env file (not committed to git).
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
    getAuth,
    type Auth,
    GoogleAuthProvider,
    GithubAuthProvider
} from 'firebase/auth';
import { getAnalytics, type Analytics } from 'firebase/analytics';

// Check if Firebase is configured
export const isFirebaseConfigured = (): boolean => {
    return !!(
        import.meta.env.VITE_FIREBASE_API_KEY &&
        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
        import.meta.env.VITE_FIREBASE_PROJECT_ID
    );
};

// Firebase configuration from environment variables
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let analytics: Analytics | null = null;

if (isFirebaseConfigured()) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);

        // Only initialize analytics in browser (not SSR)
        if (typeof window !== 'undefined') {
            analytics = getAnalytics(app);
        }

        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
    }
} else {
    console.warn('⚠️ Firebase not configured - check .env file');
}

// Auth providers
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

// Configure providers
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

export { app, auth, analytics };
export default app;
