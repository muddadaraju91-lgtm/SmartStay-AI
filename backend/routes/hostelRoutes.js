const express = require('express');
const router = express.Router();
const { getHostels, getHostelById, createHostel, updateHostel, verifyHostel, deleteHostel, getRecommendations } = require('../controllers/hostelController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', getHostels);
router.get('/recommendations', protect, getRecommendations);
router.get('/:id', getHostelById);
router.post('/', protect, authorize('owner'), createHostel);
router.put('/:id', protect, authorize('owner'), updateHostel);
router.put('/:id/verify', protect, authorize('admin'), verifyHostel);
router.delete('/:id', protect, authorize('owner', 'admin'), deleteHostel);

module.exports = router;
