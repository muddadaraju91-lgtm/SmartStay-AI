import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Calendar, Shield } from 'lucide-react';

export default function Profile() {
    const { user } = useAuth();

    return (
        <div className="flex-grow flex items-center justify-center py-16 px-4 relative">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-brand-500/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative z-10 shadow-2xl border border-slate-900 animate-slide-up space-y-6">
                <div className="text-center pb-6 border-b border-slate-900">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center border-2 border-brand-500 mx-auto mb-4 shadow-lg">
                        <User className="w-10 h-10 text-brand-400" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-white">{user?.name}</h2>
                    <span className="inline-block px-2.5 py-0.5 mt-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-xs font-semibold capitalize">
                        {user?.role} Portal
                    </span>
                </div>

                <div className="space-y-4 text-sm text-slate-300">
                    <div className="flex items-center gap-3.5 p-3 bg-slate-900/40 rounded-xl border border-slate-900">
                        <Mail className="w-5 h-5 text-brand-400" />
                        <div>
                            <span className="text-[10px] text-slate-500 block">Email Address</span>
                            <span>{user?.email}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 bg-slate-900/40 rounded-xl border border-slate-900">
                        <Phone className="w-5 h-5 text-brand-400" />
                        <div>
                            <span className="text-[10px] text-slate-500 block">Mobile Contact</span>
                            <span>{user?.phone}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 bg-slate-900/40 rounded-xl border border-slate-900">
                        <Shield className="w-5 h-5 text-brand-400" />
                        <div>
                            <span className="text-[10px] text-slate-500 block">User Access Role</span>
                            <span className="capitalize">{user?.role}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
