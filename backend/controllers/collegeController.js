const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

// @desc    Search colleges by name (autocomplete)
// @route   GET /api/colleges/search
// @access  Public
const searchColleges = async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return ApiResponse.success(res, 'Colleges retrieved', { colleges: [] });
        }

        const searchTerm = `%${q}%`;
        const query = `
            SELECT id, name, city, state, latitude, longitude
            FROM colleges
            WHERE name LIKE ? OR city LIKE ?
            LIMIT 10
        `;
        
        const [colleges] = await pool.query(query, [searchTerm, searchTerm]);

        return ApiResponse.success(res, 'Colleges retrieved successfully', { colleges });
    } catch (err) {
        next(err);
    }
};

module.exports = { searchColleges };
