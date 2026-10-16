import React, { useState } from 'react';
import AuthContext from './AuthContextValue';

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

function getStoredUser() {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && isTokenValid(token)) {
        try {
            return JSON.parse(storedUser);
        } catch {
            // Clear malformed persisted state and show the logged-out UI.
        }
    }

    // Token is absent/expired or stored user data is malformed.
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    return null;
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(getStoredUser);

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
        <AuthContext.Provider value={{ user, loading: false, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
