const multer = require('multer');

// Stream uploads directly from RAM buffers to prevent ephemeral filesystem issues
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    // Only accept image formats
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file format. Only image uploads are permitted.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

module.exports = upload;
