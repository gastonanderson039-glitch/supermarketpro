const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.io setup for real-time features
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Welcome route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SuperShop API' });
});

// Import routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/shops', require('./routes/shop.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/upload', require('./routes/upload.routes'));
app.use('/api/categories', require('./routes/category.routes'));
app.use('/api/reviews', require('./routes/review.routes'));
app.use('/api/delivery', require('./routes/delivery.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/promotions', require('./routes/promotion.routes'));
app.use('/api/inventory', require('./routes/inventory.routes'));
app.use('/api/analytics', require('./routes/analytics.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/settings', require('./routes/setting.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/wallet', require('./routes/wallet.routes'));
app.use('/api/reports', require('./routes/report.routes'));

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Import error handler middleware
const errorHandler = require('./middleware/error');

// Global error handler
app.use(errorHandler);

// Connect to MongoDB
const PORT = process.env.PORT || 12000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/supershop';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Start server even if MongoDB connection fails (for development purposes)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} (without MongoDB connection)`);
    });
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});