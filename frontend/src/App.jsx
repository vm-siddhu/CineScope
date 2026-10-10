import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Watchlist from './pages/Watchlist';
import MovieDetail from './pages/MovieDetail';
import './index.css';
import { Toaster } from 'react-hot-toast';

/** Redirect to home if already logged in */
const GuestRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-bg">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-primary border-t-transparent" />
            </div>
        );
    }
    if (user) return <Navigate to="/" />;
    return children;
};

/** Redirect to login if not authenticated */
const ProtectedRoute = ({ children }) => {
    const { user, loading } = useContext(AuthContext);
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-bg">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-brand-primary border-t-transparent" />
            </div>
        );
    }
    if (!user) return <Navigate to="/login" />;
    return children;
};

/** Simple 404 page */
const NotFound = () => (
    <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-6xl font-bold text-brand-primary mb-2">404</p>
        <p className="text-brand-muted font-medium mb-6">Page not found</p>
        <a href="/" className="btn-primary">Go Home</a>
    </div>
);

function AppContent() {
    return (
        <div className="min-h-screen flex flex-col bg-brand-bg selection:bg-brand-primary/30">
            <Navbar />
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Routes>
                    {/* Auth pages — redirect away if already logged in */}
                    <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
                    <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

                    {/* Protected pages */}
                    <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
                    <Route path="/movie/:id" element={<ProtectedRoute><MovieDetail /></ProtectedRoute>} />

                    {/* 404 */}
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
            <footer className="py-6 border-t border-brand-border text-center text-xs text-slate-600">
                CineScope &copy; {new Date().getFullYear()}
            </footer>
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Toaster
                    position="top-right"
                    reverseOrder={false}
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#111827',
                            color: '#f1f5f9',
                            border: '1px solid #1e293b',
                            fontSize: '14px'
                        },
                        success: {
                            iconTheme: { primary: '#3b82f6', secondary: '#fff' }
                        },
                        error: {
                            iconTheme: { primary: '#ef4444', secondary: '#fff' }
                        }
                    }}
                />
                <AppContent />
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
