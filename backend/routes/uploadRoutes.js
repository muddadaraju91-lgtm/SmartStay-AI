const express = require('express');
const router = express.Router();
const { uploadImage } = require('../controllers/uploadController');
const upload = require('../middleware/uploadMiddleware');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/', protect, authorize('owner', 'admin'), upload.single('image'), uploadImage);

module.exports = router;
