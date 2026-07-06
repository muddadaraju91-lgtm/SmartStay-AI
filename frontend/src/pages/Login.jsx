import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, ArrowRight } from 'lucide-react';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await login(email, password);
            if (user.role === 'student') {
                navigate('/');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message || 'Invalid email or password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-grow flex items-center justify-center py-16 px-4 relative">
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-500/10 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative z-10 shadow-2xl border border-slate-900 animate-slide-up">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-white">Welcome Back</h2>
                    <p className="text-sm text-slate-400 mt-2">Sign in to manage your bookings and properties.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-400">Email Address</label>
                        <div className="relative">
                            <input 
                                type="email"
                                required
                                placeholder="student@college.edu"
                                className="form-input pl-4"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-semibold text-slate-400">Password</label>
                        </div>
                        <div className="relative">
                            <input 
                                type="password"
                                required
                                placeholder="••••••••"
                                className="form-input pl-4"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="btn-primary w-full py-3"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <span>Sign In</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="text-center mt-6 text-xs text-slate-400">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-brand-400 hover:text-brand-300 font-semibold underline">
                        Sign up now
                    </Link>
                </div>
            </div>
        </div>
    );
}
