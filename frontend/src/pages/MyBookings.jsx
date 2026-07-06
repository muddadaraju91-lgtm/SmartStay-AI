import React, { useEffect, useState } from 'react';
import { bookingService, paymentService } from '../services/api';
import { Calendar, CreditCard, ShieldAlert, CheckCircle2, RefreshCw, HelpCircle, Loader2 } from 'lucide-react';

export default function MyBookings() {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [paymentLoading, setPaymentLoading] = useState(null); // Tracks booking ID being paid

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const res = await bookingService.getAll();
            setBookings(res.data.bookings || []);
        } catch (err) {
            console.error('Error fetching bookings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentCheckout = async (booking) => {
        setPaymentLoading(booking.id);
        try {
            // 1. Create order
            const orderRes = await paymentService.createOrder(booking.id);
            const orderData = orderRes.data;

            if (orderData.isMock) {
                // Bypass Razorpay Checkout UI and invoke mock payment verification immediately
                alert('Mock payment mode: Simulating checkout transaction verification.');
                await paymentService.verifyPayment({
                    bookingId: booking.id,
                    razorpay_order_id: orderData.order_id,
                    isMock: true
                });
                alert('Payment Confirmed!');
                fetchBookings();
                return;
            }

            // 2. Production Razorpay Checkout SDK Script integration
            const options = {
                key: orderData.key_id,
                amount: orderData.amount * 100,
                currency: 'INR',
                name: 'SmartStay AI',
                description: 'Student Stay Booking Deposit',
                order_id: orderData.order_id,
                handler: async function (response) {
                    try {
                        await paymentService.verifyPayment({
                            bookingId: booking.id,
                            razorpay_order_id: orderData.order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        alert('Payment processed successfully. Booking confirmed!');
                        fetchBookings();
                    } catch (err) {
                        alert(err.message || 'Signature verification failed');
                    }
                },
                theme: {
                    color: '#4f69ff'
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (err) {
            alert(err.message || 'Payment failed to initialize');
        } finally {
            setPaymentLoading(null);
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'paid':
                return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
            case 'approved':
                return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
            case 'rejected':
            case 'cancelled':
                return 'bg-red-500/10 border-red-500/20 text-red-400';
            default:
                return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
        }
    };

    return (
        <div className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white">My Bookings</h1>
                    <p className="text-sm text-slate-400 mt-1">Check status, invoices, and settle outstanding stay dues.</p>
                </div>
                <button 
                    onClick={fetchBookings} 
                    className="p-2 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors"
                >
                    <RefreshCw className="w-4 h-4 text-slate-300" />
                </button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-[150px] bg-slate-900/50 rounded-2xl border border-slate-850 animate-pulse"></div>
                    ))}
                </div>
            ) : bookings.length > 0 ? (
                <div className="space-y-6">
                    {bookings.map(booking => (
                        <div key={booking.id} className="glass-card rounded-2xl overflow-hidden p-6 border border-slate-900 flex flex-col md:flex-row justify-between gap-6">
                            
                            {/* Left Info Column */}
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-sm font-semibold text-slate-400">Order #{booking.id}</span>
                                    <span className={`px-2.5 py-0.5 border rounded-full text-[10px] font-semibold uppercase ${getStatusStyle(booking.status)}`}>
                                        {booking.status}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-white">{booking.hostel_name}</h3>
                                <p className="text-xs text-slate-400">{booking.hostel_address}</p>

                                <div className="flex items-center gap-6 text-xs text-slate-400 pt-1">
                                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-brand-400" /> Check-in: {new Date(booking.check_in_date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-brand-400" /> Pay Mode: {booking.payment_mode}</span>
                                </div>
                            </div>

                            {/* Right Action Column */}
                            <div className="md:w-[200px] flex flex-col justify-between items-end shrink-0 border-t md:border-t-0 md:border-l border-slate-900 pt-4 md:pt-0 md:pl-6">
                                <div className="text-right w-full mb-3 md:mb-0">
                                    <span className="text-[10px] uppercase text-slate-500 block">Total Due</span>
                                    <span className="text-2xl font-extrabold text-white">₹{booking.total_amount}</span>
                                </div>

                                {booking.status === 'pending' && booking.payment_mode === 'online' && (
                                    <button
                                        onClick={() => handlePaymentCheckout(booking)}
                                        disabled={paymentLoading === booking.id}
                                        className="btn-primary w-full py-2 text-xs flex justify-center items-center"
                                    >
                                        {paymentLoading === booking.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Pay Online Deposit'
                                        )}
                                    </button>
                                )}

                                {booking.status === 'pending' && booking.payment_mode === 'offline' && (
                                    <div className="text-xs text-amber-500 font-semibold border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 rounded-lg text-center w-full">
                                        Awaiting landlord cash approval
                                    </div>
                                )}

                                {booking.status === 'paid' && (
                                    <div className="text-xs text-emerald-400 font-semibold border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 rounded-lg text-center w-full flex items-center justify-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4" /> Paid & Confirmed
                                    </div>
                                )}
                            </div>

                        </div>
                    ))}
                </div>
            ) : (
                <div className="glass-panel p-16 rounded-2xl flex flex-col items-center justify-center text-center">
                    <Calendar className="w-12 h-12 text-slate-500 mb-4 animate-pulse" />
                    <h3 className="text-lg font-bold text-white mb-1">No Active Stay Bookings</h3>
                    <p className="text-xs text-slate-400 max-w-sm mb-4">You haven't requested any room reservations yet. Find properties in our portal.</p>
                </div>
            )}
        </div>
    );
}
