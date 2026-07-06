const express = require('express');
const router = express.Router();
const { createPaymentOrder, verifyPayment } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/order', protect, authorize('student'), createPaymentOrder);
router.post('/verify', protect, authorize('student'), verifyPayment);

module.exports = router;
