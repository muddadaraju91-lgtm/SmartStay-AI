const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const { calculateMatchScore } = require('../services/recommendationEngine');
const hostelCache = require('../services/hostelCache');

// @desc    Get all hostels (with distance and filters)
// @route   GET /api/hostels
// @access  Public
const getHostels = async (req, res, next) => {
    try {
        const { search, collegeLat, collegeLng, maxDistance = 15, isVerified, minPrice, maxPrice, amenities, ownerId } = req.query;
        let query = `
            SELECT h.*, u.name as owner_name,
                   COALESCE((SELECT MIN(price) FROM rooms WHERE hostel_id = h.id), 0) as starting_price,
                   COALESCE((SELECT SUM(vacant_rooms) FROM rooms WHERE hostel_id = h.id), 0) as total_vacancy
        `;
        const queryParams = [];

        // Check if the search term is a college name and we don't have explicit coords
        let finalCollegeLat = collegeLat;
        let finalCollegeLng = collegeLng;

        if (search && !finalCollegeLat && !finalCollegeLng) {
            const [colleges] = await pool.query(
                'SELECT latitude, longitude FROM colleges WHERE name LIKE ? OR city LIKE ? LIMIT 1', 
                [`%${search}%`, `%${search}%`]
            );
            if (colleges.length > 0) {
                finalCollegeLat = colleges[0].latitude;
                finalCollegeLng = colleges[0].longitude;
            }
        }

        // Geolocation calculations using Haversine Formula
        if (finalCollegeLat && finalCollegeLng) {
            query += `, 
                (6371 * acos(
                    cos(radians(?)) * cos(radians(h.latitude)) * 
                    cos(radians(h.longitude) - radians(?)) + 
                    sin(radians(?)) * sin(radians(h.latitude))
                )) AS distance
            `;
            queryParams.push(parseFloat(finalCollegeLat), parseFloat(finalCollegeLng), parseFloat(finalCollegeLat));
        } else {
            query += `, 0 AS distance`;
        }

        query += ` FROM hostels h JOIN users u ON h.owner_id = u.id WHERE 1=1`;

        // Apply owner filter
        if (ownerId) {
            query += ` AND h.owner_id = ?`;
            queryParams.push(parseInt(ownerId));
        }

        // Apply verification status filter
        if (isVerified !== undefined) {
            query += ` AND h.is_verified = ?`;
            queryParams.push(isVerified === 'true' ? 1 : 0);
        }

        // Apply search keyword filter (names or address keywords)
        // Only apply if we are NOT doing a college location-based search, 
        // because if finalCollegeLat is set, the search term was a college/city name.
        if (search && !(finalCollegeLat && finalCollegeLng)) {
            query += ` AND (h.name LIKE ? OR h.address LIKE ?)`;
            const searchPattern = `%${search}%`;
            queryParams.push(searchPattern, searchPattern);
        }

        // Apply price constraints (filtering hostels by room prices)
        if (minPrice || maxPrice) {
            query += ` AND h.id IN (SELECT DISTINCT hostel_id FROM rooms WHERE 1=1`;
            if (minPrice) {
                query += ` AND price >= ?`;
                queryParams.push(parseFloat(minPrice));
            }
            if (maxPrice) {
                query += ` AND price <= ?`;
                queryParams.push(parseFloat(maxPrice));
            }
            query += `)`;
        }

        // Amenities filter — each requested amenity must appear in the stored JSON array.
        // JSON_CONTAINS is applied once per term (AND logic = all must match), which
        // replicates the previous JavaScript Array.every() behaviour exactly.
        // Parameterizing via JSON.stringify(term) produces a valid JSON scalar (e.g. '"WiFi"'),
        // so this is fully parameterized — no string concatenation at all.
        // NOTE: JSON_CONTAINS on a VARCHAR column cannot use a B-tree index and will do a
        // full scan for the amenity predicate — acceptable now, and the reason Option B
        // (normalized join table) is recorded for a future migration.
        if (amenities) {
            const amenitiesList = amenities.split(',').map(a => a.trim()).filter(Boolean);
            for (const amenity of amenitiesList) {
                query += ` AND JSON_CONTAINS(CAST(h.amenities AS JSON), ?)`;
                queryParams.push(JSON.stringify(amenity)); // e.g. '"WiFi"'
            }
        }

        // Distance range filter (HAVING must come after all WHERE conditions)
        if (finalCollegeLat && finalCollegeLng && maxDistance) {
            query += ` HAVING distance <= ?`;
            queryParams.push(parseFloat(maxDistance));
        }

        // Ordering listings by trust score & distance
        query += ` ORDER BY h.trust_score DESC, distance ASC`;

        const [hostels] = await pool.query(query, queryParams);

        // Client-side parsing of amenities JSON string
        const formattedHostels = hostels.map(hostel => ({
            ...hostel,
            amenities: typeof hostel.amenities === 'string' ? JSON.parse(hostel.amenities) : hostel.amenities,
            is_verified: !!hostel.is_verified
        }));

        // Amenities filtering is now handled in SQL (see WHERE clause above).
        // No post-fetch JS filter needed.
        return ApiResponse.success(res, 'Hostels retrieved successfully', { hostels: formattedHostels });

    } catch (err) {
        next(err);
    }
};

// @desc    Get single hostel details along with room details and reviews
// @route   GET /api/hostels/:id
// @access  Public
const getHostelById = async (req, res, next) => {
    try {
        const hostelId = parseInt(req.params.id);

        // Fetch hostel details
        const [hostelRows] = await pool.query(
            `SELECT h.*, u.name as owner_name, u.phone as owner_phone 
             FROM hostels h 
             JOIN users u ON h.owner_id = u.id 
             WHERE h.id = ?`, 
            [hostelId]
        );

        if (hostelRows.length === 0) {
            return ApiResponse.error(res, 'Hostel property not found', 404);
        }

        const hostel = hostelRows[0];
        hostel.amenities = typeof hostel.amenities === 'string' ? JSON.parse(hostel.amenities) : hostel.amenities;
        hostel.is_verified = !!hostel.is_verified;

        // Fetch rooms available for this hostel
        const [rooms] = await pool.query('SELECT * FROM rooms WHERE hostel_id = ?', [hostelId]);

        // Fetch ratings & reviews
        const [reviews] = await pool.query(
            `SELECT r.*, u.name as student_name 
             FROM reviews r 
             JOIN users u ON r.student_id = u.id 
             WHERE r.hostel_id = ? 
             ORDER BY r.created_at DESC`, 
            [hostelId]
        );

        // Calculate Average Rating
        const averageRating = reviews.length > 0 
            ? parseFloat((reviews.reduce((sum, rev) => sum + rev.rating, 0) / reviews.length).toFixed(1))
            : 0;

        return ApiResponse.success(res, 'Hostel details retrieved', {
            hostel,
            rooms,
            reviews,
            averageRating,
            reviewCount: reviews.length
        });

    } catch (err) {
        next(err);
    }
};

// @desc    Create a new hostel listing
// @route   POST /api/hostels
// @access  Private (Owner Only)
const createHostel = async (req, res, next) => {
    try {
        const { name, address, latitude, longitude, description, amenities } = req.body;
        const ownerId = req.user.id; // From authMiddleware token

        if (!name || !address || !latitude || !longitude) {
            return ApiResponse.error(res, 'Required fields: Name, Address, Latitude, Longitude', 400);
        }

        // Amenities are structured as an array of strings in JSON string format
        const amenitiesStr = Array.isArray(amenities) ? JSON.stringify(amenities) : JSON.stringify([]);

        const [result] = await pool.query(
            `INSERT INTO hostels (owner_id, name, address, latitude, longitude, description, amenities, trust_score) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 60.00)`, // Starts with base trust score of 60
            [ownerId, name, address, parseFloat(latitude), parseFloat(longitude), description || '', amenitiesStr]
        );

        const newHostelId = result.insertId;

        // A new hostel means the verified set may change (e.g. after a quick admin verify).
        // Invalidate eagerly so there is no stale-cache window.
        hostelCache.invalidate();

        return ApiResponse.success(res, 'Hostel listing created successfully. Awaiting admin verification.', {
            hostelId: newHostelId
        }, 201);

    } catch (err) {
        next(err);
    }
};

// @desc    Update hostel listing details
// @route   PUT /api/hostels/:id
// @access  Private (Owner Only)
const updateHostel = async (req, res, next) => {
    try {
        const hostelId = parseInt(req.params.id);
        const { name, address, latitude, longitude, description, amenities } = req.body;
        const ownerId = req.user.id;

        // Verify property ownership
        const [existing] = await pool.query('SELECT owner_id FROM hostels WHERE id = ?', [hostelId]);
        if (existing.length === 0) {
            return ApiResponse.error(res, 'Hostel listing not found', 404);
        }

        if (existing[0].owner_id !== ownerId && req.user.role !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized to modify this property listing', 403);
        }

        const updates = [];
        const params = [];

        if (name) { updates.push('name = ?'); params.push(name); }
        if (address) { updates.push('address = ?'); params.push(address); }
        if (latitude) { updates.push('latitude = ?'); params.push(parseFloat(latitude)); }
        if (longitude) { updates.push('longitude = ?'); params.push(parseFloat(longitude)); }
        if (description) { updates.push('description = ?'); params.push(description); }
        if (amenities) {
            const amenitiesStr = Array.isArray(amenities) ? JSON.stringify(amenities) : JSON.stringify([]);
            updates.push('amenities = ?');
            params.push(amenitiesStr);
        }

        if (updates.length === 0) {
            return ApiResponse.error(res, 'No modification fields specified', 400);
        }

        params.push(hostelId);

        await pool.query(`UPDATE hostels SET ${updates.join(', ')} WHERE id = ?`, params);

        // lat/lng, amenities, or trust_score changes affect recommendation scoring.
        hostelCache.invalidate();

        return ApiResponse.success(res, 'Hostel listing updated successfully');

    } catch (err) {
        next(err);
    }
};

// @desc    Verify property status (Admin Mode)
// @route   PUT /api/hostels/:id/verify
// @access  Private (Admin Only)
const verifyHostel = async (req, res, next) => {
    try {
        const hostelId = parseInt(req.params.id);
        const { isVerified } = req.body;

        const [result] = await pool.query('UPDATE hostels SET is_verified = ? WHERE id = ?', [isVerified ? 1 : 0, hostelId]);
        if (result.affectedRows === 0) {
            return ApiResponse.error(res, 'Hostel not found', 404);
        }

        // Trust score recalculated automatically after verification status updates
        // Verification grants +30 points to baseline trust score
        const trustBonus = isVerified ? 30 : -30;
        await pool.query('UPDATE hostels SET trust_score = LEAST(100.00, GREATEST(0.00, trust_score + ?)) WHERE id = ?', [trustBonus, hostelId]);

        // is_verified directly controls which hostels appear in recommendations.
        hostelCache.invalidate();

        return ApiResponse.success(res, `Hostel verification status updated to: ${isVerified}`);
    } catch (err) {
        next(err);
    }
};

// @desc    Delete a hostel listing
// @route   DELETE /api/hostels/:id
// @access  Private (Owner/Admin Only)
const deleteHostel = async (req, res, next) => {
    try {
        const hostelId = parseInt(req.params.id);
        const [existing] = await pool.query('SELECT owner_id FROM hostels WHERE id = ?', [hostelId]);

        if (existing.length === 0) {
            return ApiResponse.error(res, 'Hostel listing not found', 404);
        }

        if (existing[0].owner_id !== req.user.id && req.user.role !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized delete permission', 403);
        }

        await pool.query('DELETE FROM hostels WHERE id = ?', [hostelId]);

        // Deleted hostel must not appear in future recommendations.
        hostelCache.invalidate();

        return ApiResponse.success(res, 'Hostel listing deleted successfully');

    } catch (err) {
        next(err);
    }
};

// @desc    Get personalized hostel recommendations for a student
// @route   GET /api/hostels/recommendations
// @access  Private (Student Only)
const getRecommendations = async (req, res, next) => {
    try {
        const studentId = req.user.id;
        const { budget, latitude, longitude, amenities } = req.query;

        let preferredBudget = budget ? parseFloat(budget) : 10000;
        let refLat = latitude ? parseFloat(latitude) : null;
        let refLng = longitude ? parseFloat(longitude) : null;
        let refAmenities = amenities ? amenities.split(',').map(a => a.trim()) : [];

        if (!refLat || !refLng) {
            // IMPORTANT: Never silently fall back to a hardcoded city coordinate here.
            // Every college seeded in this platform is in Visakhapatnam, Andhra Pradesh.
            // A Bangalore (or any other city) default would silently compute distances
            // against the wrong origin, producing recommendations that are geographically
            // meaningless and misleading to the student. Instead we derive coordinates
            // from the student's actual college association, or return an explicit error.

            // Strategy 1: caller may supply an explicit collegeId query param
            const explicitCollegeId = req.query.collegeId ? parseInt(req.query.collegeId) : null;

            let resolvedCollegeId = explicitCollegeId;

            // Strategy 2: look up the college_id stored on the student's own profile row
            if (!resolvedCollegeId) {
                const [profileRows] = await pool.query(
                    'SELECT college_id FROM users WHERE id = ?',
                    [studentId]
                );
                if (profileRows.length > 0 && profileRows[0].college_id) {
                    resolvedCollegeId = profileRows[0].college_id;
                }
            }

            // Strategy 3: if we have a college ID, fetch its coordinates from the colleges table
            if (resolvedCollegeId) {
                const [collegeRows] = await pool.query(
                    'SELECT latitude, longitude FROM colleges WHERE id = ?',
                    [resolvedCollegeId]
                );
                if (collegeRows.length > 0) {
                    refLat = parseFloat(collegeRows[0].latitude);
                    refLng = parseFloat(collegeRows[0].longitude);
                }
            }

            // If coordinates are still unresolved, refuse to guess — return a clear error
            if (!refLat || !refLng) {
                return ApiResponse.error(
                    res,
                    'Unable to determine your location. Please provide latitude & longitude query parameters, or a valid collegeId.',
                    400
                );
            }
        }

        // ── SQL candidate pre-filter using Haversine ──────────────────────────
        // Before scoring every verified hostel in JS, push a coarse distance filter
        // into the SQL query so only hostels within MAX_CANDIDATE_KM reach the
        // Node.js layer. This mirrors the existing Haversine pattern used in
        // getHostels() and turns an O(n-all) scan into O(n-nearby).
        //
        // MAX_CANDIDATE_KM is intentionally generous (default 25 km) — the JS scorer
        // filters further with its matchScore > 20 threshold and the top-6 slice.
        const MAX_CANDIDATE_KM = parseFloat(process.env.RECOMMENDATION_CANDIDATE_KM || '25');

        // ── Cache read ────────────────────────────────────────────────────────
        // The base SQL includes distance so it IS coordinate-specific; we therefore
        // store the pre-filtered candidate rows keyed by a rounded coordinate pair
        // to allow cache reuse for nearby requests (within 0.01° ≈ ~1 km).
        // For simplicity we round to 2 decimal places — good enough for a 25 km bucket.
        const cacheKey = `${refLat.toFixed(2)}_${refLng.toFixed(2)}`;
        let candidates = hostelCache.get(cacheKey);

        if (!candidates) {
            // Cache miss: run the SQL query with Haversine distance pre-filter
            const candidateQuery = `
                SELECT h.*, u.name as owner_name,
                       COALESCE((SELECT MIN(price) FROM rooms WHERE hostel_id = h.id), 0) as starting_price,
                       (6371 * acos(
                           cos(radians(?)) * cos(radians(h.latitude)) *
                           cos(radians(h.longitude) - radians(?)) +
                           sin(radians(?)) * sin(radians(h.latitude))
                       )) AS distance_km
                FROM hostels h
                JOIN users u ON h.owner_id = u.id
                WHERE h.is_verified = 1
                HAVING distance_km <= ?
                ORDER BY distance_km ASC
            `;

            const [rows] = await pool.query(candidateQuery, [refLat, refLng, refLat, MAX_CANDIDATE_KM]);
            candidates = rows;
            hostelCache.set(cacheKey, candidates);
        }

        // ── JS scoring over the (much smaller) candidate set ──────────────────
        const recommendations = candidates.map(hostel => {
            // distance_km was computed by SQL; parse it for the scorer
            const distance = parseFloat(hostel.distance_km);

            const matchScore = calculateMatchScore(
                {
                    ...hostel,
                    // Pre-parse amenities once here so calculateMatchScore receives an array
                    amenities: typeof hostel.amenities === 'string'
                        ? JSON.parse(hostel.amenities)
                        : (hostel.amenities || [])
                },
                preferredBudget,
                distance,
                refAmenities
            );

            return {
                ...hostel,
                amenities: typeof hostel.amenities === 'string'
                    ? JSON.parse(hostel.amenities)
                    : hostel.amenities,
                distance: parseFloat(distance.toFixed(2)),
                matchScore
            };
        });

        const sortedRecommendations = recommendations
            .filter(rec => rec.matchScore > 20)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 6);

        return ApiResponse.success(res, 'Hostel recommendations fetched', { recommendations: sortedRecommendations });

    } catch (err) {
        next(err);
    }
};

module.exports = {
    getHostels,
    getHostelById,
    createHostel,
    updateHostel,
    verifyHostel,
    deleteHostel,
    getRecommendations
};
