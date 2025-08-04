const express = require('express');
const router = express.Router();
const { 
  uploadSingle, 
  uploadMultiple, 
  processUpload 
} = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth');

/**
 * @desc    Upload single image
 * @route   POST /api/upload
 * @access  Private
 */
router.post('/', 
  protect, 
  uploadSingle, 
  processUpload, 
  (req, res) => {
    res.status(200).json({
      status: 'success',
      data: {
        filename: req.file.filename,
        url: `/uploads/images/${req.file.filename}`,
        originalname: req.file.originalname
      }
    });
  }
);

/**
 * @desc    Upload multiple images (max 5)
 * @route   POST /api/upload/multiple
 * @access  Private
 */
router.post('/multiple', 
  protect, 
  uploadMultiple, 
  processUpload, 
  (req, res) => {
    const files = req.files.map(file => ({
      filename: file.filename,
      url: `/uploads/images/${file.filename}`,
      originalname: file.originalname
    }));
    
    res.status(200).json({
      status: 'success',
      count: files.length,
      data: files
    });
  }
);

// Error handling middleware
router.use((err, req, res, next) => {
  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      status: 'fail',
      message: 'File too large. Maximum size is 5MB'
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).json({
      status: 'fail',
      message: 'Too many files. Maximum is 5'
    });
  }
  
  if (err.message.includes('Only image files are allowed')) {
    return res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
  
  // Sharp processing errors
  if (err.message.includes('Input file contains unsupported image format')) {
    return res.status(400).json({
      status: 'fail',
      message: 'Unsupported image format'
    });
  }
  
  // Generic error
  res.status(500).json({
    status: 'error',
    message: 'Something went wrong with the upload',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = router;