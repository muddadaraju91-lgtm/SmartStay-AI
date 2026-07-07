const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const { recalculateTrustScore } = require('../services/trustScoreEngine');

// Shared error handler for the non-blocking trust score recalculation.
// Kept at module level so it appears with a clear name in stack traces.
// Non-blocking: the caller's response has already been sent before this fires.
function onTrustScoreError(hostelId, err) {
    console.error(
        '[trustScore] Recalculation failed for hostelId=%d — %s',
        hostelId,
        err.message,
        err.stack ? '\n' + err.stack : ''
    );
}

// @desc    Add review for a hostel property
// @route   POST /api/reviews
// @access  Private (Student Only)
const addReview = async (req, res, next) => {
    try {
        const { hostelId, rating, comment } = req.body;
        const studentId = req.user.id;

        if (!hostelId || !rating) {
            return ApiResponse.error(res, 'Required fields: hostelId, rating', 400);
        }

        const numericRating = parseInt(rating);
        if (numericRating < 1 || numericRating > 5) {
            return ApiResponse.error(res, 'Rating must be an integer between 1 and 5', 400);
        }

        // Verify if the student has a booking for this hostel to mark review as "verified"
        const [bookings] = await pool.query(
            `SELECT b.id 
             FROM bookings b
             JOIN rooms r ON b.room_id = r.id
             WHERE b.student_id = ? AND r.hostel_id = ? AND b.status IN ('paid', 'approved')`,
            [studentId, hostelId]
        );

        const isVerifiedBooking = bookings.length > 0;

        // Insert review
        await pool.query(
            `INSERT INTO reviews (student_id, hostel_id, rating, comment, is_verified_booking) 
             VALUES (?, ?, ?, ?, ?)`,
            [studentId, hostelId, numericRating, comment || '', isVerifiedBooking]
        );

        // Fire-and-forget: recalculate trust score without blocking the response.
        // The .catch() ensures any rejection (including errors that escape the
        // engine's own try/catch, e.g. a synchronous throw before the first await)
        // produces a visible log entry rather than an unhandled promise rejection.
        recalculateTrustScore(hostelId)
            .catch(err => onTrustScoreError(hostelId, err));

        return ApiResponse.success(res, 'Review added successfully', { isVerifiedBooking }, 201);

    } catch (err) {
        next(err);
    }
};

// @desc    Get reviews for a hostel listing
// @route   GET /api/reviews
// @access  Public
const getReviews = async (req, res, next) => {
    try {
        const { hostelId } = req.query;

        if (!hostelId) {
            return ApiResponse.error(res, 'hostelId query parameter is required', 400);
        }

        const [reviews] = await pool.query(
            `SELECT r.*, u.name as student_name 
             FROM reviews r
             JOIN users u ON r.student_id = u.id
             WHERE r.hostel_id = ?
             ORDER BY r.created_at DESC`,
            [hostelId]
        );

        return ApiResponse.success(res, 'Reviews retrieved successfully', { reviews });

    } catch (err) {
        next(err);
    }
};

// @desc    Delete review (Admin/Owner Moderation)
// @route   DELETE /api/reviews/:id
// @access  Private (Admin / Owner / Student)
const deleteReview = async (req, res, next) => {
    try {
        const reviewId = parseInt(req.params.id);
        const userId = req.user.id;
        const userRole = req.user.role;

        // Get review details
        const [reviews] = await pool.query('SELECT student_id, hostel_id FROM reviews WHERE id = ?', [reviewId]);
        if (reviews.length === 0) {
            return ApiResponse.error(res, 'Review not found', 404);
        }

        const review = reviews[0];

        // Owner check
        let isAuthorized = userRole === 'admin' || review.student_id === userId;
        
        if (!isAuthorized && userRole === 'owner') {
            // Verify if owner owns the hostel associated with this review
            const [hostels] = await pool.query('SELECT owner_id FROM hostels WHERE id = ?', [review.hostel_id]);
            if (hostels.length > 0 && hostels[0].owner_id === userId) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            return ApiResponse.error(res, 'Unauthorized to moderate this review', 403);
        }

        await pool.query('DELETE FROM reviews WHERE id = ?', [reviewId]);

        // Fire-and-forget: same pattern as addReview — non-blocking with explicit catch.
        recalculateTrustScore(review.hostel_id)
            .catch(err => onTrustScoreError(review.hostel_id, err));

        return ApiResponse.success(res, 'Review deleted successfully');

    } catch (err) {
        next(err);
    }
};

module.exports = {
    addReview,
    getReviews,
    deleteReview
};
