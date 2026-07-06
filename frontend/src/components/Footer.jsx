import React from 'react';
import { Mail, Phone, MapPin, Github, Linkedin, Heart } from 'lucide-react';

export default function Footer() {
    return (
        <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 py-12 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    {/* Brand Info */}
                    <div className="space-y-4">
                        <span className="text-lg font-extrabold tracking-tight text-white">
                            SmartStay <span className="text-brand-500">AI</span>
                        </span>
                        <p className="text-sm text-slate-400">
                            Intelligent, secure, and verification-driven housing portal customized for university students.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Quick Links</h4>
                        <ul className="space-y-2 text-sm">
                            <li><a href="/search" className="hover:text-brand-400 transition-colors">Find Accommodation</a></li>
                            <li><a href="/login" className="hover:text-brand-400 transition-colors">Owner Register</a></li>
                            <li><a href="#" className="hover:text-brand-400 transition-colors">Safety Guides</a></li>
                        </ul>
                    </div>

                    {/* Support Contact */}
                    <div>
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Support</h4>
                        <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-400" /> support@smartstay.ai</li>
                            <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-400" /> +91 98765 43210</li>
                            <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-400" /> Bengaluru, India</li>
                        </ul>
                    </div>

                    {/* Social links */}
                    <div>
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Developers Connect</h4>
                        <div className="flex space-x-4">
                            <a href="#" className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all"><Github className="w-4 h-4" /></a>
                            <a href="#" className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all"><Linkedin className="w-4 h-4" /></a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-900 mt-8 pt-8 text-center text-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p>&copy; {new Date().getFullYear()} SmartStay AI. All rights reserved.</p>
                    <p className="flex items-center gap-1">
                        Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> for 2027 Engineering Placement
                    </p>
                </div>
            </div>
        </footer>
    );
}
