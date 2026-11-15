import React, { useState } from 'react';
import AuthContext from './AuthContextValue';

function decodeToken(token) {
    try {
        const base64Payload = token.split('.')[1];
        return JSON.parse(atob(base64Payload));
    } catch {
        return null;
    }
}

function isTokenValid(token) {
    if (!token) return false;
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return false;
    return payload.exp * 1000 > Date.now();
}

function getStoredUser() {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (storedUser && isTokenValid(token)) {
        try {
            return JSON.parse(storedUser);
        } catch {
            return null;
        }
    }

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
