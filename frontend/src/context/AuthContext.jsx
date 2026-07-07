import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

/**
 * Safely parse the JWT payload to extract claims without verifying the signature
 * (signature verification is strictly the backend's job).
 */
const getJwtPayload = (token) => {
    if (!token) return null;
    try {
        // JWT is header.payload.signature
        const payloadBase64Url = token.split('.')[1];
        // Convert Base64Url to standard Base64
        const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
        const decodedJson = atob(payloadBase64);
        return JSON.parse(decodedJson);
    } catch (err) {
        console.error('Failed to parse JWT payload on client', err);
        return null;
    }
};

/**
 * Check if the token's `exp` claim is in the past.
 */
const isTokenExpired = (token) => {
    const payload = getJwtPayload(token);
    if (!payload || !payload.exp) return true; // If we can't read exp, assume invalid

    // exp is in seconds, Date.now() is in milliseconds
    return (payload.exp * 1000) < Date.now();
};

// ──────────────────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load persisted credentials on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            if (isTokenExpired(storedToken)) {
                // Token is already expired on app load — clear it immediately
                // before the user even sees the private routes.
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                console.warn('Persisted session was already expired. Cleared.');
            } else {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        }
        setLoading(false);
    }, []);

    // Auto-logout timer: triggers exactly when the token expires
    // if the user leaves the tab open.
    useEffect(() => {
        if (!token) return;

        const payload = getJwtPayload(token);
        if (!payload || !payload.exp) return;

        const msUntilExpiry = (payload.exp * 1000) - Date.now();
        
        if (msUntilExpiry <= 0) {
            logout();
            return;
        }

        const timer = setTimeout(() => {
            console.warn('Session expired. Auto-logging out.');
            logout();
        }, msUntilExpiry);

        return () => clearTimeout(timer); // Cleanup if token changes or component unmounts
    }, [token]);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const res = await authService.login({ email, password });
            const { token: newToken, user: userData } = res.data;
            
            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));
            
            setToken(newToken);
            setUser(userData);
            return userData;
        } catch (err) {
            logout();
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const register = async (details) => {
        setLoading(true);
        try {
            const res = await authService.register(details);
            const { token: newToken, user: userData } = res.data;

            localStorage.setItem('token', newToken);
            localStorage.setItem('user', JSON.stringify(userData));

            setToken(newToken);
            setUser(userData);
            return userData;
        } catch (err) {
            logout();
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        isAuthenticated: !!token,
        isStudent: user?.role === 'student',
        isOwner: user?.role === 'owner',
        isAdmin: user?.role === 'admin'
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be consumed within an AuthProvider');
    }
    return context;
};
