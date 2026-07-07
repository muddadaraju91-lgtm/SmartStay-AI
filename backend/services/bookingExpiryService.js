const pool = require('../config/db');

/**
 * Booking Expiry Service
 * ──────────────────────
 * Pending bookings hold a vacancy slot from the moment they are created
 * (optimistic reserve in createBooking). If a student never completes
 * payment or the owner never acts, that slot is locked indefinitely.
 *
 * This service provides two entry-points:
 *
 *   expireStaleBookings(roomId?)
 *     Lazy / on-demand check. Call this before checking vacancy so that
 *     timed-out holds are released before the new booking attempt.
 *
 *   startExpiryScheduler()
 *     Background interval that sweeps ALL pending bookings platform-wide
 *     on a configurable cadence (default: every 10 minutes).
 *
 * Configurable timeout (via env):
 *   BOOKING_EXPIRY_MINUTES  — minutes before a pending booking is auto-cancelled
 *                             (default: 30)
 *   BOOKING_EXPIRY_INTERVAL_MS — how often the scheduler runs in milliseconds
 *                                (default: 600 000 = 10 minutes)
 */

const EXPIRY_MINUTES = parseInt(process.env.BOOKING_EXPIRY_MINUTES || '30', 10);
const SCHEDULER_INTERVAL_MS = parseInt(process.env.BOOKING_EXPIRY_INTERVAL_MS || '600000', 10);

/**
 * Expire stale pending bookings and release their held vacancy slots.
 *
 * If roomId is provided, only bookings for that specific room are checked
 * (lazy path called from createBooking).
 * If roomId is omitted, ALL stale pending bookings are swept (scheduler path).
 *
 * Each expired booking is handled in its own transaction so a failure on
 * one row does not prevent others from being released.
 *
 * @param {number|null} roomId  Optional room filter.
 * @returns {Promise<number>}   Number of bookings expired in this run.
 */
const expireStaleBookings = async (roomId = null) => {
    let expiredCount = 0;

    try {
        // Find all pending bookings older than EXPIRY_MINUTES.
        // The extra room filter is used in the lazy (per-request) path.
        const conditions = [`b.status = 'pending'`,
            `b.created_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)`];
        const params = [EXPIRY_MINUTES];

        if (roomId) {
            conditions.push('b.room_id = ?');
            params.push(roomId);
        }

        const [staleBookings] = await pool.query(
            `SELECT b.id as booking_id, b.room_id, b.student_id
             FROM bookings b
             WHERE ${conditions.join(' AND ')}`,
            params
        );

        if (staleBookings.length === 0) return 0;

        console.log(`[ExpiryService] Found ${staleBookings.length} stale pending booking(s) to expire.`);

        for (const booking of staleBookings) {
            let connection;
            try {
                connection = await pool.getConnection();
                await connection.beginTransaction();

                // Re-check inside the transaction: another concurrent request may
                // have already expired or approved this booking.
                const [check] = await connection.query(
                    "SELECT status FROM bookings WHERE id = ? AND status = 'pending' FOR UPDATE",
                    [booking.booking_id]
                );

                if (check.length === 0) {
                    // Already handled by another path — skip silently.
                    await connection.rollback();
                    connection.release();
                    continue;
                }

                // Release the held vacancy slot.
                await connection.query(
                    'UPDATE rooms SET vacant_rooms = vacant_rooms + 1 WHERE id = ?',
                    [booking.room_id]
                );

                // Mark the booking as cancelled (expired).
                await connection.query(
                    "UPDATE bookings SET status = 'cancelled' WHERE id = ?",
                    [booking.booking_id]
                );

                // Notify the student.
                await connection.query(
                    'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
                    [booking.student_id,
                        `Your booking #${booking.booking_id} was automatically cancelled because ` +
                        `it was not completed within ${EXPIRY_MINUTES} minutes.`]
                );

                await connection.commit();
                expiredCount++;

                console.log(`[ExpiryService] Expired booking #${booking.booking_id}, released slot on room #${booking.room_id}.`);
            } catch (err) {
                if (connection) await connection.rollback();
                console.error(`[ExpiryService] Failed to expire booking #${booking.booking_id}:`, err.message);
            } finally {
                if (connection) connection.release();
            }
        }
    } catch (err) {
        console.error('[ExpiryService] Error querying stale bookings:', err.message);
    }

    return expiredCount;
};

/**
 * Start a background interval that sweeps all stale pending bookings
 * across the entire platform every SCHEDULER_INTERVAL_MS milliseconds.
 *
 * Call this once from server.js after the server starts listening.
 *
 * @returns {NodeJS.Timeout}  The interval handle (call clearInterval to stop).
 */
const startExpiryScheduler = () => {
    console.log(
        `[ExpiryService] Scheduler started — expiring pending bookings older than ` +
        `${EXPIRY_MINUTES} min, every ${SCHEDULER_INTERVAL_MS / 1000}s.`
    );

    // Run once immediately at startup to clear any bookings that timed out
    // while the server was offline.
    expireStaleBookings().then(n => {
        if (n > 0) console.log(`[ExpiryService] Startup sweep expired ${n} stale booking(s).`);
    });

    return setInterval(async () => {
        const n = await expireStaleBookings();
        if (n > 0) console.log(`[ExpiryService] Scheduled sweep expired ${n} stale booking(s).`);
    }, SCHEDULER_INTERVAL_MS);
};

module.exports = { expireStaleBookings, startExpiryScheduler };
