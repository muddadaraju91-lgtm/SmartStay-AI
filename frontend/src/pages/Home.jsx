import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hostelService } from '../services/api';
import { Search, Compass, ShieldCheck, Sparkles, AlertCircle, MapPin, BadgePercent, Star } from 'lucide-react';

export default function Home() {
    const { isAuthenticated, isStudent, user } = useAuth();
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isAuthenticated && isStudent) {
            fetchRecommendations();
        }
    }, [isAuthenticated, isStudent]);

  const fetchRecommendations = async () => {
    setLoading(true);

    try {

        const res = await hostelService.getRecommendations({
            budget: 12000,
            latitude: 12.9716,
            longitude: 77.5946,
        });

        setRecommendations(res.data.recommendations || []);

    } catch (err) {

        console.error(
            'Failed to load personalized recommendations:',
            err
        );

    } finally {

        setLoading(false);

    }
};

    return (
        <div className="flex-grow flex flex-col items-center">
            {/* Hero Section */}
            <div className="w-full relative overflow-hidden py-24 sm:py-32 bg-gradient-to-b from-slate-900 to-slate-950 flex flex-col items-center justify-center px-4">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[120px] pointer-events-none"></div>
                
                <div className="max-w-4xl text-center space-y-6 animate-slide-up relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs text-brand-400 font-semibold mb-2 shadow-inner">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Powered by Concurrency-Safe Booking Engines</span>
                    </div>
                    
                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-none text-white">
                        Find Student Stays with <br />
                        <span className="bg-gradient-to-r from-brand-400 via-indigo-400 to-indigo-600 bg-clip-text text-transparent">
                            Absolute Trust & Transparency
                        </span>
                    </h1>
                    
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        Say goodbye to fake postings and overbookings. SmartStay AI links search parameters, real-time vacancy locking, and verified review trust metrics.
                    </p>

                    {/* Search Bar Redirect */}
                    <div className="max-w-xl mx-auto pt-4 flex flex-col sm:flex-row items-center gap-3">
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                            <input 
                                type="text"
                                placeholder="Enter college name or city area..."
                                className="form-input pl-12 py-3.5 text-sm glass-panel focus:ring-brand-500"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Link 
                            to={`/search?search=${encodeURIComponent(searchQuery)}`}
                            className="btn-primary w-full sm:w-auto py-3.5 px-6 whitespace-nowrap text-sm"
                        >
                            <Compass className="w-4 h-4" />
                            Explore Stays
                        </Link>
                    </div>
                </div>
            </div>

            {/* Personalized Recommendations Section (Only for Logged In Students) */}
            {isAuthenticated && isStudent && (
                <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 animate-fade-in">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 border-b border-slate-950 pb-4">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-brand-400" />
                                Recommended for You, {user?.name}
                            </h2>
                            <p className="text-sm text-slate-400 mt-1">Based on location proximity, amenities matching, and properties trust scores.</p>
                        </div>
                        <Link to="/search" className="text-sm font-semibold text-brand-400 hover:text-brand-300">
                            See all listings &rarr;
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-[350px] bg-slate-900/50 rounded-2xl animate-pulse border border-slate-800"></div>
                            ))}
                        </div>
                    ) : recommendations.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {recommendations.map(hostel => (
                                <div key={hostel.id} className="glass-card rounded-2xl overflow-hidden p-5 flex flex-col justify-between h-[380px]">
                                    <div>
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-xs font-semibold">
                                                <Sparkles className="w-3.5 h-3.5" />
                                                <span>{hostel.matchScore}% Match</span>
                                            </div>
                                            <span className="text-xs text-slate-500 flex items-center gap-1">
                                                <MapPin className="w-3.5 h-3.5" />
                                                {hostel.distance} km
                                            </span>
                                        </div>

                                        {/* Title */}
                                        <h3 className="text-lg font-bold text-white mb-1 truncate">{hostel.name}</h3>
                                        <p className="text-xs text-slate-400 line-clamp-2 mb-4">{hostel.address}</p>

                                        {/* Match Score Bar */}
                                        <div className="mb-4">
                                            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                <div 
                                                    className="bg-gradient-to-r from-brand-500 to-indigo-500 h-1.5 rounded-full"
                                                    style={{ width: `${hostel.matchScore}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Trust Score & Price */}
                                        <div className="flex justify-between items-center bg-slate-900/30 p-3 rounded-xl border border-slate-800/40 mb-4">
                                            <div>
                                                <span className="text-[10px] uppercase text-slate-500 block">Trust Score</span>
                                                <span className="text-sm font-extrabold text-emerald-400">{hostel.trust_score}%</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase text-slate-500 block">Starting rent</span>
                                                <span className="text-sm font-extrabold text-white">₹{hostel.starting_price}/mo</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <Link to={`/hostels/${hostel.id}`} className="btn-primary w-full py-2.5 text-xs">
                                        View Rooms & Book
                                    </Link>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="glass-panel p-8 rounded-2xl flex flex-col items-center justify-center text-center">
                            <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
                            <p className="text-sm text-slate-400">No matching recommendations found for this area yet. Try expanding search coordinates!</p>
                        </div>
                    )}
                </section>
            )}

            {/* Core Pillars / Value Proposition */}
            <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-slate-900 bg-slate-950">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-3xl font-extrabold tracking-tight text-white">Engineering Standout Features</h2>
                    <p className="text-sm text-slate-400 mt-2">Why SmartStay AI stands apart from standard university academic projects.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Pillar 1 */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <div className="p-3 bg-brand-600/20 text-brand-400 rounded-xl border border-brand-500/20 w-fit">
                            <Compass className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Real-Time Concurrency Lock</h3>
                        <p className="text-xs text-slate-400">
                            Implements exclusive transactional locks (SQL Select For Update) preventing room overbooking issues when multiple users try booking the last vacancy.
                        </p>
                    </div>

                    {/* Pillar 2 */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20 w-fit">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Verified Reviews</h3>
                        <p className="text-xs text-slate-400">
                            A secure closed-loop ratings platform. Only student entities with successful payment logs or completed bookings in DB can submit reviews.
                        </p>
                    </div>

                    {/* Pillar 3 */}
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-500/20 w-fit">
                            <Star className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-bold text-white">Hostel Trust Score</h3>
                        <p className="text-xs text-slate-400">
                            Uses a composite ranking model checking KYC parameters, landlord response delays, reviews average, and cancellation rates.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
}
