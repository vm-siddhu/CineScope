import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

/**
 * Decode a JWT payload without verifying the signature.
 * Used only for client-side expiry pre-check.
 */
function decodeToken(token) {
    try {
        const base64Payload = token.split('.')[1];
        return JSON.parse(atob(base64Payload));
    } catch {
        return null;
    }
}

/**
 * Returns true if the token exists and its `exp` claim is in the future.
 * The server still performs full cryptographic verification — this is just
 * a fast client-side guard so that an obviously expired token doesn't let
 * the user see protected pages until the first API call fails.
 */
function isTokenValid(token) {
    if (!token) return false;
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return false;
    // `exp` is in seconds; Date.now() is in milliseconds.
    return payload.exp * 1000 > Date.now();
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const token = localStorage.getItem('token');
        if (storedUser && isTokenValid(token)) {
            setUser(JSON.parse(storedUser));
        } else {
            // Token is absent or expired — clear stale data.
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
        setLoading(false);
    }, []);

    const login = (userData, token) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', token);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
