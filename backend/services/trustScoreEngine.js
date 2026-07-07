const pool = require('../config/db');
const hostelCache = require('./hostelCache');

/**
 * Dynamically computes and updates the Trust Score (0-100) of a hostel property.
 * Trust Score = 0.4 * VerificationStatus + 0.3 * AverageRating + 0.2 * HostResponseRate - 0.1 * BookingCancellationRate
 * @param {number} hostelId 
 */
const recalculateTrustScore = async (hostelId) => {
    try {
        // 1. Get verification status
        const [hostels] = await pool.query('SELECT is_verified FROM hostels WHERE id = ?', [hostelId]);
        if (hostels.length === 0) return;

        const isVerified = hostels[0].is_verified ? 100.00 : 0.00;

        // 2. Calculate average rating
        const [reviewRows] = await pool.query(
            'SELECT AVG(rating) as avg_rating FROM reviews WHERE hostel_id = ?',
            [hostelId]
        );
        const averageRating = reviewRows[0].avg_rating ? parseFloat(reviewRows[0].avg_rating) * 20 : 60.00; // Default to 60 (3-star equivalent) if no reviews

        // 3. Calculate Owner Response Rate and Cancellation Rate from bookings
        const [bookings] = await pool.query(
            `SELECT b.status 
             FROM bookings b
             JOIN rooms r ON b.room_id = r.id
             WHERE r.hostel_id = ?`,
            [hostelId]
        );

        let responseRate = 100.00; // Defaults
        let cancellationRate = 0.00;

        if (bookings.length > 0) {
            const totalBookings = bookings.length;
            const nonPendingBookings = bookings.filter(b => b.status !== 'pending').length;
            const cancelledBookings = bookings.filter(b => b.status === 'cancelled' || b.status === 'rejected').length;

            responseRate = (nonPendingBookings / totalBookings) * 100;
            cancellationRate = (cancelledBookings / totalBookings) * 100;
        }

        // 4. Calculate Composite Trust Score
        let trustScore = (0.4 * isVerified) + (0.3 * averageRating) + (0.2 * responseRate) - (0.1 * cancellationRate);

        // Clamp between 0 and 100
        trustScore = Math.min(100, Math.max(0, parseFloat(trustScore.toFixed(2))));

        // 5. Update Trust Score in database
        await pool.query('UPDATE hostels SET trust_score = ? WHERE id = ?', [trustScore, hostelId]);
        // Bust the recommendation cache so the updated score is reflected immediately.
        hostelCache.invalidate();
        console.log('[trustScore] hostelId=%d updated to %d%%', hostelId, trustScore);

    } catch (err) {
        // Re-throw so the .catch() at the call site can log hostelId in context.
        // Also log here as a secondary safety net (e.g. if called without .catch()).
        console.error('[trustScore] Engine error for hostelId=%d — %s\n%s',
            hostelId, err.message, err.stack || '');
        throw err;
    }
};

module.exports = { recalculateTrustScore };
