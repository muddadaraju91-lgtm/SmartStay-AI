import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsService, bookingService, hostelService } from '../services/api';
import { LayoutDashboard, PlusCircle, CheckCircle, XCircle, Users, Hotel, TrendingUp, HelpCircle, ShieldCheck, Loader2 } from 'lucide-react';

export default function Dashboard() {
    const { isOwner, isAdmin } = useAuth();
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const res = await analyticsService.getDashboard();
            setMetrics(res.data);
        } catch (err) {
            console.error('Error loading dashboard analytics:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateBookingStatus = async (bookingId, newStatus) => {
        try {
            await bookingService.updateStatus(bookingId, newStatus);
            alert(`Booking has been: ${newStatus}`);
            fetchDashboardData();
        } catch (err) {
            alert(err.message || 'Action execution failed');
        }
    };

    const handleVerifyHostel = async (hostelId, status) => {
        try {
            await hostelService.verify(hostelId, status);
            alert(`Property listing verification updated to: ${status}`);
            fetchDashboardData();
        } catch (err) {
            alert(err.message || 'Verification failed');
        }
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (!metrics) {
        return (
            <div className="flex-grow flex items-center justify-center text-slate-400">
                Dashboard analytics unavailable.
            </div>
        );
    }

    return (
        <div className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-900 pb-5">
                <div>
                    <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
                        <LayoutDashboard className="w-8 h-8 text-brand-400" />
                        {isOwner ? 'Owner Console' : 'Administrator Control'}
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        {isOwner ? 'Track property occupancy, booking requests, and revenues.' : 'Moderate properties and manage KYC registration queues.'}
                    </p>
                </div>

                {isOwner && (
                    <Link to="/add-hostel" className="btn-primary py-2.5 text-xs">
                        <PlusCircle className="w-4 h-4" /> Add Property Listing
                    </Link>
                )}
            </div>

            {/* OWNER PORTAL DASHBOARD VIEW */}
            {isOwner && (
                <div className="space-y-8">
                    {/* Analytics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                        {/* Occupancy Card */}
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900 space-y-2">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Occupancy Rate</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-3xl font-extrabold text-white">{metrics.occupancyRate}%</span>
                                <TrendingUp className="w-5 h-5 text-emerald-400" />
                            </div>
                        </div>

                        {/* Revenue Card */}
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900 space-y-2">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Monthly Income</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-3xl font-extrabold text-white">₹{metrics.monthlyRevenue}</span>
                                <span className="text-xs text-brand-400 font-semibold">INR</span>
                            </div>
                        </div>

                        {/* Bookings Card */}
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900 space-y-2">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Total Bookings</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-3xl font-extrabold text-white">{metrics.totalBookings}</span>
                                <Users className="w-5 h-5 text-indigo-400" />
                            </div>
                        </div>

                        {/* Vacancy Card */}
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900 space-y-2">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Vacancy Rate</span>
                            <div className="flex justify-between items-baseline">
                                <span className="text-3xl font-extrabold text-white">{metrics.vacancyRate}%</span>
                                <Hotel className="w-5 h-5 text-amber-400" />
                            </div>
                        </div>
                    </div>

                    {/* Booking Requests Table */}
                    <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                        <div className="p-5 border-b border-slate-900">
                            <h2 className="text-lg font-bold text-white">Incoming Guest Requests</h2>
                        </div>
                        <div className="overflow-x-auto">
                            {metrics.recentBookings && metrics.recentBookings.length > 0 ? (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-semibold uppercase">
                                            <th className="p-4">Guest</th>
                                            <th className="p-4">Room Category</th>
                                            <th className="p-4">Check-in Date</th>
                                            <th className="p-4">Deposit</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-center">Operational Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900 text-slate-300">
                                        {metrics.recentBookings.map(booking => (
                                            <tr key={booking.id} className="hover:bg-slate-900/20">
                                                <td className="p-4 font-semibold text-white">{booking.student_name}</td>
                                                <td className="p-4">{booking.room_type}</td>
                                                <td className="p-4">{new Date(booking.check_in_date).toLocaleDateString()}</td>
                                                <td className="p-4 font-semibold">₹{booking.total_amount}</td>
                                                <td className="p-4 capitalize">{booking.status}</td>
                                                <td className="p-4 flex justify-center gap-2">
                                                    {booking.status === 'pending' && (
                                                        <>
                                                            <button 
                                                                onClick={() => handleUpdateBookingStatus(booking.id, 'approved')}
                                                                className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/20"
                                                                title="Approve Guest"
                                                            >
                                                                <CheckCircle className="w-4 h-4" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleUpdateBookingStatus(booking.id, 'rejected')}
                                                                className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded hover:bg-red-500/20"
                                                                title="Reject Guest"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {booking.status !== 'pending' && (
                                                        <span className="text-slate-500 text-[10px]">Decision Locked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-slate-500 italic">No reservation requests registered yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN PORTAL DASHBOARD VIEW */}
            {isAdmin && (
                <div className="space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Platform Students</span>
                            <span className="text-3xl font-extrabold text-white block mt-1">{metrics.totalStudents}</span>
                        </div>
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Platform Landlords</span>
                            <span className="text-3xl font-extrabold text-white block mt-1">{metrics.totalOwners}</span>
                        </div>
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Properties Listed</span>
                            <span className="text-3xl font-extrabold text-white block mt-1">{metrics.totalHostels} ({metrics.verifiedHostels} verified)</span>
                        </div>
                        <div className="glass-panel p-5 rounded-2xl border border-slate-900">
                            <span className="text-[10px] uppercase text-slate-500 font-bold block">Global Platform Revenue</span>
                            <span className="text-3xl font-extrabold text-emerald-400 block mt-1">₹{metrics.totalRevenue}</span>
                        </div>
                    </div>

                    {/* Verification queue */}
                    <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden">
                        <div className="p-5 border-b border-slate-900">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-brand-400" />
                                Hostel Verification Queue ({metrics.verificationQueue?.length || 0})
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            {metrics.verificationQueue && metrics.verificationQueue.length > 0 ? (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900/60 border-b border-slate-900 text-slate-400 font-semibold uppercase">
                                            <th className="p-4">Property Name</th>
                                            <th className="p-4">Host Landlord</th>
                                            <th className="p-4">Address Coordinates</th>
                                            <th className="p-4">Onboarded Date</th>
                                            <th className="p-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-900 text-slate-300">
                                        {metrics.verificationQueue.map(hostel => (
                                            <tr key={hostel.id} className="hover:bg-slate-900/20">
                                                <td className="p-4 font-semibold text-white">{hostel.name}</td>
                                                <td className="p-4">{hostel.owner_name}</td>
                                                <td className="p-4 max-w-[200px] truncate">{hostel.address}</td>
                                                <td className="p-4">{new Date(hostel.created_at).toLocaleDateString()}</td>
                                                <td className="p-4 flex justify-center gap-2">
                                                    <button 
                                                        onClick={() => handleVerifyHostel(hostel.id, true)}
                                                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/20 font-semibold"
                                                    >
                                                        Verify Property
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-slate-500 italic">No listings awaiting verification audits.</div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
