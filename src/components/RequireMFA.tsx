/**
 * RequireMFA Component
 * ====================
 * Wrapper component that requires users to have MFA enabled.
 * Redirects to MFA setup if user is authenticated but hasn't set up MFA.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BYPASS_MFA } from '../config/devConfig';

interface RequireMFAProps {
    children: React.ReactNode;
}

function RequireMFA({ children }: RequireMFAProps) {
    const { user, loading, hasMFAEnabled, isBypassed } = useAuth();

    // Show nothing while loading
    if (loading) {
        return (
            <div className="loading-container" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'var(--bg-primary)'
            }}>
                <div className="btn-loader" style={{ width: '32px', height: '32px' }} />
            </div>
        );
    }

    // Not logged in - redirect to login
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Auth is bypassed - allow access
    if (isBypassed) {
        return <>{children}</>;
    }

    // MFA is bypassed - allow access
    if (BYPASS_MFA) {
        return <>{children}</>;
    }

    // User has MFA enabled - allow access
    if (hasMFAEnabled) {
        return <>{children}</>;
    }

    // User needs to set up MFA - redirect to setup
    return <Navigate to="/mfa-setup" replace />;
}

export default RequireMFA;
