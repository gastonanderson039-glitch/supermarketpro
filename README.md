# Supermarket Pro Backend API Documentation

This document provides comprehensive documentation for all available endpoints in the Supermarket Pro backend API.

## Authentication

### Public Routes
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Authenticate and login
- `POST /auth/forgot-password` - Request password reset
- `PUT /auth/reset-password/:resetToken` - Reset password using reset token

### Protected Routes
- `GET /auth/profile` - Get user profile (requires authentication)
- `PUT /auth/profile` - Update user profile (requires authentication)
- `PUT /auth/change-password` - Change user password (requires authentication)

## User Management
- `GET /users` - Get list of users (admin only)
- `GET /users/:id` - Get specific user details
- `PUT /users/:id` - Update user details
- `DELETE /users/:id` - Delete user

## Product Management
- `GET /products` - List all products
- `GET /products/:id` - Get specific product details
- `POST /products` - Create new product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product

## Category Management
- `GET /categories` - List all categories
- `GET /categories/:id` - Get specific category
- `POST /categories` - Create new category
- `PUT /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

## Shopping Cart
- `GET /cart` - Get user's cart (requires authentication)
- `POST /cart` - Add item to cart
- `PUT /cart/:id` - Update cart item
- `DELETE /cart/:id` - Remove item from cart

## Orders
- `GET /orders` - List user's orders (requires authentication)
- `GET /orders/:id` - Get specific order details
- `POST /orders` - Create new order
- `PUT /orders/:id` - Update order status
- `DELETE /orders/:id` - Cancel order

## Payment
- `POST /payment` - Process payment
- `GET /payment/verify/:id` - Verify payment status
- `POST /payment/refund` - Request refund

## Inventory Management
- `GET /inventory` - Get inventory levels
- `PUT /inventory/:id` - Update inventory
- `POST /inventory/reorder` - Request reorder

## Analytics
- `GET /analytics/sales` - Get sales analytics
- `GET /analytics/inventory` - Get inventory analytics
- `GET /analytics/customers` - Get customer analytics

## Reports
- `GET /reports/sales` - Generate sales reports
- `GET /reports/inventory` - Generate inventory reports
- `GET /reports/customers` - Generate customer reports

## Notifications
- `GET /notifications` - Get user notifications
- `POST /notifications` - Send notification
- `PUT /notifications/:id` - Update notification status

## Reviews
- `GET /reviews` - Get product reviews
- `POST /reviews` - Submit new review
- `PUT /reviews/:id` - Update review
- `DELETE /reviews/:id` - Delete review

## Shop Management
- `GET /shops` - List all shops
- `GET /shops/:id` - Get specific shop details
- `POST /shops` - Create new shop
- `PUT /shops/:id` - Update shop
- `DELETE /shops/:id` - Delete shop

## Settings
- `GET /settings` - Get application settings
- `PUT /settings` - Update application settings

## File Uploads
- `POST /upload` - Upload files
- `GET /upload/:id` - Get uploaded file
- `DELETE /upload/:id` - Delete uploaded file

## Delivery Management
- `GET /delivery` - Get delivery information
- `POST /delivery` - Create delivery request
- `PUT /delivery/:id` - Update delivery status
- `DELETE /delivery/:id` - Cancel delivery

## Promotion Management
- `GET /promotions` - List all promotions
- `GET /promotions/:id` - Get specific promotion
- `POST /promotions` - Create new promotion
- `PUT /promotions/:id` - Update promotion
- `DELETE /promotions/:id` - Delete promotion

## Wallet Management
- `GET /wallet` - Get user wallet balance
- `PUT /wallet` - Update wallet balance
- `POST /wallet/transaction` - Process wallet transaction

## Technical Details
- **Base URL**: `http://localhost:3000` (default)
- **Authentication**: JWT-based authentication
- **Response Format**: JSON
- **Error Handling**: Standard HTTP status codes with JSON error messages

## Error Codes
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 500: Internal Server Error

## Security
- All routes except authentication routes require valid JWT token
- Rate limiting implemented
- Input validation on all endpoints
- SQL injection prevention
- XSS protection
