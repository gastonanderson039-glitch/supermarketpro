const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth.middleware');

// @desc    Upload single image
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'fail',
        message: 'No file uploaded',
      });
    }

    const filePath = `${req.protocol}://${req.get('host')}/${req.file.path}`;

    res.status(200).json({
      status: 'success',
      data: {
        filename: req.file.filename,
        path: filePath,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
});

// @desc    Upload multiple images (up to 5)
// @route   POST /api/upload/multiple
// @access  Private
router.post('/multiple', protect, upload.array('images', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No files uploaded',
      });
    }

    const fileData = req.files.map(file => ({
      filename: file.filename,
      path: `${req.protocol}://${req.get('host')}/${file.path}`,
    }));

    res.status(200).json({
      status: 'success',
      data: fileData,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
});

// Error handling middleware for multer errors
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      status: 'fail',
      message: 'File too large. Maximum size is 5MB',
    });
  }

  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      status: 'fail',
      message: err.message,
    });
  }

  next(err);
});

module.exports = router;