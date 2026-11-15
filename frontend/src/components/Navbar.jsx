import React, { useContext, useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import AuthContext from '../context/AuthContextValue';
import { Clapperboard, Menu, X, ChevronDown, Eye, Bookmark, LayoutDashboard } from 'lucide-react';
import api from '../utils/api';

const Navbar = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [counts, setCounts] = useState({ watched: 0, watchlist: 0 });
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        api.get('/user/hub')
            .then(res => {
                if (!cancelled) {
                    setCounts({
                        watched: res.data?.tasteAnalytics?.watchedCount || 0,
                        watchlist: res.data?.tasteAnalytics?.wantToWatchCount || 0
                    });
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [user, location.pathname]);

    const displayCounts = user ? counts : { watched: 0, watchlist: 0 };

    useEffect(() => {
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleLogout = () => {
        logout();
        setMobileOpen(false);
        setDropdownOpen(false);
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const navLink = (to, label) => (
        <Link
            to={to}
            onClick={() => setMobileOpen(false)}
            className={`text-sm font-medium transition-colors ${
                isActive(to) ? 'text-white' : 'text-brand-muted hover:text-white'
            }`}
        >
            {label}
        </Link>
    );

    return (
        <nav className="sticky top-0 z-50 bg-brand-bg/80 backdrop-blur-xl border-b border-brand-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
                        <Clapperboard size={22} className="text-brand-primary" />
                        CineScope
                    </Link>

                    <div className="hidden md:flex items-center gap-6">
                        {user ? (
                            <>
                                {navLink('/', 'Home')}
                                {navLink('/watchlist', 'Watchlist')}

                                <div className="relative ml-2 pl-4 border-l border-brand-border" ref={dropdownRef}>
                                    <button
                                        onClick={() => setDropdownOpen(prev => !prev)}
                                        className="flex items-center gap-2 text-sm font-medium text-brand-muted hover:text-white transition-colors cursor-pointer"
                                    >
                                        <div className="w-7 h-7 rounded-full bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary text-xs font-bold">
                                            {user.name?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium max-w-[120px] truncate">{user.name}</span>
                                        <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {dropdownOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-brand-card border border-brand-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-fade-in z-50">
                                            <div className="px-4 py-3 border-b border-brand-border">
                                                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                                                <p className="text-xs text-brand-muted truncate">{user.email}</p>
                                                <div className="flex gap-3 mt-2">
                                                    <span className="text-[11px] text-slate-400">
                                                        <span className="text-white font-medium">{displayCounts.watched}</span> watched
                                                    </span>
                                                    <span className="text-[11px] text-slate-400">
                                                        <span className="text-white font-medium">{displayCounts.watchlist}</span> in watchlist
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="py-1">
                                                <DropdownLink to="/profile" icon={<LayoutDashboard size={13} />} label="My Cinema Hub" onClick={() => setDropdownOpen(false)} />
                                                <DropdownLink to="/profile?tab=watchlist" icon={<Bookmark size={13} />} label="Want to Watch" onClick={() => setDropdownOpen(false)} />
                                                <DropdownLink to="/profile?tab=watched" icon={<Eye size={13} />} label="Watched History" onClick={() => setDropdownOpen(false)} />
                                            </div>

                                            <div className="border-t border-brand-border py-1">
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/5 hover:text-red-300 transition-colors cursor-pointer"
                                                >
                                                    Logout
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {navLink('/login', 'Login')}
                                <Link to="/register" className="btn-primary">Sign Up</Link>
                            </>
                        )}
                    </div>

                    <button
                        className="md:hidden text-brand-muted hover:text-white transition-colors cursor-pointer"
                        onClick={() => setMobileOpen(!mobileOpen)}
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {mobileOpen && (
                    <div className="md:hidden pb-4 pt-2 border-t border-brand-border space-y-3 animate-fade-in">
                        {user ? (
                            <>
                                <div className="px-1 py-2 text-sm text-brand-muted">
                                    Signed in as <span className="text-white font-medium">{user.name}</span>
                                    <div className="text-xs mt-0.5 text-slate-500">{user.email}</div>
                                    <div className="flex gap-3 mt-1 text-xs">
                                        <span><span className="text-white font-medium">{displayCounts.watched}</span> watched</span>
                                        <span><span className="text-white font-medium">{displayCounts.watchlist}</span> watchlist</span>
                                    </div>
                                </div>
                                {navLink('/', 'Home')}
                                <div>{navLink('/watchlist', 'Watchlist')}</div>
                                <div>{navLink('/profile', 'My Cinema Hub')}</div>
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
                                <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-primary text-center">
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

const DropdownLink = ({ to, icon, label, onClick }) => (
    <Link
        to={to}
        onClick={onClick}
        className="flex items-center gap-2.5 px-4 py-2 text-sm text-brand-muted hover:text-white hover:bg-brand-surface transition-colors"
    >
        <span className="text-slate-500">{icon}</span>
        {label}
    </Link>
);

export default Navbar;
