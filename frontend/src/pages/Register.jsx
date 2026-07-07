import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function Register() {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [role, setRole] = useState('student'); // Default role 'student'
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            return setError('Passwords do not match');
        }

        setLoading(true);

        try {
            const user = await register({ name, email, password, role, phone });
            if (user.role === 'student') {
                navigate('/');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center py-16 px-4 relative">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative z-10 shadow-2xl border border-slate-900 animate-slide-up">
                <div className="text-center mb-6">
                    <h2 className="text-3xl font-extrabold text-white">Create Account</h2>
                    <p className="text-sm text-slate-400 mt-2">Get started as a student, owner, or platform host.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-4 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* User Role Selection Tabs */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800">
                        <button
                            type="button"
                            className={`py-2 text-xs font-semibold rounded-lg transition-all ${role === 'student' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'text-slate-400 hover:text-white'}`}
                            onClick={() => setRole('student')}
                        >
                            I am a Student
                        </button>
                        <button
                            type="button"
                            className={`py-2 text-xs font-semibold rounded-lg transition-all ${role === 'owner' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20' : 'text-slate-400 hover:text-white'}`}
                            onClick={() => setRole('owner')}
                        >
                            I am a Property Owner
                        </button>
                    </div>

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Full Name</label>
                        <div className="relative">
                            <input 
                                type="text"
                                required
                                autoComplete="name"
                                placeholder="Rahul Kumar"
                                className="form-input pl-4"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Email Address</label>
                        <div className="relative">
                            <input 
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="rahul@university.edu"
                                className="form-input pl-4"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Mobile Number</label>
                        <div className="relative">
                            <input 
                                type="tel"
                                required
                                autoComplete="tel"
                                placeholder="9876543210"
                                className="form-input pl-4"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Password</label>
                        <div className="relative">
                            <input 
                                type="password"
                                required
                                autoComplete="new-password"
                                placeholder="Minimum 6 characters"
                                className="form-input pl-4"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Confirm Password</label>
                        <div className="relative">
                            <input 
                                type="password"
                                required
                                autoComplete="new-password"
                                placeholder="Confirm your password"
                                className="form-input pl-4"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full py-3 mt-2"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <span>Create Account</span>
                        )}
                    </button>
                </form>

                <div className="text-center mt-6 text-xs text-slate-400">
                    Already have an account?{' '}
                    <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold underline">
                        Sign In
                    </Link>
                </div>
            </div>
        </div>
    );
}
