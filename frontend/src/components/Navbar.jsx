import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Clapperboard, Menu, X } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = () => {
        logout();
        setMobileOpen(false);
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const navLink = (to, label) => (
        <Link
            to={to}
            onClick={() => setMobileOpen(false)}
            className={`text-sm font-medium transition-colors ${
                isActive(to)
                    ? 'text-white'
                    : 'text-brand-muted hover:text-white'
            }`}
        >
            {label}
        </Link>
    );

    return (
        <nav className="sticky top-0 z-50 bg-brand-bg/80 backdrop-blur-xl border-b border-brand-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
                        <Clapperboard size={22} className="text-brand-primary" />
                        CineScope
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-6">
                        {user ? (
                            <>
                                {navLink('/', 'Home')}
                                {navLink('/watchlist', 'Watchlist')}
                                <div className="flex items-center gap-3 ml-2 pl-4 border-l border-brand-border">
                                    <span className="text-sm text-brand-muted">
                                        <span className="text-white font-medium">{user.name}</span>
                                    </span>
                                    <button
                                        onClick={handleLogout}
                                        className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {navLink('/login', 'Login')}
                                <Link to="/register" className="btn-primary">
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden text-brand-muted hover:text-white transition-colors cursor-pointer"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {/* Mobile nav */}
                {mobileOpen && (
                    <div className="md:hidden pb-4 pt-2 border-t border-brand-border space-y-3 animate-fade-in">
                        {user ? (
                            <>
                                <div className="text-sm text-brand-muted px-1 py-2">
                                    Signed in as <span className="text-white font-medium">{user.name}</span>
                                </div>
                                {navLink('/', 'Home')}
                                <div>{navLink('/watchlist', 'Watchlist')}</div>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {navLink('/login', 'Login')}
                                <Link
                                    to="/register"
                                    onClick={() => setMobileOpen(false)}
                                    className="btn-primary text-center"
                                >
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
