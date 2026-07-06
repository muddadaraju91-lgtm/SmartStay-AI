const express = require('express');
const router = express.Router();
const { addRoom, updateRoom, deleteRoom, getRooms } = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.get('/', getRooms);
router.post('/', protect, authorize('owner'), addRoom);
router.put('/:id', protect, authorize('owner'), updateRoom);
router.delete('/:id', protect, authorize('owner', 'admin'), deleteRoom);

module.exports = router;
