const Review = require('../models/review.model');
const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const Order = require('../models/order.model');
const User = require('../models/user.model');

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Public
exports.getReviews = async (req, res) => {
  try {
    const { 
      type, 
      rating, 
      isVerified,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = { isApproved: true };
    
    if (type) query.type = type;
    if (rating) query.rating = rating;
    if (isVerified !== undefined) query.isVerified = isVerified === 'true';
    
    // Count total reviews
    const total = await Review.countDocuments(query);
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .populate('product', 'name images')
      .populate('shop', 'name logo')
      .populate('deliveryPersonnel', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get review by ID
// @route   GET /api/reviews/:id
// @access  Public
exports.getReviewById = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id)
      .populate('user', 'name avatar')
      .populate('product', 'name images shop')
      .populate('shop', 'name logo')
      .populate('deliveryPersonnel', 'name avatar')
      .populate('order', 'orderNumber')
      .populate('responses.user', 'name avatar role');
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // If review is not approved, only admin, vendor, or the review author can see it
    if (!review.isApproved) {
      if (!req.user) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to view this review',
        });
      }
      
      const isAdmin = req.user.role === 'admin';
      const isAuthor = review.user && review.user._id.toString() === req.user._id.toString();
      const isVendor = req.user.role === 'vendor' && 
        ((review.shop && req.user.shops.some(s => s.shop.toString() === review.shop._id.toString() && s.role === 'owner')) ||
         (review.product && review.product.shop && req.user.shops.some(s => s.shop.toString() === review.product.shop.toString() && s.role === 'owner')));
      
      if (!isAdmin && !isAuthor && !isVendor) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to view this review',
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
exports.createReview = async (req, res) => {
  try {
    const { 
      type, 
      rating, 
      title, 
      content, 
      product, 
      shop, 
      deliveryPersonnel,
      order,
      images
    } = req.body;
    
    // Validate required fields
    if (!type || !rating) {
      return res.status(400).json({
        status: 'fail',
        message: 'Type and rating are required',
      });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        status: 'fail',
        message: 'Rating must be between 1 and 5',
      });
    }
    
    // Validate type-specific fields
    if (type === 'product' && !product) {
      return res.status(400).json({
        status: 'fail',
        message: 'Product ID is required for product reviews',
      });
    }
    
    if (type === 'shop' && !shop) {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop ID is required for shop reviews',
      });
    }
    
    if (type === 'delivery' && !deliveryPersonnel) {
      return res.status(400).json({
        status: 'fail',
        message: 'Delivery personnel ID is required for delivery reviews',
      });
    }
    
    // Check if user has purchased the product (for product reviews)
    let isVerified = false;
    
    if (type === 'product' && product) {
      const orders = await Order.find({
        customer: req.user._id,
        status: 'delivered',
        'items.product': product,
      });
      
      isVerified = orders.length > 0;
      
      // If order ID is provided, check if it contains the product
      if (order) {
        const orderExists = await Order.findOne({
          _id: order,
          customer: req.user._id,
          status: 'delivered',
          'items.product': product,
        });
        
        if (!orderExists) {
          return res.status(400).json({
            status: 'fail',
            message: 'The specified order does not contain this product or is not delivered',
          });
        }
      }
    }
    
    // Check if user has ordered from the shop (for shop reviews)
    if (type === 'shop' && shop) {
      const orders = await Order.find({
        customer: req.user._id,
        shop,
        status: 'delivered',
      });
      
      isVerified = orders.length > 0;
      
      // If order ID is provided, check if it's from this shop
      if (order) {
        const orderExists = await Order.findOne({
          _id: order,
          customer: req.user._id,
          shop,
          status: 'delivered',
        });
        
        if (!orderExists) {
          return res.status(400).json({
            status: 'fail',
            message: 'The specified order is not from this shop or is not delivered',
          });
        }
      }
    }
    
    // Check if user has received a delivery from this personnel (for delivery reviews)
    if (type === 'delivery' && deliveryPersonnel) {
      const orders = await Order.find({
        customer: req.user._id,
        deliveryPersonnel,
        status: 'delivered',
      });
      
      isVerified = orders.length > 0;
      
      // If order ID is provided, check if it was delivered by this personnel
      if (order) {
        const orderExists = await Order.findOne({
          _id: order,
          customer: req.user._id,
          deliveryPersonnel,
          status: 'delivered',
        });
        
        if (!orderExists) {
          return res.status(400).json({
            status: 'fail',
            message: 'The specified order was not delivered by this personnel or is not delivered',
          });
        }
      }
    }
    
    // Check if user has already reviewed this item
    const existingReview = await Review.findOne({
      user: req.user._id,
      type,
      ...(type === 'product' && { product }),
      ...(type === 'shop' && { shop }),
      ...(type === 'delivery' && { deliveryPersonnel }),
      ...(order && { order }),
    });
    
    if (existingReview) {
      return res.status(400).json({
        status: 'fail',
        message: 'You have already reviewed this item',
      });
    }
    
    // Create review
    const review = await Review.create({
      user: req.user._id,
      type,
      rating,
      title,
      content,
      ...(product && { product }),
      ...(shop && { shop }),
      ...(deliveryPersonnel && { deliveryPersonnel }),
      ...(order && { order }),
      isVerified,
      images,
      isApproved: true, // Auto-approve for now, in a real app this might be false until moderated
    });
    
    // Update product rating if it's a product review
    if (type === 'product' && product) {
      await updateProductRating(product);
    }
    
    // Update shop rating if it's a shop review
    if (type === 'shop' && shop) {
      await updateShopRating(shop);
    }
    
    // Update delivery personnel rating if it's a delivery review
    if (type === 'delivery' && deliveryPersonnel) {
      await updateDeliveryPersonnelRating(deliveryPersonnel);
    }
    
    res.status(201).json({
      status: 'success',
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update review
// @route   PUT /api/reviews/:id
// @access  Private
exports.updateReview = async (req, res) => {
  try {
    const { 
      rating, 
      title, 
      content, 
      images
    } = req.body;
    
    // Find review
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user is the author of the review
    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to update this review',
      });
    }
    
    // Check if review is older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (new Date(review.createdAt) < thirtyDaysAgo) {
      return res.status(400).json({
        status: 'fail',
        message: 'Reviews can only be updated within 30 days of creation',
      });
    }
    
    // Validate rating
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Rating must be between 1 and 5',
      });
    }
    
    // Update review
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      {
        rating: rating || review.rating,
        title: title !== undefined ? title : review.title,
        content: content !== undefined ? content : review.content,
        images: images || review.images,
        isEdited: true,
        editedAt: Date.now(),
      },
      { new: true }
    );
    
    // Update ratings if rating changed
    if (rating && rating !== review.rating) {
      if (review.type === 'product' && review.product) {
        await updateProductRating(review.product);
      } else if (review.type === 'shop' && review.shop) {
        await updateShopRating(review.shop);
      } else if (review.type === 'delivery' && review.deliveryPersonnel) {
        await updateDeliveryPersonnelRating(review.deliveryPersonnel);
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedReview,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private (Admin, Vendor)
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user has permission to delete this review
    if (req.user.role === 'admin') {
      // Admin can delete any review
    } else if (req.user.role === 'vendor') {
      // Vendor can only delete reviews for their shops or products
      let hasAccess = false;
      
      if (review.shop) {
        hasAccess = req.user.shops.some(shop => 
          shop.shop.toString() === review.shop.toString() && 
          shop.role === 'owner'
        );
      } else if (review.product) {
        const product = await Product.findById(review.product);
        if (product && product.shop) {
          hasAccess = req.user.shops.some(shop => 
            shop.shop.toString() === product.shop.toString() && 
            shop.role === 'owner'
          );
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this review',
        });
      }
    } else {
      // Regular users can only delete their own reviews
      if (review.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this review',
        });
      }
      
      // Check if review is older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      if (new Date(review.createdAt) < thirtyDaysAgo) {
        return res.status(400).json({
          status: 'fail',
          message: 'Reviews can only be deleted within 30 days of creation',
        });
      }
    }
    
    await review.deleteOne();
    
    // Update ratings
    if (review.type === 'product' && review.product) {
      await updateProductRating(review.product);
    } else if (review.type === 'shop' && review.shop) {
      await updateShopRating(review.shop);
    } else if (review.type === 'delivery' && review.deliveryPersonnel) {
      await updateDeliveryPersonnelRating(review.deliveryPersonnel);
    }
    
    res.status(200).json({
      status: 'success',
      message: 'Review deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get product reviews
// @route   GET /api/reviews/product/:productId
// @access  Public
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      rating, 
      verified,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Build query
    const query = {
      product: productId,
      type: 'product',
      isApproved: true,
    };
    
    if (rating) query.rating = rating;
    if (verified !== undefined) query.isVerified = verified === 'true';
    
    // Count total reviews
    const total = await Review.countDocuments(query);
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { product: product._id, type: 'product', isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    
    // Format rating distribution
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    
    ratingDistribution.forEach(item => {
      distribution[item._id] = item.count;
    });
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      averageRating: product.rating,
      ratingDistribution: distribution,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get shop reviews
// @route   GET /api/reviews/shop/:shopId
// @access  Public
exports.getShopReviews = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { 
      rating, 
      verified,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Build query
    const query = {
      shop: shopId,
      type: 'shop',
      isApproved: true,
    };
    
    if (rating) query.rating = rating;
    if (verified !== undefined) query.isVerified = verified === 'true';
    
    // Count total reviews
    const total = await Review.countDocuments(query);
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { shop: shop._id, type: 'shop', isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    
    // Format rating distribution
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    
    ratingDistribution.forEach(item => {
      distribution[item._id] = item.count;
    });
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      averageRating: shop.rating,
      ratingDistribution: distribution,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get delivery personnel reviews
// @route   GET /api/reviews/delivery/:deliveryPersonnelId
// @access  Public
exports.getDeliveryPersonnelReviews = async (req, res) => {
  try {
    const { deliveryPersonnelId } = req.params;
    const { 
      rating, 
      verified,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Check if delivery personnel exists
    const deliveryPersonnel = await User.findById(deliveryPersonnelId);
    if (!deliveryPersonnel || !['delivery', 'global_delivery'].includes(deliveryPersonnel.role)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Delivery personnel not found',
      });
    }
    
    // Build query
    const query = {
      deliveryPersonnel: deliveryPersonnelId,
      type: 'delivery',
      isApproved: true,
    };
    
    if (rating) query.rating = rating;
    if (verified !== undefined) query.isVerified = verified === 'true';
    
    // Count total reviews
    const total = await Review.countDocuments(query);
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    // Get rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { deliveryPersonnel: deliveryPersonnel._id, type: 'delivery', isApproved: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);
    
    // Format rating distribution
    const distribution = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };
    
    ratingDistribution.forEach(item => {
      distribution[item._id] = item.count;
    });
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      averageRating: deliveryPersonnel.deliveryPersonnelDetails?.rating || 0,
      ratingDistribution: distribution,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get user reviews
// @route   GET /api/reviews/user
// @access  Private
exports.getUserReviews = async (req, res) => {
  try {
    const { 
      type, 
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = { user: req.user._id };
    
    if (type) query.type = type;
    
    // Count total reviews
    const total = await Review.countDocuments(query);
    
    // Get reviews
    const reviews = await Review.find(query)
      .populate('product', 'name images')
      .populate('shop', 'name logo')
      .populate('deliveryPersonnel', 'name avatar')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Respond to review
// @route   POST /api/reviews/:id/respond
// @access  Private (Admin, Vendor, Staff)
exports.respondToReview = async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        status: 'fail',
        message: 'Response content is required',
      });
    }
    
    // Find review
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user has permission to respond to this review
    let hasAccess = false;
    
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      if (review.shop) {
        hasAccess = req.user.shops.some(shop => 
          shop.shop.toString() === review.shop.toString() && 
          (shop.role === 'owner' || shop.role === 'staff')
        );
      } else if (review.product) {
        const product = await Product.findById(review.product);
        if (product && product.shop) {
          hasAccess = req.user.shops.some(shop => 
            shop.shop.toString() === product.shop.toString() && 
            (shop.role === 'owner' || shop.role === 'staff')
          );
        }
      } else if (review.deliveryPersonnel && review.deliveryPersonnel.toString() === req.user._id.toString()) {
        hasAccess = true;
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to respond to this review',
      });
    }
    
    // Check if user has already responded
    const existingResponse = review.responses.find(
      response => response.user.toString() === req.user._id.toString()
    );
    
    if (existingResponse) {
      // Update existing response
      existingResponse.content = content;
      existingResponse.updatedAt = Date.now();
    } else {
      // Add new response
      review.responses.push({
        user: req.user._id,
        content,
      });
    }
    
    await review.save();
    
    // Populate response user
    await review.populate('responses.user', 'name avatar role');
    
    res.status(200).json({
      status: 'success',
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark review as helpful
// @route   POST /api/reviews/:id/helpful
// @access  Private
exports.markReviewHelpful = async (req, res) => {
  try {
    // Find review
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user has already marked this review as helpful
    const alreadyMarked = review.helpfulVotes.includes(req.user._id);
    
    if (alreadyMarked) {
      // Remove vote
      review.helpfulVotes = review.helpfulVotes.filter(
        userId => userId.toString() !== req.user._id.toString()
      );
    } else {
      // Add vote
      review.helpfulVotes.push(req.user._id);
    }
    
    await review.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        helpful: !alreadyMarked,
        helpfulCount: review.helpfulVotes.length,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Report review
// @route   POST /api/reviews/:id/report
// @access  Private
exports.reportReview = async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        status: 'fail',
        message: 'Report reason is required',
      });
    }
    
    // Find review
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user has already reported this review
    const alreadyReported = review.reports.some(
      report => report.user.toString() === req.user._id.toString()
    );
    
    if (alreadyReported) {
      return res.status(400).json({
        status: 'fail',
        message: 'You have already reported this review',
      });
    }
    
    // Add report
    review.reports.push({
      user: req.user._id,
      reason,
    });
    
    // If review has multiple reports, mark it for moderation
    if (review.reports.length >= 3) {
      review.needsModeration = true;
    }
    
    await review.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Review reported successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Moderate review
// @route   PUT /api/reviews/:id/moderate
// @access  Private (Admin, Vendor)
exports.moderateReview = async (req, res) => {
  try {
    const { 
      isApproved, 
      moderationNote
    } = req.body;
    
    // Find review
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return res.status(404).json({
        status: 'fail',
        message: 'Review not found',
      });
    }
    
    // Check if user has permission to moderate this review
    let hasAccess = false;
    
    if (req.user.role === 'admin') {
      hasAccess = true;
    } else if (req.user.role === 'vendor') {
      if (review.shop) {
        hasAccess = req.user.shops.some(shop => 
          shop.shop.toString() === review.shop.toString() && 
          shop.role === 'owner'
        );
      } else if (review.product) {
        const product = await Product.findById(review.product);
        if (product && product.shop) {
          hasAccess = req.user.shops.some(shop => 
            shop.shop.toString() === product.shop.toString() && 
            shop.role === 'owner'
          );
        }
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({
        status: 'fail',
        message: 'Not authorized to moderate this review',
      });
    }
    
    // Update review
    const updatedReview = await Review.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: isApproved !== undefined ? isApproved : review.isApproved,
        needsModeration: false,
        moderatedBy: req.user._id,
        moderatedAt: Date.now(),
        moderationNote,
      },
      { new: true }
    );
    
    // Update ratings if approval status changed
    if (isApproved !== undefined && isApproved !== review.isApproved) {
      if (review.type === 'product' && review.product) {
        await updateProductRating(review.product);
      } else if (review.type === 'shop' && review.shop) {
        await updateShopRating(review.shop);
      } else if (review.type === 'delivery' && review.deliveryPersonnel) {
        await updateDeliveryPersonnelRating(review.deliveryPersonnel);
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedReview,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get reported reviews
// @route   GET /api/reviews/reported
// @access  Private (Admin, Vendor)
exports.getReportedReviews = async (req, res) => {
  try {
    const { 
      shop, 
      page = 1,
      limit = 10,
      sort = '-reports.length'
    } = req.query;
    
    // Build query
    const query = {
      $or: [
        { needsModeration: true },
        { 'reports.0': { $exists: true } },
      ],
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all reported reviews
      if (shop) {
        query.$or = [
          { shop },
          { 
            product: { $exists: true },
            'product.shop': shop,
          },
        ];
      }
    } else if (req.user.role === 'vendor') {
      // Vendor can only see reported reviews for their shops or products
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access reviews for this shop',
          });
        }
        
        query.$or = [
          { shop },
          { 
            product: { $exists: true },
            'product.shop': shop,
          },
        ];
      } else {
        query.$or = [
          { shop: { $in: shopIds } },
          { 
            product: { $exists: true },
            'product.shop': { $in: shopIds },
          },
        ];
      }
    }
    
    // Count total reported reviews
    const total = await Review.countDocuments(query);
    
    // Get reported reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .populate('product', 'name images shop')
      .populate('shop', 'name logo')
      .populate('deliveryPersonnel', 'name avatar')
      .populate('reports.user', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get featured reviews
// @route   GET /api/reviews/featured
// @access  Public
exports.getFeaturedReviews = async (req, res) => {
  try {
    const { 
      type, 
      limit = 5
    } = req.query;
    
    // Build query
    const query = {
      isApproved: true,
      rating: { $gte: 4 }, // Only 4+ star reviews
      content: { $exists: true, $ne: '' }, // Must have content
    };
    
    if (type) query.type = type;
    
    // Get featured reviews
    const reviews = await Review.find(query)
      .populate('user', 'name avatar')
      .populate('product', 'name images shop')
      .populate('shop', 'name logo')
      .populate('deliveryPersonnel', 'name avatar')
      .sort('-helpfulVotes.length -createdAt')
      .limit(parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// Helper function to update product rating
const updateProductRating = async (productId) => {
  try {
    // Get all approved reviews for this product
    const reviews = await Review.find({
      product: productId,
      type: 'product',
      isApproved: true,
    });
    
    // Calculate average rating
    let totalRating = 0;
    let reviewCount = 0;
    
    reviews.forEach(review => {
      totalRating += review.rating;
      reviewCount++;
    });
    
    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    
    // Update product rating
    await Product.findByIdAndUpdate(productId, {
      rating: averageRating,
      reviewCount,
    });
    
    return averageRating;
  } catch (error) {
    console.error('Error updating product rating:', error);
    throw error;
  }
};

// Helper function to update shop rating
const updateShopRating = async (shopId) => {
  try {
    // Get all approved reviews for this shop
    const reviews = await Review.find({
      shop: shopId,
      type: 'shop',
      isApproved: true,
    });
    
    // Calculate average rating
    let totalRating = 0;
    let reviewCount = 0;
    
    reviews.forEach(review => {
      totalRating += review.rating;
      reviewCount++;
    });
    
    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    
    // Update shop rating
    await Shop.findByIdAndUpdate(shopId, {
      rating: averageRating,
      reviewCount,
    });
    
    return averageRating;
  } catch (error) {
    console.error('Error updating shop rating:', error);
    throw error;
  }
};

// Helper function to update delivery personnel rating
const updateDeliveryPersonnelRating = async (personnelId) => {
  try {
    // Get all approved reviews for this delivery personnel
    const reviews = await Review.find({
      deliveryPersonnel: personnelId,
      type: 'delivery',
      isApproved: true,
    });
    
    // Calculate average rating
    let totalRating = 0;
    let reviewCount = 0;
    
    reviews.forEach(review => {
      totalRating += review.rating;
      reviewCount++;
    });
    
    const averageRating = reviewCount > 0 ? totalRating / reviewCount : 0;
    
    // Update delivery personnel rating
    await User.findByIdAndUpdate(personnelId, {
      'deliveryPersonnelDetails.rating': averageRating,
      'deliveryPersonnelDetails.reviewCount': reviewCount,
    });
    
    return averageRating;
  } catch (error) {
    console.error('Error updating delivery personnel rating:', error);
    throw error;
  }
};