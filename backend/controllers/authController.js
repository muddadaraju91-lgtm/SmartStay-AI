const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const ApiResponse = require('../utils/apiResponse');

// Generate JWT token helper
const generateToken = (id, email, role) => {
    return jwt.sign(
        { id, email, role },
        process.env.JWT_SECRET || 'super_secret_smartstay_key_2026',
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res, next) => {
    try {
        const { name, email, password, role, phone } = req.body;

        // Basic validations
        if (!name || !email || !password || !role || !phone) {
            return ApiResponse.error(res, 'All registration fields are required', 400);
        }

        if (!['student', 'owner', 'admin'].includes(role)) {
            return ApiResponse.error(res, 'Invalid user role selected', 400);
        }

        // Check if user already exists
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return ApiResponse.error(res, 'A user with this email address already exists', 400);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Save into DB
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role, phone]
        );

        const newUserId = result.insertId;

        // Generate token
        const token = generateToken(newUserId, email, role);

        return ApiResponse.success(res, 'User registered successfully', {
            token,
            user: {
                id: newUserId,
                name,
                email,
                role,
                phone
            }
        }, 201);

    } catch (err) {
        next(err);
    }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return ApiResponse.error(res, 'Email and password are required', 400);
        }

        // Query user
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return ApiResponse.error(res, 'Invalid email or password', 401);
        }

        const user = rows[0];

        // Compare password hashes
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return ApiResponse.error(res, 'Invalid email or password', 401);
        }

        // Generate token
        const token = generateToken(user.id, user.email, user.role);

        return ApiResponse.success(res, 'Login successful', {
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone
            }
        });

    } catch (err) {
        next(err);
    }
};

// @desc    Get current user profile details
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res, next) => {
    try {
        const [rows] = await pool.query('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0) {
            return ApiResponse.error(res, 'User not found', 404);
        }

        return ApiResponse.success(res, 'Profile retrieved successfully', { user: rows[0] });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile
};
