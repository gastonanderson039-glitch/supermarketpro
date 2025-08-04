const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads/shops';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
  console.log("file 1",file)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  console.log("file",file)
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Initialize upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB
  }
}).single('image'); // Make sure this matches your frontend field name

// Modified create shop route
router.post('/', 
  protect,
  authorize('vendor', 'admin'),
  (req, res, next) => {
    upload(req, res, function(err) {
      if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading
        return res.status(400).json({ message: err.message });
      } else if (err) {
        // An unknown error occurred
        return res.status(500).json({ message: err.message });
      }
      // Everything went fine, proceed to controller
      next();
    });
  },
  shopController.createShop
);

// Public routes
router.get('/', shopController.getShops);
router.get('/:id/detail', shopController.getShopById);

// Protected routes
router.get('/vendor', protect, authorize('vendor'), shopController.getVendorShops);
// router.post('/', protect,
//     upload.single('image'),
//     authorize('vendor', 'admin'), shopController.createShop);
router.put('/:id', protect, authorize('vendor', 'admin'), shopController.updateShop);
router.delete('/:id', protect, authorize('admin'), shopController.deleteShop);

// Staff management
router.post('/:id/staff', protect, authorize('vendor', 'admin'), shopController.addStaff);
router.delete('/:id/staff/:userId', protect, authorize('vendor', 'admin'), shopController.removeStaff);

module.exports = router;