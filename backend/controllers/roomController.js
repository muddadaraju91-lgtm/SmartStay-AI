const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

// Helper to verify if user owns the hostel associated with a room action
const checkHostelOwnership = async (userId, hostelId) => {
    const [rows] = await pool.query('SELECT owner_id FROM hostels WHERE id = ?', [hostelId]);
    return rows.length > 0 && rows[0].owner_id === userId;
};

// @desc    Add a room category to a hostel
// @route   POST /api/rooms
// @access  Private (Owner Only)
const addRoom = async (req, res, next) => {
    try {
        const { hostelId, typeName, capacity, price, totalRooms } = req.body;
        const ownerId = req.user.id;

        if (!hostelId || !typeName || !capacity || !price || !totalRooms) {
            return ApiResponse.error(res, 'All room fields are required', 400);
        }

        // Verify ownership
        const isOwner = await checkHostelOwnership(ownerId, hostelId);
        if (!isOwner) {
            return ApiResponse.error(res, 'Unauthorized to add rooms to this hostel listing', 403);
        }

        // Newly added rooms default vacant_rooms equal to totalRooms
        const [result] = await pool.query(
            `INSERT INTO rooms (hostel_id, type_name, capacity, price, total_rooms, vacant_rooms) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [hostelId, typeName, parseInt(capacity), parseFloat(price), parseInt(totalRooms), parseInt(totalRooms)]
        );

        return ApiResponse.success(res, 'Room category added successfully', { roomId: result.insertId }, 201);

    } catch (err) {
        next(err);
    }
};

// @desc    Update room specifications or availability inventory
// @route   PUT /api/rooms/:id
// @access  Private (Owner Only)
const updateRoom = async (req, res, next) => {
    try {
        const roomId = parseInt(req.params.id);
        const { typeName, capacity, price, totalRooms, vacantRooms } = req.body;
        const ownerId = req.user.id;

        // Fetch room and verify parent hostel ownership
        const [roomRows] = await pool.query('SELECT hostel_id FROM rooms WHERE id = ?', [roomId]);
        if (roomRows.length === 0) {
            return ApiResponse.error(res, 'Room category not found', 404);
        }

        const isOwner = await checkHostelOwnership(ownerId, roomRows[0].hostel_id);
        if (!isOwner && req.user.role !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized modification access', 403);
        }

        const updates = [];
        const params = [];

        if (typeName) { updates.push('type_name = ?'); params.push(typeName); }
        if (capacity) { updates.push('capacity = ?'); params.push(parseInt(capacity)); }
        if (price) { updates.push('price = ?'); params.push(parseFloat(price)); }
        if (totalRooms) { updates.push('total_rooms = ?'); params.push(parseInt(totalRooms)); }
        if (vacantRooms !== undefined) { 
            updates.push('vacant_rooms = ?'); 
            params.push(parseInt(vacantRooms)); 
        }

        if (updates.length === 0) {
            return ApiResponse.error(res, 'No update attributes specified', 400);
        }

        params.push(roomId);

        await pool.query(`UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`, params);

        return ApiResponse.success(res, 'Room specifications updated successfully');

    } catch (err) {
        next(err);
    }
};

// @desc    Delete a room category
// @route   DELETE /api/rooms/:id
// @access  Private (Owner/Admin Only)
const deleteRoom = async (req, res, next) => {
    try {
        const roomId = parseInt(req.params.id);
        const ownerId = req.user.id;

        const [roomRows] = await pool.query('SELECT hostel_id FROM rooms WHERE id = ?', [roomId]);
        if (roomRows.length === 0) {
            return ApiResponse.error(res, 'Room category not found', 404);
        }

        const isOwner = await checkHostelOwnership(ownerId, roomRows[0].hostel_id);
        if (!isOwner && req.user.role !== 'admin') {
            return ApiResponse.error(res, 'Unauthorized action', 403);
        }

        await pool.query('DELETE FROM rooms WHERE id = ?', [roomId]);

        return ApiResponse.success(res, 'Room configuration deleted successfully');
    } catch (err) {
        next(err);
    }
};

// @desc    Get room specifications for a hostel listing
// @route   GET /api/rooms
// @access  Public
const getRooms = async (req, res, next) => {
    try {
        const { hostelId } = req.query;
        if (!hostelId) {
            return ApiResponse.error(res, 'hostelId is required as a query parameter', 400);
        }

        const [rooms] = await pool.query('SELECT * FROM rooms WHERE hostel_id = ?', [hostelId]);
        return ApiResponse.success(res, 'Rooms retrieved successfully', { rooms });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    addRoom,
    updateRoom,
    deleteRoom,
    getRooms
};
