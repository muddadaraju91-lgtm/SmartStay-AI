import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { hostelService, bookingService, reviewService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { MapPin, Compass, Phone, Sparkles, Star, Calendar, CreditCard, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react';

export default function HostelDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, isStudent } = useAuth();
    const toast = useToast();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [bookingRoom, setBookingRoom] = useState(null); // Selected room for booking modal
    const [checkInDate, setCheckInDate] = useState('');
    const [paymentMode, setPaymentMode] = useState('online');
    
    // Booking transaction states
    const [bookingLoading, setBookingLoading] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [bookingId, setBookingId] = useState(null);

    // Reviews states
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [reviewError, setReviewError] = useState('');
    const [reviewSuccess, setReviewSuccess] = useState(false);

    useEffect(() => {
        fetchHostelDetails();
    }, [id]);

    const fetchHostelDetails = async () => {
        setLoading(true);
        try {
            const res = await hostelService.getById(id);
            setData(res.data);
        } catch (err) {
            console.error('Error loading hostel details:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBooking = async (e) => {
        e.preventDefault();
        if (!isAuthenticated) {
            return navigate('/login');
        }

        setBookingLoading(true);
        try {
            const res = await bookingService.create({
                roomId: bookingRoom.id,
                checkInDate,
                paymentMode
            });
            setBookingId(res.data.bookingId);
            setBookingSuccess(true);
        } catch (err) {
            toast.error(err.message || 'Booking request failed');
        } finally {
            setBookingLoading(false);
        }
    };

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        setReviewError('');
        setReviewSuccess(false);

        try {
            await reviewService.create({
                hostelId: id,
                rating,
                comment
            });
            setReviewSuccess(true);
            setComment('');
            fetchHostelDetails(); // Refresh reviews list
        } catch (err) {
            setReviewError(err.message || 'Failed to submit review. Ensure you have an active stay booking.');
        }
    };

    if (loading) {
        return (
            <div className="flex-grow flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex-grow flex items-center justify-center text-slate-400 text-sm">
                Hostel details not found.
            </div>
        );
    }

    const { hostel, rooms, reviews, averageRating, reviewCount } = data;

    return (
        <div className="flex-grow max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fade-in">
            {/* Top Detail Card */}
            <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-900 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-brand-500/5 rounded-full blur-[60px] pointer-events-none"></div>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-extrabold text-white">{hostel.name}</h1>
                        {hostel.is_verified && (
                            <span className="px-3 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold flex items-center gap-1">
                                <Compass className="w-3.5 h-3.5" /> Verified Listing
                            </span>
                        )}
                        <span className="px-3 py-0.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-full text-xs font-semibold">
                            Trust Score: {hostel.trust_score}%
                        </span>
                    </div>

                    <p className="text-sm text-slate-400 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-brand-400 shrink-0" />
                        <span>{hostel.address}</span>
                    </p>

                    <p className="text-sm text-slate-300 leading-relaxed max-w-3xl pt-2">
                        {hostel.description || 'No description provided for this stay.'}
                    </p>

                    {/* Contact details */}
                    <div className="flex items-center gap-6 border-t border-slate-900 pt-4 text-xs text-slate-400">
                        <span className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-400" /> Host Contact: {hostel.owner_phone}</span>
                        <span className="flex items-center gap-2"><Star className="w-4 h-4 text-brand-400" /> Rating: {averageRating} / 5 ({reviewCount} reviews)</span>
                    </div>
                </div>
            </div>

            {/* Rooms Section */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-brand-400" />
                    Available Rooms & Pricing
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {rooms.map(room => (
                        <div key={room.id} className="glass-card rounded-2xl p-6 flex flex-col justify-between border border-slate-900">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <h3 className="text-lg font-bold text-white">{room.type_name}</h3>
                                    <span className="text-2xl font-extrabold text-brand-400">₹{room.price}<span className="text-xs text-slate-500 font-normal">/mo</span></span>
                                </div>
                                <div className="text-xs text-slate-400 space-y-1.5 mb-4">
                                    <p>Capacity: {room.capacity} sharing occupant(s)</p>
                                    <p className={`${room.vacant_rooms > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'}`}>
                                        Vacancy: {room.vacant_rooms > 0 ? `${room.vacant_rooms} beds remaining` : 'Fully Occupied'}
                                    </p>
                                </div>
                            </div>

                            {isStudent && room.vacant_rooms > 0 ? (
                                <button 
                                    onClick={() => { setBookingRoom(room); setBookingSuccess(false); }}
                                    className="btn-primary w-full py-2.5 text-xs"
                                >
                                    Instant Book
                                </button>
                            ) : isStudent ? (
                                <button disabled className="btn-secondary w-full py-2.5 text-xs cursor-not-allowed">
                                    Sold Out
                                </button>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Submit review (1/3 pane) */}
                {isStudent && (
                    <div className="glass-panel p-6 rounded-2xl border border-slate-900 h-fit">
                        <h3 className="text-lg font-bold text-white mb-4">Submit Verified Stay Review</h3>
                        {reviewSuccess && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg text-xs mb-4 text-center">
                                Review added successfully!
                            </div>
                        )}
                        {reviewError && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs mb-4 text-center">
                                {reviewError}
                            </div>
                        )}
                        <form onSubmit={handleSubmitReview} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-400">Rating Stars</label>
                                <select 
                                    className="form-input text-xs"
                                    value={rating}
                                    onChange={(e) => setRating(parseInt(e.target.value))}
                                >
                                    <option value={5}>5 Stars (Excellent)</option>
                                    <option value={4}>4 Stars (Very Good)</option>
                                    <option value={3}>3 Stars (Average)</option>
                                    <option value={2}>2 Stars (Poor)</option>
                                    <option value={1}>1 Star (Terrible)</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-400">Feedback Comments</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Write your experience..."
                                    className="form-input text-xs"
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full py-2.5 text-xs">
                                Submit Feedback
                            </button>
                        </form>
                    </div>
                )}

                {/* Reviews List (2/3 pane) */}
                <div className={`space-y-4 ${isStudent ? 'md:col-span-2' : 'md:col-span-3'}`}>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Star className="w-5 h-5 text-brand-400" />
                        Verified Peer Reviews ({reviews.length})
                    </h3>

                    {reviews.length > 0 ? (
                        <div className="space-y-4">
                            {reviews.map(review => (
                                <div key={review.id} className="glass-card p-5 rounded-2xl border border-slate-900 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-white">{review.student_name}</span>
                                            {review.is_verified_booking ? (
                                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wide">
                                                    Verified Booking
                                                </span>
                                            ) : (
                                                <span className="bg-slate-800 text-slate-400 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide">
                                                    Visitor
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex text-amber-500">
                                            {[...Array(review.rating)].map((_, i) => (
                                                <Star key={i} className="w-3.5 h-3.5 fill-amber-500 text-transparent" />
                                            ))}
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">{review.comment || 'No written feedback provided.'}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 italic p-4 bg-slate-900/30 rounded-xl border border-slate-900">No reviews submitted yet for this hostel listing.</p>
                    )}
                </div>
            </div>

            {/* Booking Modal Panel */}
            {bookingRoom && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-slate-900 shadow-2xl relative animate-scale-up">
                        
                        {!bookingSuccess ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                                    <h3 className="text-xl font-bold text-white">Book: {bookingRoom.type_name}</h3>
                                    <button onClick={() => setBookingRoom(null)} className="text-slate-400 hover:text-white">&times;</button>
                                </div>

                                <form onSubmit={handleCreateBooking} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"><Calendar className="w-4 h-4 text-brand-400" /> Check-in Date</label>
                                        <input 
                                            type="date"
                                            required
                                            className="form-input text-xs"
                                            value={checkInDate}
                                            onChange={(e) => setCheckInDate(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-brand-400" /> Payment Strategy</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                type="button"
                                                className={`py-3 text-xs font-semibold rounded-lg border text-center transition-all ${paymentMode === 'online' ? 'bg-brand-600/20 border-brand-500 text-brand-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                                                onClick={() => setPaymentMode('online')}
                                            >
                                                Online Checkout (Razorpay)
                                            </button>
                                            <button
                                                type="button"
                                                className={`py-3 text-xs font-semibold rounded-lg border text-center transition-all ${paymentMode === 'offline' ? 'bg-brand-600/20 border-brand-500 text-brand-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                                                onClick={() => setPaymentMode('offline')}
                                            >
                                                Pay Cash at Property
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-900 pt-4 flex justify-between items-center text-xs">
                                        <span className="text-slate-500">Total rent deposit:</span>
                                        <span className="text-lg font-extrabold text-white">₹{bookingRoom.price}</span>
                                    </div>

                                    <button 
                                        type="submit" 
                                        disabled={bookingLoading}
                                        className="btn-primary w-full py-3 text-xs"
                                    >
                                        {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Booking Order'}
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="text-center py-6 space-y-4">
                                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
                                <h3 className="text-xl font-bold text-white">Booking Order Created</h3>
                                <p className="text-xs text-slate-400">
                                    Your booking request for {bookingRoom.type_name} is saved successfully with ID #{bookingId}.
                                </p>
                                <button 
                                    onClick={() => { setBookingRoom(null); navigate('/my-bookings'); }}
                                    className="btn-primary py-2.5 px-6 mx-auto text-xs"
                                >
                                    Proceed to Payments
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
