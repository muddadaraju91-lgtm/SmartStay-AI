const express = require('express');
const router = express.Router();
const { addReview, getReviews, deleteReview } = require('../controllers/reviewController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('student'), addReview);
router.get('/', getReviews);
router.delete('/:id', protect, deleteReview);

module.exports = router;
