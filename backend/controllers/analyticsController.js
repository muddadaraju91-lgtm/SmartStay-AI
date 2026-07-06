const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

// @desc    Get dashboard analytics metrics
// @route   GET /api/analytics/dashboard
// @access  Private (Owner / Admin Only)
const getDashboardAnalytics = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;

        if (userRole === 'student') {
            return ApiResponse.error(res, 'Student account cannot access metrics dashboard', 403);
        }

        if (userRole === 'owner') {
            // 1. Fetch Owner property statistics
            const [hostels] = await pool.query('SELECT id FROM hostels WHERE owner_id = ?', [userId]);
            
            if (hostels.length === 0) {
                return ApiResponse.success(res, 'No properties onboarded yet', {
                    totalBookings: 0,
                    occupancyRate: 0,
                    monthlyRevenue: 0,
                    vacancyRate: 0,
                    recentBookings: []
                });
            }

            const hostelIds = hostels.map(h => h.id);

            // Total rooms vs vacant rooms for occupancy rates calculation
            const [rooms] = await pool.query(
                'SELECT SUM(total_rooms) as total, SUM(vacant_rooms) as vacant FROM rooms WHERE hostel_id IN (?)',
                [hostelIds]
            );

            const totalRooms = parseInt(rooms[0].total) || 0;
            const vacantRooms = parseInt(rooms[0].vacant) || 0;
            const occupiedRooms = totalRooms - vacantRooms;
            
            const occupancyRate = totalRooms > 0 ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0;
            const vacancyRate = totalRooms > 0 ? parseFloat(((vacantRooms / totalRooms) * 100).toFixed(1)) : 0;

            // Total bookings volume
            const [bookingsCount] = await pool.query(
                `SELECT COUNT(b.id) as count 
                 FROM bookings b
                 JOIN rooms r ON b.room_id = r.id
                 WHERE r.hostel_id IN (?)`,
                [hostelIds]
            );

            // Monthly revenue (Sum of all 'paid' status bookings)
            const [revenue] = await pool.query(
                `SELECT SUM(b.total_amount) as total 
                 FROM bookings b
                 JOIN rooms r ON b.room_id = r.id
                 WHERE r.hostel_id IN (?) AND b.status = 'paid'`,
                [hostelIds]
            );

            // Fetch recent 5 booking activities
            const [recentBookings] = await pool.query(
                `SELECT b.id, b.status, b.total_amount, b.created_at, b.check_in_date,
                        u.name as student_name, r.type_name as room_type
                 FROM bookings b
                 JOIN users u ON b.student_id = u.id
                 JOIN rooms r ON b.room_id = r.id
                 WHERE r.hostel_id IN (?)
                 ORDER BY b.created_at DESC LIMIT 5`,
                [hostelIds]
            );

            return ApiResponse.success(res, 'Owner analytics dashboard metrics fetched', {
                totalBookings: bookingsCount[0].count || 0,
                occupancyRate,
                monthlyRevenue: parseFloat(revenue[0].total) || 0,
                vacancyRate,
                recentBookings
            });
        }

        if (userRole === 'admin') {
            // 2. Fetch Admin global platform statistics
            const [usersCount] = await pool.query(
                `SELECT 
                    SUM(CASE WHEN role = 'student' THEN 1 ELSE 0 END) as students,
                    SUM(CASE WHEN role = 'owner' THEN 1 ELSE 0 END) as owners
                 FROM users`
            );

            const [hostelsCount] = await pool.query(
                `SELECT 
                    COUNT(id) as total,
                    SUM(CASE WHEN is_verified = 1 THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN is_verified = 0 THEN 1 ELSE 0 END) as pending
                 FROM hostels`
            );

            const [globalBookings] = await pool.query('SELECT COUNT(id) as count FROM bookings');
            const [globalRevenue] = await pool.query("SELECT SUM(total_amount) as total FROM bookings WHERE status = 'paid'");

            const [recentVerifiedQueue] = await pool.query(
                `SELECT h.id, h.name, h.address, h.created_at, u.name as owner_name 
                 FROM hostels h
                 JOIN users u ON h.owner_id = u.id
                 WHERE h.is_verified = 0
                 ORDER BY h.created_at DESC LIMIT 5`
            );

            return ApiResponse.success(res, 'Admin analytics dashboard metrics fetched', {
                totalStudents: parseInt(usersCount[0].students) || 0,
                totalOwners: parseInt(usersCount[0].owners) || 0,
                totalHostels: parseInt(hostelsCount[0].total) || 0,
                verifiedHostels: parseInt(hostelsCount[0].verified) || 0,
                pendingVerification: parseInt(hostelsCount[0].pending) || 0,
                totalBookings: globalBookings[0].count || 0,
                totalRevenue: parseFloat(globalRevenue[0].total) || 0,
                verificationQueue: recentVerifiedQueue
            });
        }

    } catch (err) {
        next(err);
    }
};

module.exports = { getDashboardAnalytics };
