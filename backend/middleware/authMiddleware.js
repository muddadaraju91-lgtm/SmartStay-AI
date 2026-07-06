const jwt = require('jsonwebtoken');
const ApiResponse = require('../utils/apiResponse');
require('dotenv').config();

// Standard verify JWT middleware
const protect = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_smartstay_key_2026');
            req.user = decoded; // Contains id, email, role
            return next();
        } catch (error) {
            console.error('JWT Verification Error:', error.message);
            return ApiResponse.error(res, 'Not authorized, token failed', 401);
        }
    }

    if (!token) {
        return ApiResponse.error(res, 'Not authorized, no token provided', 401);
    }
};

// Role authorization checks
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return ApiResponse.error(res, `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this route`, 403);
        }
        next();
    };
};

module.exports = { protect, authorize };
