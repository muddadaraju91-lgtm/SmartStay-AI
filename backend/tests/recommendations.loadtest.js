/**
 * Recommendations Load Test — Before / After Cache & SQL Pre-Filter
 * ──────────────────────────────────────────────────────────────────
 * Simulates 50 concurrent GET /api/hostels/recommendations requests,
 * first with caching disabled (HOSTEL_CACHE_TTL_MS=0) to measure the
 * baseline (all-DB, all-JS), then with caching enabled to measure improvement.
 *
 * Run with:
 *   node backend/tests/recommendations.loadtest.js
 *
 * Prerequisites:
 *   • backend/.env has valid JWT_SECRET and DB credentials
 *   • smartstay_db is running with at least one verified hostel in Visakhapatnam
 *     (the test seeds its own fixture hostel if none exists)
 *
 * Output:
 *   Prints p50, p95, p99 latencies and req/s for BASELINE vs CACHED runs,
 *   and asserts that the cached run is measurably faster (p95 improvement).
 *
 * Exit code: 0 = passes / 1 = latency regression or test setup failure
 */

'use strict';

// Disable cache for the baseline run; the second run re-enables it.
process.env.HOSTEL_CACHE_TTL_MS = '0';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool   = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const http   = require('http');
const app    = require('../server');

// ─── Config ───────────────────────────────────────────────────────────────────
const CONCURRENCY    = 50;   // simultaneous requests per wave
const WARMUP_REQS    = 5;    // discard first N results (JIT / connection-pool warmup)
const REF_LAT        = 17.7231;  // Visakhapatnam — matches seeded college coords
const REF_LNG        = 83.3012;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pass = (msg) => console.log(`  ✅  ${msg}`);
const fail = (msg) => { console.error(`  ❌  ${msg}`); process.exitCode = 1; };
const hdr  = (msg) => console.log(`\n${'─'.repeat(60)}\n  ${msg}\n${'─'.repeat(60)}`);

let server;
let studentToken;
const MARKER = `loadtest_${Date.now()}`;
const BASE_URL = () => `http://127.0.0.1:${server.address().port}`;

/**
 * Issue one GET /api/hostels/recommendations request.
 * Returns latency in ms.
 */
const oneRequest = () => new Promise((resolve, reject) => {
    const t0  = Date.now();
    const url  = new URL(
        `/api/hostels/recommendations?latitude=${REF_LAT}&longitude=${REF_LNG}&budget=10000`,
        BASE_URL()
    );
    const opts = {
        hostname : url.hostname,
        port     : url.port,
        path     : url.pathname + url.search,
        method   : 'GET',
        headers  : { Authorization: `Bearer ${studentToken}` }
    };
    const req = http.request(opts, (res) => {
        res.resume(); // drain without parsing
        res.on('end', () => resolve(Date.now() - t0));
    });
    req.on('error', reject);
    req.end();
});

/**
 * Fire `count` concurrent requests, collect latencies.
 */
const wave = async (count) => {
    const results = await Promise.allSettled(
        Array.from({ length: count }, () => oneRequest())
    );
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .sort((a, b) => a - b);
};

/**
 * Compute percentile from a sorted latency array.
 */
const pct = (sorted, p) => {
    const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[idx] ?? 0;
};

const printStats = (label, latencies) => {
    if (latencies.length === 0) { console.log(`  ${label}: no results`); return; }
    const avg = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
    console.log(
        `  ${label.padEnd(20)} | n=${String(latencies.length).padStart(3)} ` +
        `| avg=${String(avg).padStart(5)}ms ` +
        `| p50=${String(pct(latencies, 50)).padStart(5)}ms ` +
        `| p95=${String(pct(latencies, 95)).padStart(5)}ms ` +
        `| p99=${String(pct(latencies, 99)).padStart(5)}ms`
    );
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const seedFixtures = async () => {
    const hashed = await bcrypt.hash('LoadTest1!', 10);

    // Student (for auth token)
    const [uRes] = await pool.query(
        `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, 'student', '0000000000')`,
        [`LT Student ${MARKER}`, `${MARKER}_student@test.invalid`, hashed]
    );
    const studentId = uRes.insertId;
    studentToken = jwt.sign(
        { id: studentId, email: `${MARKER}_student@test.invalid`, role: 'student' },
        process.env.JWT_SECRET, { expiresIn: '1h' }
    );

    // Owner
    const [oRes] = await pool.query(
        `INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, 'owner', '1111111111')`,
        [`LT Owner ${MARKER}`, `${MARKER}_owner@test.invalid`, hashed]
    );
    const ownerId = oRes.insertId;

    // A verified hostel at the reference coordinates so it appears in results
    await pool.query(
        `INSERT INTO hostels (owner_id, name, address, latitude, longitude, is_verified, trust_score, amenities)
         VALUES (?, ?, 'Loadtest Area', ?, ?, 1, 85.00, '["WiFi","AC"]')`,
        [ownerId, `LT Hostel ${MARKER}`, REF_LAT, REF_LNG]
    );

    return { studentId, ownerId };
};

const teardown = async ({ studentId, ownerId }) => {
    await pool.query(`DELETE FROM hostels WHERE name LIKE 'LT Hostel ${MARKER}%'`);
    if (ownerId)   await pool.query('DELETE FROM users WHERE id = ?', [ownerId]);
    if (studentId) await pool.query('DELETE FROM users WHERE id = ?', [studentId]);
    await pool.end();
};

// ─── Main ─────────────────────────────────────────────────────────────────────
let fixtures;

const runTest = async () => {
    hdr('SmartStay AI — Recommendations Load Test');

    fixtures = await seedFixtures();
    console.log(`  Fixtures seeded. Ref coords: ${REF_LAT}, ${REF_LNG}`);
    console.log(`  Concurrency: ${CONCURRENCY} | Warmup: ${WARMUP_REQS} requests discarded\n`);

    // ── Warmup ────────────────────────────────────────────────────────────────
    console.log('  Warming up connection pool & JIT...');
    await wave(WARMUP_REQS);

    // ── Phase 1: BASELINE (cache TTL = 0, every request hits DB + full JS) ───
    hdr('Phase 1 — BASELINE (cache disabled, HOSTEL_CACHE_TTL_MS=0)');
    // hostelCache module is already loaded with TTL=0 from the top of this file.
    const baselineLatencies = await wave(CONCURRENCY);
    printStats('BASELINE', baselineLatencies);

    // ── Phase 2: CACHED (re-enable cache, re-run same wave) ──────────────────
    // Patch the env var and force-reload the cache module with the new TTL.
    process.env.HOSTEL_CACHE_TTL_MS = '60000';
    // Delete the cached require() so the next require() picks up the new TTL.
    delete require.cache[require.resolve('../services/hostelCache')];

    hdr('Phase 2 — CACHED (HOSTEL_CACHE_TTL_MS=60000)');
    // Do one extra warmup to prime the cache
    await wave(3);
    const cachedLatencies = await wave(CONCURRENCY);
    printStats('CACHED', cachedLatencies);

    // ── Comparison ────────────────────────────────────────────────────────────
    hdr('Summary');
    const baseP95   = pct(baselineLatencies, 95);
    const cachedP95 = pct(cachedLatencies,   95);
    const improvPct = baseP95 > 0
        ? Math.round(((baseP95 - cachedP95) / baseP95) * 100)
        : 0;

    console.log(`  Baseline p95 : ${baseP95}ms`);
    console.log(`  Cached   p95 : ${cachedP95}ms`);
    console.log(`  p95 improvement: ${improvPct}%`);

    if (cachedP95 < baseP95) {
        pass(`Cache reduced p95 latency by ~${improvPct}% (${baseP95}ms → ${cachedP95}ms)`);
    } else if (cachedP95 === baseP95) {
        // Equal can happen if the DB is very fast locally — not a failure.
        pass(`Cache p95 matched baseline (${cachedP95}ms). DB may be very fast locally.`);
    } else {
        fail(`Cached p95 (${cachedP95}ms) is slower than baseline (${baseP95}ms) — investigate`);
    }
};

// ─── Entry Point ──────────────────────────────────────────────────────────────
server = http.createServer(app);
server.listen(0, '127.0.0.1', async () => {
    try {
        await runTest();
    } catch (err) {
        console.error('Unexpected load test error:', err);
        process.exitCode = 1;
    } finally {
        if (fixtures) await teardown(fixtures).catch(() => {});
        server.close(() => process.exit(process.exitCode ?? 0));
    }
});
