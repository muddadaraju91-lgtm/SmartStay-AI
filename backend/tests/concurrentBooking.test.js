/**
 * Concurrent Booking Race-Condition Test
 * ───────────────────────────────────────
 * Tests that two simultaneous POST /api/bookings requests for the same
 * room with vacant_rooms = 1 yield exactly one success and one rejection.
 *
 * Run with:
 *   node backend/tests/concurrentBooking.test.js
 *
 * Prerequisites:
 *   • Backend .env has valid JWT_SECRET and DB credentials
 *   • smartstay_db is running with at least one hostel + room seeded
 *   • A student JWT token is available (or the test mints one itself)
 *
 * Exit code: 0 = all assertions passed, 1 = failure
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../config/db');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const http    = require('http');
const app     = require('../server');  // imports the express app

// ─── Config ──────────────────────────────────────────────────────────────────
const PORT     = 0;           // OS assigns a free port
const BASE_URL = () => `http://127.0.0.1:${server.address().port}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const pass = (msg) => { console.log(`  ✅  ${msg}`); };
const fail = (msg) => { console.error(`  ❌  ${msg}`); process.exitCode = 1; };

const apiPost = (path, body, token) => new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url     = new URL(path, BASE_URL());
    const opts    = {
        hostname : url.hostname,
        port     : url.port,
        path     : url.pathname,
        method   : 'POST',
        headers  : {
            'Content-Type'  : 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    };

    const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, body: data }); }
        });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
});

// ─── Test Fixtures ────────────────────────────────────────────────────────────
/**
 * Creates a temporary test student + hostel + room directly in the DB,
 * returns { studentToken, roomId, hostelId, studentId }.
 * All created rows are tagged with a unique run marker so teardown is safe.
 */
const createTestFixtures = async () => {
    const marker = `test_${Date.now()}`;

    // Student user
    const hashed = await bcrypt.hash('TestPass123!', 10);
    const [userResult] = await pool.query(
        `INSERT INTO users (name, email, password, role, phone)
         VALUES (?, ?, ?, 'student', '0000000000')`,
        [`Test Student ${marker}`, `${marker}@test.invalid`, hashed]
    );
    const studentId = userResult.insertId;
    const studentToken = jwt.sign(
        { id: studentId, email: `${marker}@test.invalid`, role: 'student' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Owner user (needed for hostel FK)
    const [ownerResult] = await pool.query(
        `INSERT INTO users (name, email, password, role, phone)
         VALUES (?, ?, ?, 'owner', '1111111111')`,
        [`Test Owner ${marker}`, `owner_${marker}@test.invalid`, hashed]
    );
    const ownerId = ownerResult.insertId;

    // Hostel
    const [hostelResult] = await pool.query(
        `INSERT INTO hostels (owner_id, name, address, latitude, longitude, is_verified, trust_score)
         VALUES (?, ?, 'Test Addr', 17.72, 83.31, 1, 80.00)`,
        [ownerId, `Test Hostel ${marker}`]
    );
    const hostelId = hostelResult.insertId;

    // Room with exactly 1 vacancy
    const [roomResult] = await pool.query(
        `INSERT INTO rooms (hostel_id, type_name, capacity, price, total_rooms, vacant_rooms)
         VALUES (?, 'Single', 1, 5000.00, 1, 1)`,
        [hostelId]
    );
    const roomId = roomResult.insertId;

    return { studentToken, studentId, ownerId, hostelId, roomId, marker };
};

/**
 * Clean up all rows created for this test run.
 */
const teardown = async ({ studentId, ownerId, hostelId, roomId }) => {
    // Cascade deletes handle bookings, rooms, notifications via FK ON DELETE CASCADE
    if (hostelId) await pool.query('DELETE FROM hostels WHERE id = ?', [hostelId]);
    if (ownerId)  await pool.query('DELETE FROM users WHERE id = ?', [ownerId]);
    if (studentId) await pool.query('DELETE FROM users WHERE id = ?', [studentId]);
};

// ─── Main Test ────────────────────────────────────────────────────────────────
let server;
let fixtures;

const runTest = async () => {
    console.log('\n══════════════════════════════════════════════════════════');
    console.log('  SmartStay AI — Concurrent Booking Race-Condition Test   ');
    console.log('══════════════════════════════════════════════════════════\n');

    // Start server on a random free port
    await new Promise((resolve) => { server = app.listen(PORT, resolve); });
    console.log(`  Server listening on port ${server.address().port}\n`);

    fixtures = await createTestFixtures();
    const { studentToken, roomId } = fixtures;

    // ── Test 1: Two simultaneous bookings for the last slot ───────────────────
    console.log('  Test 1: Two concurrent POST /api/bookings (vacant_rooms = 1)');

    const checkInDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const bookingBody = { roomId, checkInDate, paymentMode: 'online' };

    // Fire both requests at the same instant — Promise.all ensures they are
    // sent before either response is awaited.
    const [r1, r2] = await Promise.all([
        apiPost('/api/bookings', bookingBody, studentToken),
        apiPost('/api/bookings', bookingBody, studentToken)
    ]);

    const statuses = [r1.status, r2.status].sort();
    console.log(`    Request A → HTTP ${r1.status}: ${r1.body?.message}`);
    console.log(`    Request B → HTTP ${r2.status}: ${r2.body?.message}`);

    if (statuses[0] === 201 && statuses[1] === 400) {
        pass('Exactly one request succeeded (201) and one was rejected (400).');
    } else {
        fail(`Expected one 201 and one 400, got ${statuses.join(' and ')}.`);
    }

    // ── Test 2: vacant_rooms is now 0 ────────────────────────────────────────
    console.log('\n  Test 2: Room vacancy counter after concurrent booking');

    const [roomRows] = await pool.query(
        'SELECT vacant_rooms FROM rooms WHERE id = ?', [roomId]
    );
    const vacant = roomRows[0].vacant_rooms;
    console.log(`    vacant_rooms = ${vacant}`);

    if (vacant === 0) {
        pass('vacant_rooms correctly decremented to 0.');
    } else {
        fail(`Expected vacant_rooms = 0, got ${vacant}.`);
    }

    // ── Test 3: Cancel the pending booking → vacancy restored ─────────────────
    console.log('\n  Test 3: Cancel the pending booking restores vacant_rooms to 1');

    // Find the successful booking
    const [pendingRows] = await pool.query(
        `SELECT id FROM bookings WHERE room_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1`,
        [roomId]
    );

    if (pendingRows.length === 0) {
        fail('Could not find the pending booking to cancel — skipping test 3.');
    } else {
        // We need an owner/admin token to call PUT /api/bookings/:id/status
        const ownerToken = jwt.sign(
            { id: fixtures.ownerId, email: `owner_${fixtures.marker}@test.invalid`, role: 'owner' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        const bookingId = pendingRows[0].id;
        const cancelPayload = JSON.stringify({ status: 'rejected' });
        const cancelResult  = await new Promise((resolve, reject) => {
            const url  = new URL(`/api/bookings/${bookingId}/status`, BASE_URL());
            const opts = {
                hostname: url.hostname, port: url.port,
                path: url.pathname, method: 'PUT',
                headers: {
                    'Content-Type'  : 'application/json',
                    'Content-Length': Buffer.byteLength(cancelPayload),
                    Authorization   : `Bearer ${ownerToken}`
                }
            };
            const req = http.request(opts, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
            });
            req.on('error', reject);
            req.write(cancelPayload);
            req.end();
        });

        console.log(`    Reject booking #${bookingId} → HTTP ${cancelResult.status}: ${cancelResult.body?.message}`);

        const [afterRows] = await pool.query(
            'SELECT vacant_rooms FROM rooms WHERE id = ?', [roomId]
        );
        const vacantAfter = afterRows[0].vacant_rooms;
        console.log(`    vacant_rooms after rejection = ${vacantAfter}`);

        if (cancelResult.status === 200 && vacantAfter === 1) {
            pass('Rejecting the pending booking restored vacant_rooms to 1.');
        } else {
            fail(`Expected HTTP 200 and vacant_rooms=1, got HTTP ${cancelResult.status} and vacant_rooms=${vacantAfter}.`);
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const exitCode = process.exitCode || 0;
    console.log('\n──────────────────────────────────────────────────────────');
    if (exitCode === 0) {
        console.log('  🎉  All tests passed.');
    } else {
        console.log('  ⚠️   One or more tests FAILED. See output above.');
    }
    console.log('──────────────────────────────────────────────────────────\n');
};

// ─── Entry-point ──────────────────────────────────────────────────────────────
runTest()
    .catch(err => {
        console.error('Unexpected test error:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (fixtures) await teardown(fixtures).catch(() => {});
        await pool.end().catch(() => {});
        if (server) server.close();
    });
