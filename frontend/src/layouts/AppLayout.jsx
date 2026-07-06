import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function AppLayout({ children }) {
    return (
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
            <Navbar />
            <main className="flex-grow flex flex-col w-full">
                {children}
            </main>
            <Footer />
        </div>
    );
}
