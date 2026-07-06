const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');
const { calculateMatchScore } = require('../services/recommendationEngine');

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

        // Geolocation calculations using Haversine Formula
        if (collegeLat && collegeLng) {
            query += `, 
                (6371 * acos(
                    cos(radians(?)) * cos(radians(h.latitude)) * 
                    cos(radians(h.longitude) - radians(?)) + 
                    sin(radians(?)) * sin(radians(h.latitude))
                )) AS distance
            `;
            queryParams.push(parseFloat(collegeLat), parseFloat(collegeLng), parseFloat(collegeLat));
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
        if (search) {
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

        // Distance range filter
        if (collegeLat && collegeLng && maxDistance) {
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

        // If filtering by specific amenities in query parameter (e.g. WiFi, Gym)
        let filteredHostels = formattedHostels;
        if (amenities) {
            const amenitiesList = amenities.split(',').map(a => a.trim().toLowerCase());
            filteredHostels = formattedHostels.filter(h => {
                const hostelAmenities = (h.amenities || []).map(a => a.toLowerCase());
                return amenitiesList.every(requiredAmenity => hostelAmenities.includes(requiredAmenity));
            });
        }

        return ApiResponse.success(res, 'Hostels retrieved successfully', { hostels: filteredHostels });

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
            // Default center coordinate if student coords not passed (e.g. Bangalore center)
            refLat = 12.9716; 
            refLng = 77.5946;
        }

        const query = `
            SELECT h.*, u.name as owner_name,
                   COALESCE((SELECT MIN(price) FROM rooms WHERE hostel_id = h.id), 0) as starting_price
            FROM hostels h
            JOIN users u ON h.owner_id = u.id
            WHERE h.is_verified = 1
        `;

        const [hostels] = await pool.query(query);

        const recommendations = hostels.map(hostel => {
            const lat1 = refLat;
            const lon1 = refLng;
            const lat2 = parseFloat(hostel.latitude);
            const lon2 = parseFloat(hostel.longitude);

            const R = 6371; // km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            const matchScore = calculateMatchScore(hostel, preferredBudget, distance, refAmenities);

            return {
                ...hostel,
                amenities: typeof hostel.amenities === 'string' ? JSON.parse(hostel.amenities) : hostel.amenities,
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
