const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsByShop,
    getProductsByCategory,
    toggleProductStatus,
    updateInventory,
    getFeaturedProducts,
    getBestsellerProducts,
    getProductsByShopWithStatics
} = require('../controllers/product.controller');
const { protect, authorize } = require('../middleware/auth');

// Configure storage for product images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = 'uploads/products';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        console.log("file1",file)
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'product-' + uniqueSuffix + ext);
    }
});

// File filter to only accept images
const fileFilter = (req, file, cb) => {
    console.log("file", file)
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed!'), false);
    }
};

// Initialize upload middleware with enhanced configuration
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 1024 * 1024 * 5, // 5MB limit
        files: 5 // Maximum of 5 files
    }
});

// Middleware to parse JSON fields from FormData
const parseFormDataFields = (req, res, next) => {
    if (req.body.existingImages) {
        try {
            req.body.existingImages = JSON.parse(req.body.existingImages);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid existingImages format' });
        }
    }

    if (req.body.removedImages) {
        try {
            req.body.removedImages = JSON.parse(req.body.removedImages);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid removedImages format' });
        }
    }

    if (req.body.tags) {
        try {
            req.body.tags = JSON.parse(req.body.tags);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid tags format' });
        }
    }

    if (req.body.variants) {
        try {
            req.body.variants = JSON.parse(req.body.variants);
        } catch (err) {
            return res.status(400).json({ message: 'Invalid variants format' });
        }
    }

    next();
};

// Public routes
router.get('/', getProducts);
router.get('/featured', getFeaturedProducts);
router.get('/bestsellers', getBestsellerProducts);
router.get('/:id', getProduct);
router.get('/shops-page/:shopId', getProductsByShopWithStatics);
router.get('/shops/:shopId', getProductsByShop);
router.get('/categories/:categoryId', getProductsByCategory);

// Protected routes with file upload handling
router.post(
    '/',
    protect,
    authorize('vendor', 'admin'),
    upload.array('images', 5),
    parseFormDataFields,
    createProduct
);

router.put(
    '/:id',
    protect,
    authorize('vendor', 'admin'),
    upload.array('images', 5),
    parseFormDataFields,
    updateProduct
);

// Other protected routes
router.put('/:id/status', protect, authorize('vendor', 'admin'), toggleProductStatus);
router.put('/:id/inventory', protect, authorize('vendor', 'admin'), updateInventory);
router.delete('/:id', protect, authorize('vendor', 'admin'), deleteProduct);

module.exports = router;