/**
 * hostelCache.js — In-process TTL cache for the verified-hostels candidate set.
 *
 * Design decisions:
 *  - No external dependency (no Redis, no npm package). Redis would require an
 *    additional infrastructure service; since the stack has no cache layer today,
 *    an in-process store is the right first step. If the app is ever deployed with
 *    multiple Node processes / workers, upgrade this to Redis with the same
 *    invalidate() interface so the controller code stays identical.
 *  - The cache stores pre-filtered candidate rows keyed by a coordinate bucket.
 *  - TTL default: 60 seconds. Short enough that a newly verified hostel appears
 *    within one minute without an explicit invalidation call. Explicit calls from
 *    mutation endpoints guarantee immediate consistency for admin actions.
 *  - The cache is invalidated (not just expired) on every write that can change
 *    which hostels appear in recommendations:
 *      • verifyHostel  — changes is_verified
 *      • createHostel  — new row (unverified, won't appear, but invalidate for safety)
 *      • deleteHostel  — row removed
 *      • updateHostel  — lat/lng/amenities/trust_score may change scoring
 *      • trustScoreEngine — trust_score changes scoring order
 */

'use strict';

const CACHE_TTL_MS = parseInt(process.env.HOSTEL_CACHE_TTL_MS || '60000'); // 60 s

let cache = new Map(); // key -> { rows, cachedAt }

/**
 * Returns cached verified-hostel rows if they are still fresh, otherwise null.
 * @param {string} key
 * @returns {Array|null}
 */
const get = (key) => {
    const entry = cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.rows;
};

/**
 * Stores a fresh set of verified-hostel rows.
 * @param {string} key
 * @param {Array} rows
 */
const set = (key, rows) => {
    cache.set(key, { rows, cachedAt: Date.now() });
};

/**
 * Immediately invalidates the entire cache.
 * Call this from any mutation that changes is_verified, trust_score, lat/lng,
 * amenities, or removes a hostel row.
 */
const invalidate = () => {
    cache.clear();
    // isDev guard: only log when not in production (same pattern as db.js)
    if (process.env.NODE_ENV !== 'production') {
        console.log('[hostelCache] Cache invalidated');
    }
};

/**
 * Returns cache stats useful for debugging / monitoring.
 */
const stats = () => ({
    populated : cache.size > 0,
    ttlMs     : CACHE_TTL_MS,
    keyCount  : cache.size
});

module.exports = { get, set, invalidate, stats };
