import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hotel, User, LogOut, Menu, X, ShieldAlert, LayoutDashboard } from 'lucide-react';

export default function Navbar() {
    const { user, logout, isAuthenticated, isStudent, isOwner, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path;

    const navLinkClass = (path) => `
        px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
        ${isActive(path) 
            ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30' 
            : 'text-slate-300 hover:bg-slate-800 hover:text-white border border-transparent'}
    `;

    return (
        <nav className="sticky top-0 z-50 glass-panel border-b border-slate-900 shadow-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Brand Logo */}
                    <div className="flex items-center">
                        <Link to="/" className="flex items-center gap-2 group">
                            <div className="p-2 bg-gradient-to-tr from-brand-600 to-indigo-600 rounded-xl shadow-md group-hover:scale-105 transition-transform">
                                <Hotel className="h-6 w-6 text-white" />
                            </div>
                            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-400 bg-clip-text text-transparent">
                                SmartStay <span className="text-brand-500 font-medium text-xs border border-brand-500/30 px-1.5 py-0.5 rounded-full ml-1">AI</span>
                            </span>
                        </Link>
                    </div>

                    {/* Navigation Items (Desktop) */}
                    <div className="hidden md:flex items-center space-x-4">
                        <Link to="/" className={navLinkClass('/')}>Home</Link>
                        
                        {isStudent && (
                            <>
                                <Link to="/search" className={navLinkClass('/search')}>Find Hostels</Link>
                                <Link to="/my-bookings" className={navLinkClass('/my-bookings')}>My Bookings</Link>
                            </>
                        )}

                        {(isOwner || isAdmin) && (
                            <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                                <div className="flex items-center gap-1.5">
                                    <LayoutDashboard className="w-4 h-4" />
                                    <span>Dashboard</span>
                                </div>
                            </Link>
                        )}

                        {isAuthenticated ? (
                            <div className="flex items-center gap-4 border-l border-slate-800 pl-4">
                                <Link to="/profile" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                                        <User className="w-4 h-4 text-brand-400" />
                                    </div>
                                    <span className="text-sm font-semibold max-w-[120px] truncate">{user?.name}</span>
                                </Link>
                                <button 
                                    onClick={handleLogout}
                                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg transition-all"
                                    title="Sign Out"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
                                <Link to="/login" className="text-slate-300 hover:text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-900 transition-all">
                                    Log In
                                </Link>
                                <Link to="/register" className="btn-primary py-2 text-sm">
                                    Get Started
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <div className="flex md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 focus:outline-none"
                        >
                            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isOpen && (
                <div className="md:hidden glass-panel border-b border-slate-900 px-2 pt-2 pb-3 space-y-1 sm:px-3 animate-fade-in">
                    <Link 
                        to="/" 
                        onClick={() => setIsOpen(false)}
                        className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
                    >
                        Home
                    </Link>

                    {isStudent && (
                        <>
                            <Link 
                                to="/search" 
                                onClick={() => setIsOpen(false)}
                                className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/search') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
                            >
                                Find Hostels
                            </Link>
                            <Link 
                                to="/my-bookings" 
                                onClick={() => setIsOpen(false)}
                                className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/my-bookings') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
                            >
                                My Bookings
                            </Link>
                        </>
                    )}

                    {(isOwner || isAdmin) && (
                        <Link 
                            to="/dashboard" 
                            onClick={() => setIsOpen(false)}
                            className={`block px-3 py-2 rounded-md text-base font-medium ${isActive('/dashboard') ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-900 hover:text-white'}`}
                        >
                            Dashboard
                        </Link>
                    )}

                    {isAuthenticated ? (
                        <div className="border-t border-slate-800 pt-4 mt-2">
                            <Link 
                                to="/profile" 
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-3 py-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-900"
                            >
                                <User className="w-5 h-5" />
                                <span>{user?.name} (Profile)</span>
                            </Link>
                            <button 
                                onClick={() => { setIsOpen(false); handleLogout(); }}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-red-400 hover:bg-red-500/10 text-left"
                            >
                                <LogOut className="w-5 h-5" />
                                <span>Sign Out</span>
                            </button>
                        </div>
                    ) : (
                        <div className="border-t border-slate-800 pt-4 mt-2 space-y-2 px-3">
                            <Link to="/login" onClick={() => setIsOpen(false)} className="block w-full text-center text-slate-300 hover:text-white py-2 rounded-lg hover:bg-slate-900">
                                Log In
                            </Link>
                            <Link to="/register" onClick={() => setIsOpen(false)} className="block w-full text-center btn-primary py-2 text-sm">
                                Register
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
}
