const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const { expireStaleBookings } = require('../services/bookingExpiryService');

// ─── Shared helper ────────────────────────────────────────────────────────────
// Returns true when a booking's current status still holds a vacancy slot that
// must be released if the booking moves to a terminal non-occupying state.
// A slot is held from the moment a pending booking is created right up until:
//   - it is paid (online)  → slot stays occupied
//   - it is approved-offline → slot stays occupied (already held from create)
//   - it is cancelled / rejected / expired → slot must be released
const statusHoldsSlot = (status) =>
    status === 'pending' || status === 'approved';

// ─── Create booking ───────────────────────────────────────────────────────────
// @desc    Create a booking request (Concurrency-safe, optimistic slot reserve)
// @route   POST /api/bookings
// @access  Private (Student Only)
const createBooking = async (req, res, next) => {
    let connection;
    try {
        const { roomId, checkInDate, paymentMode } = req.body;
        const studentId = req.user.id;

        if (!roomId || !checkInDate || !paymentMode) {
            return ApiResponse.error(res, 'Required fields: roomId, checkInDate, paymentMode', 400);
        }

        if (!['online', 'offline'].includes(paymentMode)) {
            return ApiResponse.error(res, 'Invalid payment mode selected', 400);
        }

        // Lazily expire any stale pending bookings for this room before checking
        // vacancy so a timed-out hold does not block a new legitimate request.
        await expireStaleBookings(roomId);

        // Get a dedicated connection for the transaction so the row lock
        // (SELECT … FOR UPDATE) is scoped to a single connection object.
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Lock the room row exclusively to prevent concurrent vacancy races.
        const [roomRows] = await connection.query(
            'SELECT price, vacant_rooms, total_rooms, hostel_id FROM rooms WHERE id = ? FOR UPDATE',
            [roomId]
        );

        if (roomRows.length === 0) {
            await connection.rollback();
            connection.release();
            return ApiResponse.error(res, 'Room category not found', 404);
        }

        const room = roomRows[0];

        // 2. Vacancy gate — checked while the row lock is held.
        if (room.vacant_rooms <= 0) {
            await connection.rollback();
            connection.release();
            return ApiResponse.error(res, 'Booking failed: No vacancies remaining in this room category', 400);
        }

        const totalAmount = room.price;

        // 3. Insert the booking record.
        const [bookingResult] = await connection.query(
            `INSERT INTO bookings (student_id, room_id, check_in_date, status, payment_mode, total_amount)
             VALUES (?, ?, ?, 'pending', ?, ?)`,
            [studentId, roomId, checkInDate, paymentMode, totalAmount]
        );

        const bookingId = bookingResult.insertId;

        // 4. OPTIMISTIC SLOT RESERVE — decrement vacant_rooms immediately.
        //    This is the single canonical point where the slot is claimed.
        //    All compensating restores (reject / cancel / expiry / payment failure)
        //    will increment it back exactly once.
        await connection.query(
            'UPDATE rooms SET vacant_rooms = vacant_rooms - 1 WHERE id = ?',
            [roomId]
        );

        await connection.commit();
        connection.release();

        return ApiResponse.success(res, 'Booking request registered successfully', {
            bookingId,
            status: 'pending',
            totalAmount,
            paymentMode
        }, 201);

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        next(err);
    }
};

// ─── List bookings ────────────────────────────────────────────────────────────
// @desc    Get user's booking history or owner's incoming requests
// @route   GET /api/bookings
// @access  Private
const getBookings = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        let query = `
            SELECT b.*, r.type_name as room_type, r.price as room_price,
                   h.name as hostel_name, h.address as hostel_address, h.id as hostel_id,
                   u.name as student_name, u.phone as student_phone, u.email as student_email
            FROM bookings b
            JOIN rooms r ON b.room_id = r.id
            JOIN hostels h ON r.hostel_id = h.id
            JOIN users u ON b.student_id = u.id
        `;
        const queryParams = [];

        if (userRole === 'student') {
            query += ' WHERE b.student_id = ?';
            queryParams.push(userId);
        } else if (userRole === 'owner') {
            query += ' WHERE h.owner_id = ?';
            queryParams.push(userId);
        }
        // Admin: no filter — sees all records

        query += ' ORDER BY b.created_at DESC';

        const [bookings] = await pool.query(query, queryParams);
        return ApiResponse.success(res, 'Bookings history retrieved successfully', { bookings });

    } catch (err) {
        next(err);
    }
};

// ─── Update booking status ────────────────────────────────────────────────────
// @desc    Owner approves / rejects, or student/admin cancels a booking.
// @route   PUT /api/bookings/:id/status
// @access  Private (Owner / Admin)
//
// vacant_rooms invariant after the optimistic-reserve fix:
//   • pending  → approved  : no inventory change (slot already reserved at create)
//   • pending  → rejected  : +1 restore (release the held slot)
//   • pending  → cancelled : +1 restore (release the held slot)
//   • approved → cancelled : +1 restore (release the held slot)
//   • paid     → cancelled : +1 restore (release the occupied slot)
//   • any      → approved  (online): not applicable — online path goes through verifyPayment
const updateBookingStatus = async (req, res, next) => {
    let connection;
    try {
        const bookingId = parseInt(req.params.id);
        const { status } = req.body;
        const requestUserId = req.user.id;
        const requestUserRole = req.user.role;

        if (!['approved', 'rejected', 'cancelled'].includes(status)) {
            return ApiResponse.error(res, 'Invalid booking status. Allowed: approved, rejected, cancelled', 400);
        }

        // Fetch booking details (outside transaction — read-only, no lock needed yet)
        const [bookingRows] = await pool.query(
            `SELECT b.*, r.hostel_id, h.owner_id
             FROM bookings b
             JOIN rooms r ON b.room_id = r.id
             JOIN hostels h ON r.hostel_id = h.id
             WHERE b.id = ?`,
            [bookingId]
        );

        if (bookingRows.length === 0) {
            return ApiResponse.error(res, 'Booking record not found', 404);
        }

        const booking = bookingRows[0];

        // Authorization: owner must own the hostel; admin bypasses.
        if (booking.owner_id !== requestUserId && requestUserRole !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized booking operation access', 403);
        }

        // Guard against no-op or illegal state transitions.
        if (booking.status === status) {
            return ApiResponse.error(res, `Booking is already in '${status}' state`, 400);
        }
        if (['paid', 'rejected', 'cancelled'].includes(booking.status)) {
            return ApiResponse.error(res, `Cannot change status of a booking that is already '${booking.status}'`, 400);
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock the room row for all inventory-changing operations.
        await connection.query(
            'SELECT vacant_rooms FROM rooms WHERE id = ? FOR UPDATE',
            [booking.room_id]
        );

        // ── Inventory adjustments ─────────────────────────────────────────────
        //
        // APPROVE (offline payment mode):
        //   • The slot was already decremented at create time.
        //   • No inventory change needed here — just advance the state.
        //
        // REJECT or CANCEL (from pending or approved):
        //   • The slot was decremented at create time.
        //   • Release it back exactly once.
        //
        // CANCEL (from paid):
        //   • The slot was decremented at create time; payment confirmed occupancy.
        //   • Still release it back exactly once.
        const shouldReleaseSlot =
            (status === 'rejected' || status === 'cancelled') &&
            statusHoldsSlot(booking.status);

        const shouldReleaseFromPaid =
            status === 'cancelled' && booking.status === 'paid';

        if (shouldReleaseSlot || shouldReleaseFromPaid) {
            await connection.query(
                'UPDATE rooms SET vacant_rooms = vacant_rooms + 1 WHERE id = ?',
                [booking.room_id]
            );
        }

        // Advance the booking state.
        await connection.query(
            'UPDATE bookings SET status = ? WHERE id = ?',
            [status, bookingId]
        );

        // Notify the student.
        const notificationMsg =
            `Your booking #${bookingId} has been ${status}.`;
        await connection.query(
            'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
            [booking.student_id, notificationMsg]
        );

        await connection.commit();
        connection.release();

        return ApiResponse.success(res, `Booking status updated to: ${status}`);

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        next(err);
    }
};

module.exports = {
    createBooking,
    getBookings,
    updateBookingStatus
};
