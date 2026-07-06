const cloudinary = require('../config/cloudinary');
const ApiResponse = require('../utils/apiResponse');

// Helper to handle streaming uploads to Cloudinary
const streamUpload = (fileBuffer) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'smartstay_ai_listings',
                resource_type: 'image'
            },
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        uploadStream.end(fileBuffer);
    });
};

// @desc    Upload image file to Cloudinary
// @route   POST /api/uploads
// @access  Private (Owner / Admin)
const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return ApiResponse.error(res, 'No image file uploaded', 400);
        }

        // Upload stream
        const result = await streamUpload(req.file.buffer);

        return ApiResponse.success(res, 'Image uploaded successfully', {
            imageUrl: result.secure_url,
            publicId: result.public_id
        }, 201);

    } catch (err) {
        next(err);
    }
};

module.exports = { uploadImage };
