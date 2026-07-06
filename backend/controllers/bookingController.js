const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

// @desc    Create a booking request (Concurrency-safe)
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

        // Get connection from pool for transaction isolation
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. SELECT FOR UPDATE - Lock the room record to prevent concurrent updates
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

        // Check vacancy
        if (room.vacant_rooms <= 0) {
            await connection.rollback();
            connection.release();
            return ApiResponse.error(res, 'Booking failed: No vacancies remaining in this room category', 400);
        }

        // Calculate total amount (e.g. 1 month deposit base rent)
        const totalAmount = room.price;

        // If offline payment, booking is pending approval. If online, wait for payment execution.
        const initialStatus = 'pending';

        // 2. Insert booking record
        const [bookingResult] = await connection.query(
            `INSERT INTO bookings (student_id, room_id, check_in_date, status, payment_mode, total_amount) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [studentId, roomId, checkInDate, initialStatus, paymentMode, totalAmount]
        );

        const bookingId = bookingResult.insertId;

        // Commit transaction holding the row locks
        await connection.commit();
        connection.release();

        // Send confirmation back
        return ApiResponse.success(res, 'Booking request registered successfully', {
            bookingId,
            status: initialStatus,
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
        } else if (userRole === 'admin') {
            // Admin can view all records
        }

        query += ' ORDER BY b.created_at DESC';

        const [bookings] = await pool.query(query, queryParams);
        return ApiResponse.success(res, 'Bookings history retrieved successfully', { bookings });

    } catch (err) {
        next(err);
    }
};

// @desc    Handle owner's Approval or Rejection decision on bookings
// @route   PUT /api/bookings/:id/status
// @access  Private (Owner Only)
const updateBookingStatus = async (req, res, next) => {
    let connection;
    try {
        const bookingId = parseInt(req.params.id);
        const { status } = req.body; // 'approved' or 'rejected'
        const ownerId = req.user.id;

        if (!['approved', 'rejected', 'cancelled'].includes(status)) {
            return ApiResponse.error(res, 'Invalid booking status operation', 400);
        }

        // Fetch booking record and ensure owner owns the property
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

        // Owner check (or allow admin override)
        if (booking.owner_id !== ownerId && req.user.role !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized booking operation access', 403);
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Double check inventory safety if approving booking
        if (status === 'approved' && booking.payment_mode === 'offline') {
            // Lock room and check capacity
            const [roomRows] = await connection.query(
                'SELECT vacant_rooms FROM rooms WHERE id = ? FOR UPDATE',
                [booking.room_id]
            );

            if (roomRows[0].vacant_rooms <= 0) {
                await connection.rollback();
                connection.release();
                return ApiResponse.error(res, 'Approval failed: No vacancies remaining in this room', 400);
            }

            // Decrement vacant rooms
            await connection.query(
                'UPDATE rooms SET vacant_rooms = vacant_rooms - 1 WHERE id = ?',
                [booking.room_id]
            );
        }

        // If booking is cancelled or rejected, and was previously approved/paid, increment vacancy back
        if ((status === 'cancelled' || status === 'rejected') && (booking.status === 'paid' || (booking.status === 'approved' && booking.payment_mode === 'offline'))) {
            await connection.query(
                'UPDATE rooms SET vacant_rooms = vacant_rooms + 1 WHERE id = ?',
                [booking.room_id]
            );
        }

        // Update booking state
        await connection.query('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);

        // Push real-time notification record into DB
        const notificationMsg = `Your booking for room category at ${booking.hostel_id} has been ${status}.`;
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
