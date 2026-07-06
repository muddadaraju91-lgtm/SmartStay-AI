const crypto = require('crypto');
const Razorpay = require('razorpay');
const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
require('dotenv').config();

// Initialize Razorpay SDK if keys are valid
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'dummy_key_id') {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

// @desc    Create Razorpay Order
// @route   POST /api/payments/order
// @access  Private (Student Only)
const createPaymentOrder = async (req, res, next) => {
    try {
        const { bookingId } = req.body;

        if (!bookingId) {
            return ApiResponse.error(res, 'bookingId is required', 400);
        }

        // Fetch booking details
        const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        if (bookings.length === 0) {
            return ApiResponse.error(res, 'Booking record not found', 404);
        }

        const booking = bookings[0];

        if (booking.status !== 'pending') {
            return ApiResponse.error(res, 'Payment orders can only be created for pending bookings', 400);
        }

        const amountInPaise = Math.round(booking.total_amount * 100); // Razorpay processes in lowest currency unit (paise)

        // Mock mode check
        if (!razorpayInstance) {
            console.log('Razorpay keys not configured. Operating in MOCK payment mode.');
            const mockOrderId = `order_mock_${crypto.randomBytes(6).toString('hex')}`;
            
            // Save mock order ID to booking
            await pool.query('UPDATE bookings SET razorpay_order_id = ? WHERE id = ?', [mockOrderId, bookingId]);

            return ApiResponse.success(res, 'Mock Payment Order created', {
                isMock: true,
                order_id: mockOrderId,
                amount: booking.total_amount,
                currency: 'INR'
            });
        }

        // Production Razorpay order generation
        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_booking_${bookingId}`,
            payment_capture: 1
        };

        const order = await razorpayInstance.orders.create(options);

        // Save Razorpay order ID to booking
        await pool.query('UPDATE bookings SET razorpay_order_id = ? WHERE id = ?', [order.id, bookingId]);

        return ApiResponse.success(res, 'Razorpay Payment Order created', {
            isMock: false,
            order_id: order.id,
            amount: booking.total_amount,
            currency: 'INR',
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (err) {
        next(err);
    }
};

// @desc    Verify Razorpay Payment Signature
// @route   POST /api/payments/verify
// @access  Private (Student Only)
const verifyPayment = async (req, res, next) => {
    let connection;
    try {
        const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, isMock } = req.body;

        if (!bookingId || !razorpay_order_id) {
            return ApiResponse.error(res, 'Required fields: bookingId, razorpay_order_id', 400);
        }

        // Fetch booking info
        const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
        if (bookings.length === 0) {
            return ApiResponse.error(res, 'Booking record not found', 404);
        }

        const booking = bookings[0];

        // Handle signature verification logic
        let signatureIsValid = false;

        if (isMock || !razorpayInstance) {
            // Bypass security in mock setup
            signatureIsValid = true;
            console.log('Mock payment verification successful.');
        } else {
            // Razorpay standard verification: SHA256 HMAC of orderId + '|' + paymentId
            const generatedSignature = crypto
                .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest('hex');

            signatureIsValid = generatedSignature === razorpay_signature;
        }

        if (!signatureIsValid) {
            // Log payment failure entry
            await pool.query(
                `INSERT INTO payments (booking_id, razorpay_payment_id, amount, status) 
                 VALUES (?, ?, ?, 'failed')`,
                [bookingId, razorpay_payment_id || null, booking.total_amount]
            );
            await pool.query('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
            return ApiResponse.error(res, 'Razorpay Payment signature verification failed', 400);
        }

        // Update database transaction to reserve the inventory and set paid status
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Lock room record and decrease availability
        const [roomRows] = await connection.query(
            'SELECT vacant_rooms FROM rooms WHERE id = ? FOR UPDATE',
            [booking.room_id]
        );

        if (roomRows[0].vacant_rooms <= 0) {
            await connection.rollback();
            connection.release();
            return ApiResponse.error(res, 'Payment failed: The room is no longer available.', 400);
        }

        // Decrement vacancies
        await connection.query(
            'UPDATE rooms SET vacant_rooms = vacant_rooms - 1 WHERE id = ?',
            [booking.room_id]
        );

        // Update booking state
        await connection.query(
            "UPDATE bookings SET status = 'paid' WHERE id = ?",
            [bookingId]
        );

        // Insert payment log record
        await connection.query(
            `INSERT INTO payments (booking_id, razorpay_payment_id, razorpay_signature, amount, status) 
             VALUES (?, ?, ?, ?, 'success')`,
            [bookingId, razorpay_payment_id || `mock_pay_${crypto.randomBytes(6).toString('hex')}`, razorpay_signature || null, booking.total_amount]
        );

        // Push student receipt notification
        await connection.query(
            'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
            [booking.student_id, `Payment received! Your booking for room category at booking ID ${bookingId} is confirmed.`]
        );

        await connection.commit();
        connection.release();

        return ApiResponse.success(res, 'Payment processed and verified successfully');

    } catch (err) {
        if (connection) {
            await connection.rollback();
            connection.release();
        }
        next(err);
    }
};

module.exports = {
    createPaymentOrder,
    verifyPayment
};
