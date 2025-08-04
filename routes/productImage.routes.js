const express = require('express');
const router = express.Router();
const { 
  uploadMultiple, 
  processUpload 
} = require('../middleware/upload.middleware');
const { protect } = require('../middleware/auth');
const Product = require('../models/product.model');

/**
 * @desc    Upload product images
 * @route   POST /api/products/:id/images
 * @access  Private (Product owner or admin)
 */
router.post('/:id/images', 
  protect, 
  async (req, res, next) => {
    // Verify product exists and user has permission
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found'
      });
    }
    
    // Add product to request for middleware
    req.product = product;
    next();
  },
  uploadMultiple,
  processUpload,
  async (req, res) => {
    // Add new images to product
    const newImages = req.files.map(file => ({
      url: `/uploads/products/${req.params.id}/${file.filename}`,
      alt: file.originalname
    }));
    
    req.product.images = [...req.product.images, ...newImages];
    await req.product.save();
    
    res.status(200).json({
      status: 'success',
      data: req.product.images
    });
  }
);

module.exports = router;