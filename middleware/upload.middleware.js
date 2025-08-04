const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');

// Ensure directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/images';
    
    // If uploading for a product, use product-specific folder
    if (req.baseUrl.includes('products')) {
      uploadPath = path.join('uploads', 'products', req.params.id || 'temp');
    }
    
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpg, jpeg, png, webp, gif)'), false);
  }
};

// Process single image
const processImage = async (file) => {
  const processedFilename = `processed_${file.filename}`;
  const outputPath = path.join(file.destination, processedFilename);
  
  await sharp(file.path)
    .resize(1200, 1200, { 
      fit: 'inside', 
      withoutEnlargement: true 
    })
    .jpeg({ 
      quality: 80, 
      progressive: true 
    })
    .toFile(outputPath);
    
  // Remove original file
  fs.unlinkSync(file.path);
  
  return {
    filename: processedFilename,
    path: outputPath,
    originalname: file.originalname
  };
};

// Middleware for processing uploaded images
const processUpload = async (req, res, next) => {
  try {
    if (req.file) {
      req.file = await processImage(req.file);
    } else if (req.files) {
      req.files = await Promise.all(req.files.map(processImage));
    }
    next();
  } catch (err) {
    next(err);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // Max 5 files
  }
});

module.exports = {
  uploadSingle: upload.single('image'),
  uploadMultiple: upload.array('images', 5),
  processUpload
};