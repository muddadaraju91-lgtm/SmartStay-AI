const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, createAdmin } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Private routes
router.get('/profile', protect, getUserProfile);

// Admin-only: create a new admin account.
// Requires a valid admin JWT — cannot be reached by unauthenticated callers.
router.post('/admin/create', protect, authorize('admin'), createAdmin);

module.exports = router;
