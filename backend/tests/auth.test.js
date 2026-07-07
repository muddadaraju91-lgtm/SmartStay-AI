/**
 * Auth Security Tests — Admin Self-Registration Prevention
 * ─────────────────────────────────────────────────────────
 * Verifies that:
 *   1. POST /api/auth/register with role:'admin'  → 400, no DB row created
 *   2. POST /api/auth/register with role:'student' → 201 (regression: still works)
 *   3. POST /api/auth/register with role:'owner'   → 201 (regression: still works)
 *   4. POST /api/auth/admin/create without token   → 401 (endpoint is protected)
 *   5. POST /api/auth/admin/create with student token → 403 (wrong role)
 *   6. POST /api/auth/admin/create with admin token   → 201 (correct path works)
 *
 * Run with:
 *   node backend/tests/auth.test.js
 *
 * Prerequisites:
 *   • backend/.env has valid JWT_SECRET and DB credentials
 *   • smartstay_db is running (the test creates and cleans up its own rows)
 *
 * Exit code: 0 = all assertions passed, 1 = one or more failures
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool   = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const http   = require('http');
const app    = require('../server');

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = () => `http://127.0.0.1:${server.address().port}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pass = (msg) => console.log(`  ✅  ${msg}`);
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

// ─── Unique marker so teardown never touches unrelated rows ───────────────────
const MARKER = `authtest_${Date.now()}`;
const email  = (label) => `${MARKER}_${label}@test.invalid`;

// Track created user IDs for cleanup
const createdUserIds = [];

// ─── Fixtures ─────────────────────────────────────────────────────────────────
/**
 * Mint a signed JWT for an existing DB user without going through the login
 * endpoint. Used to supply admin/student tokens to the protected endpoint tests.
 */
const mintToken = (id, emailAddr, role) =>
    jwt.sign({ id, emailAddr, role }, process.env.JWT_SECRET, { expiresIn: '1h' });

/**
 * Insert a user directly into the DB (bypasses the controller under test).
 * Returns { id, token }.
 */
const seedUser = async (label, role) => {
    const hashed = await bcrypt.hash('TestPass123!', 10);
    const [r] = await pool.query(
        `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, '0000000000')`,
        [`Test ${label} ${MARKER}`, email(label), hashed, role]
    );
    createdUserIds.push(r.insertId);
    return { id: r.insertId, token: mintToken(r.insertId, email(label), role) };
};

// ─── Teardown ─────────────────────────────────────────────────────────────────
const cleanup = async () => {
    // Remove any user row created during this test run (by seeding or by the API)
    await pool.query(
        `DELETE FROM users WHERE email LIKE ?`,
        [`${MARKER}%`]
    );
    await pool.end();
};

// ─── Tests ────────────────────────────────────────────────────────────────────
let server;

const runTests = async () => {
    console.log('\n─── Auth Security Tests ──────────────────────────────────────');

    // ── 1. role:'admin' via public /register must be rejected ─────────────────
    {
        const res = await apiPost('/api/auth/register', {
            name: 'Hacker', email: email('hacker_admin'),
            password: 'Hack123!', role: 'admin', phone: '1234567890'
        });

        if (res.status !== 400) {
            fail(`[1] Expected 400 for role:admin on /register, got ${res.status}`);
        } else {
            pass('[1] POST /register with role:admin returns 400');
        }

        // Confirm NO row was inserted
        const [rows] = await pool.query(
            'SELECT id, role FROM users WHERE email = ?', [email('hacker_admin')]
        );
        if (rows.length > 0) {
            fail(`[1] Admin row was inserted despite the 400! id=${rows[0].id}`);
        } else {
            pass('[1] No admin row exists in users table after the rejected request');
        }
    }

    // ── 2. role:'student' via /register must still work (regression) ──────────
    {
        const res = await apiPost('/api/auth/register', {
            name: 'Student', email: email('student'),
            password: 'Stud123!', role: 'student', phone: '1234567890'
        });

        if (res.status !== 201) {
            fail(`[2] Expected 201 for role:student on /register, got ${res.status}`);
        } else {
            pass('[2] POST /register with role:student still returns 201');
        }
        if (res.body?.data?.user) createdUserIds.push(res.body.data.user.id);
    }

    // ── 3. role:'owner' via /register must still work (regression) ────────────
    {
        const res = await apiPost('/api/auth/register', {
            name: 'Owner', email: email('owner'),
            password: 'Own123!', role: 'owner', phone: '1234567890'
        });

        if (res.status !== 201) {
            fail(`[3] Expected 201 for role:owner on /register, got ${res.status}`);
        } else {
            pass('[3] POST /register with role:owner still returns 201');
        }
        if (res.body?.data?.user) createdUserIds.push(res.body.data.user.id);
    }

    // ── 4. /admin/create without a token must return 401 ─────────────────────
    {
        const res = await apiPost('/api/auth/admin/create', {
            name: 'Ghost Admin', email: email('ghost'),
            password: 'Ghost123!', phone: '0000000000'
        }); // no token

        if (res.status !== 401) {
            fail(`[4] Expected 401 on /admin/create with no token, got ${res.status}`);
        } else {
            pass('[4] POST /admin/create with no token returns 401');
        }
    }

    // ── 5. /admin/create with a student token must return 403 ─────────────────
    {
        const student = await seedUser('student_fixture', 'student');
        const res = await apiPost('/api/auth/admin/create', {
            name: 'Escalated', email: email('escalated'),
            password: 'Esc123!', phone: '0000000000'
        }, student.token);

        if (res.status !== 403) {
            fail(`[5] Expected 403 on /admin/create with student token, got ${res.status}`);
        } else {
            pass('[5] POST /admin/create with student token returns 403');
        }
    }

    // ── 6. /admin/create with a valid admin token must succeed ────────────────
    {
        const admin = await seedUser('admin_fixture', 'admin');
        const res = await apiPost('/api/auth/admin/create', {
            name: 'New Admin', email: email('new_admin'),
            password: 'NewAdm123!', phone: '0000000000'
        }, admin.token);

        if (res.status !== 201) {
            fail(`[6] Expected 201 on /admin/create with admin token, got ${res.status}`);
        } else {
            pass('[6] POST /admin/create with valid admin token returns 201');
        }

        // Confirm the created user actually has role 'admin' in the DB
        const [rows] = await pool.query(
            'SELECT role FROM users WHERE email = ?', [email('new_admin')]
        );
        if (rows.length === 0 || rows[0].role !== 'admin') {
            fail('[6] Created user does not have role admin in the database');
        } else {
            pass('[6] Created user has role:admin confirmed in database');
        }
    }

    console.log('─────────────────────────────────────────────────────────────\n');
};

// ─── Entry Point ──────────────────────────────────────────────────────────────
server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
    try {
        await runTests();
    } catch (err) {
        console.error('Unexpected test runner error:', err);
        process.exitCode = 1;
    } finally {
        await cleanup();
        server.close(() => process.exit(process.exitCode ?? 0));
    }
});
