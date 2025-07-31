const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const Promotion = require('../models/promotion.model');

// @desc    Get cart
// @route   GET /api/cart
// @access  Public
exports.getCart = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId })
      .populate({
        path: 'items.product',
        select: 'name price images category shop isActive stock',
        populate: {
          path: 'shop',
          select: 'name logo status',
        },
      })
      .populate('shops.shop', 'name logo status');
    
    if (!cart) {
      // Return empty cart
      return res.status(200).json({
        status: 'success',
        data: {
          items: [],
          shops: [],
          subtotal: 0,
          tax: 0,
          deliveryFee: 0,
          discount: 0,
          total: 0,
        },
      });
    }
    
    // Filter out items from inactive shops or products
    const activeItems = cart.items.filter(item => 
      item.product.isActive && 
      item.product.shop.status === 'active'
    );
    
    // If items have changed, update cart
    if (activeItems.length !== cart.items.length) {
      cart.items = activeItems;
      await cart.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add to cart
// @route   POST /api/cart
// @access  Public
exports.addToCart = async (req, res) => {
  try {
    const { 
      productId, 
      quantity = 1, 
      variant,
      notes,
      sessionId
    } = req.body;
    
    const userId = req.user ? req.user._id : null;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Check if product exists
    const product = await Product.findById(productId)
      .populate('shop', 'name status');
    
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if product is active
    if (!product.isActive) {
      return res.status(400).json({
        status: 'fail',
        message: 'Product is not available',
      });
    }
    
    // Check if shop is active
    if (product.shop.status !== 'active') {
      return res.status(400).json({
        status: 'fail',
        message: 'Shop is not active',
      });
    }
    
    // Check if product has enough stock
    if (product.stock < quantity) {
      return res.status(400).json({
        status: 'fail',
        message: `Only ${product.stock} items available in stock`,
      });
    }
    
    // Get or create cart
    let cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      cart = new Cart({
        ...(userId ? { user: userId } : { sessionId }),
        items: [],
        shops: [],
      });
    }
    
    // Check if product already exists in cart
    const existingItemIndex = cart.items.findIndex(item => 
      item.product.toString() === productId && 
      JSON.stringify(item.variant || {}) === JSON.stringify(variant || {})
    );
    
    if (existingItemIndex !== -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].notes = notes || cart.items[existingItemIndex].notes;
      
      // Check if new quantity exceeds stock
      if (cart.items[existingItemIndex].quantity > product.stock) {
        cart.items[existingItemIndex].quantity = product.stock;
      }
    } else {
      // Add new item
      cart.items.push({
        product: productId,
        shop: product.shop._id,
        quantity,
        price: product.price,
        totalPrice: product.price * quantity,
        variant,
        notes,
      });
    }
    
    // Update cart status and last activity
    cart.status = 'active';
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update cart item
// @route   PUT /api/cart/items/:itemId
// @access  Public
exports.updateCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity, notes } = req.body;
    
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Cart not found',
      });
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({
        status: 'fail',
        message: 'Item not found in cart',
      });
    }
    
    // Check if product has enough stock
    if (quantity) {
      const product = await Product.findById(cart.items[itemIndex].product);
      
      if (!product) {
        return res.status(404).json({
          status: 'fail',
          message: 'Product not found',
        });
      }
      
      if (product.stock < quantity) {
        return res.status(400).json({
          status: 'fail',
          message: `Only ${product.stock} items available in stock`,
        });
      }
      
      // Update quantity and total price
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].price * quantity;
    }
    
    // Update notes if provided
    if (notes !== undefined) {
      cart.items[itemIndex].notes = notes;
    }
    
    // Update last activity
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Remove cart item
// @route   DELETE /api/cart/items/:itemId
// @access  Public
exports.removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Cart not found',
      });
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
    
    if (itemIndex === -1) {
      return res.status(404).json({
        status: 'fail',
        message: 'Item not found in cart',
      });
    }
    
    // Remove item
    cart.items.splice(itemIndex, 1);
    
    // Update last activity
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Clear cart
// @route   DELETE /api/cart
// @access  Public
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Cart not found',
      });
    }
    
    // Clear items and shops
    cart.items = [];
    cart.shops = [];
    cart.subtotal = 0;
    cart.tax = 0;
    cart.deliveryFee = 0;
    cart.packagingFee = 0;
    cart.serviceFee = 0;
    cart.discount = 0;
    cart.total = 0;
    cart.coupons = [];
    
    // Update last activity
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Cart cleared successfully',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Apply coupon
// @route   POST /api/cart/coupon
// @access  Public
exports.applyCoupon = async (req, res) => {
  try {
    const { code, shopId } = req.body;
    
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Cart not found',
      });
    }
    
    // Check if cart has items
    if (cart.items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cart is empty',
      });
    }
    
    // Find promotion by code
    const promotion = await Promotion.findOne({ 
      code,
      isActive: true,
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });
    
    if (!promotion) {
      return res.status(404).json({
        status: 'fail',
        message: 'Invalid or expired coupon code',
      });
    }
    
    // Check if promotion is applicable to this shop
    if (!promotion.isGlobal && promotion.shop) {
      if (!shopId) {
        return res.status(400).json({
          status: 'fail',
          message: 'Shop ID is required for shop-specific coupons',
        });
      }
      
      if (promotion.shop.toString() !== shopId) {
        return res.status(400).json({
          status: 'fail',
          message: 'This coupon is not applicable to this shop',
        });
      }
      
      // Check if cart has items from this shop
      const hasShopItems = cart.items.some(item => 
        item.shop.toString() === shopId
      );
      
      if (!hasShopItems) {
        return res.status(400).json({
          status: 'fail',
          message: 'No items from this shop in cart',
        });
      }
    }
    
    // Check minimum purchase requirement
    let applicableAmount = 0;
    
    if (shopId && promotion.shop && promotion.shop.toString() === shopId) {
      // Calculate subtotal for this shop
      applicableAmount = cart.items
        .filter(item => item.shop.toString() === shopId)
        .reduce((sum, item) => sum + item.totalPrice, 0);
    } else if (promotion.isGlobal) {
      // Global promotion applies to all items
      applicableAmount = cart.subtotal;
    }
    
    if (promotion.minimumPurchase && applicableAmount < promotion.minimumPurchase) {
      return res.status(400).json({
        status: 'fail',
        message: `Minimum purchase of ${promotion.minimumPurchase} required to use this coupon`,
        minimumPurchase: promotion.minimumPurchase,
      });
    }
    
    // Check if promotion has reached usage limit
    if (promotion.usageLimit.total > 0 && promotion.currentUsage >= promotion.usageLimit.total) {
      return res.status(400).json({
        status: 'fail',
        message: 'This coupon has reached its usage limit',
      });
    }
    
    // Check if products are applicable (if specified)
    if (promotion.applicableProducts && promotion.applicableProducts.length > 0) {
      const applicableProductIds = promotion.applicableProducts.map(p => p.toString());
      
      // Filter cart items that are applicable
      const applicableCartItems = cart.items.filter(item => 
        applicableProductIds.includes(item.product.toString())
      );
      
      if (applicableCartItems.length === 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'This coupon is not applicable to any products in your cart',
        });
      }
      
      // Recalculate applicable amount
      applicableAmount = applicableCartItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );
    }
    
    // Calculate discount amount
    let discountAmount = 0;
    
    if (promotion.discountType === 'percentage') {
      discountAmount = (applicableAmount * promotion.discountValue) / 100;
    } else if (promotion.discountType === 'fixed_amount') {
      discountAmount = promotion.discountValue;
    } else if (promotion.discountType === 'free_shipping') {
      // Find the shop in cart.shops
      const shopIndex = cart.shops.findIndex(s => 
        s.shop.toString() === (shopId || promotion.shop)
      );
      
      if (shopIndex !== -1) {
        discountAmount = cart.shops[shopIndex].deliveryFee || 0;
      } else {
        discountAmount = 0;
      }
    }
    
    // Apply maximum discount if specified
    if (promotion.maximumDiscount && discountAmount > promotion.maximumDiscount) {
      discountAmount = promotion.maximumDiscount;
    }
    
    // Add coupon to cart
    const couponExists = cart.coupons.some(c => c.code === code);
    
    if (couponExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'Coupon already applied',
      });
    }
    
    cart.coupons.push({
      code,
      type: promotion.discountType,
      value: promotion.discountValue,
      shop: promotion.shop,
      isGlobal: promotion.isGlobal,
      appliedAmount: discountAmount,
    });
    
    // Update cart discount and total
    cart.discount += discountAmount;
    cart.total = cart.subtotal + cart.tax + cart.deliveryFee + cart.packagingFee + cart.serviceFee - cart.discount;
    
    // If shop-specific coupon, update shop discount
    if (shopId && promotion.shop && promotion.shop.toString() === shopId) {
      const shopIndex = cart.shops.findIndex(s => s.shop.toString() === shopId);
      
      if (shopIndex !== -1) {
        cart.shops[shopIndex].discount += discountAmount;
        cart.shops[shopIndex].total = 
          cart.shops[shopIndex].subtotal + 
          cart.shops[shopIndex].tax + 
          cart.shops[shopIndex].deliveryFee + 
          cart.shops[shopIndex].packagingFee - 
          cart.shops[shopIndex].discount;
        
        cart.shops[shopIndex].couponCode = code;
      }
    }
    
    // Update last activity
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      message: 'Coupon applied successfully',
      data: {
        cart,
        coupon: {
          code,
          discountAmount,
          type: promotion.discountType,
          value: promotion.discountValue,
        },
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

// @desc    Remove coupon
// @route   DELETE /api/cart/coupon
// @access  Public
exports.removeCoupon = async (req, res) => {
  try {
    const { code } = req.body;
    
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId });
    
    if (!cart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Cart not found',
      });
    }
    
    // Find coupon in cart
    const couponIndex = cart.coupons.findIndex(c => c.code === code);
    
    if (couponIndex === -1) {
      return res.status(404).json({
        status: 'fail',
        message: 'Coupon not found in cart',
      });
    }
    
    const coupon = cart.coupons[couponIndex];
    const discountAmount = coupon.appliedAmount;
    
    // Remove coupon
    cart.coupons.splice(couponIndex, 1);
    
    // Update cart discount and total
    cart.discount -= discountAmount;
    cart.total = cart.subtotal + cart.tax + cart.deliveryFee + cart.packagingFee + cart.serviceFee - cart.discount;
    
    // If shop-specific coupon, update shop discount
    if (coupon.shop) {
      const shopIndex = cart.shops.findIndex(s => s.shop.toString() === coupon.shop.toString());
      
      if (shopIndex !== -1) {
        cart.shops[shopIndex].discount -= discountAmount;
        cart.shops[shopIndex].total = 
          cart.shops[shopIndex].subtotal + 
          cart.shops[shopIndex].tax + 
          cart.shops[shopIndex].deliveryFee + 
          cart.shops[shopIndex].packagingFee - 
          cart.shops[shopIndex].discount;
        
        cart.shops[shopIndex].couponCode = null;
      }
    }
    
    // Update last activity
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      message: 'Coupon removed successfully',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get cart summary
// @route   GET /api/cart/summary
// @access  Public
exports.getCartSummary = async (req, res) => {
  try {
    const userId = req.user ? req.user._id : null;
    const { sessionId } = req.query;
    
    // Check if either userId or sessionId is provided
    if (!userId && !sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required for guest cart',
      });
    }
    
    // Find cart
    const cart = await Cart.findOne(userId ? { user: userId } : { sessionId })
      .populate({
        path: 'items.product',
        select: 'name price images category shop isActive stock',
        populate: {
          path: 'shop',
          select: 'name logo status',
        },
      })
      .populate('shops.shop', 'name logo status');
    
    if (!cart) {
      // Return empty summary
      return res.status(200).json({
        status: 'success',
        data: {
          itemCount: 0,
          shopCount: 0,
          subtotal: 0,
          tax: 0,
          deliveryFee: 0,
          packagingFee: 0,
          serviceFee: 0,
          discount: 0,
          total: 0,
          coupons: [],
        },
      });
    }
    
    // Filter out items from inactive shops or products
    const activeItems = cart.items.filter(item => 
      item.product.isActive && 
      item.product.shop.status === 'active'
    );
    
    // Calculate summary
    const itemCount = activeItems.reduce((sum, item) => sum + item.quantity, 0);
    const shopIds = [...new Set(activeItems.map(item => item.shop.toString()))];
    
    // Prepare summary
    const summary = {
      itemCount,
      shopCount: shopIds.length,
      subtotal: cart.subtotal,
      tax: cart.tax,
      deliveryFee: cart.deliveryFee,
      packagingFee: cart.packagingFee,
      serviceFee: cart.serviceFee,
      discount: cart.discount,
      total: cart.total,
      coupons: cart.coupons,
    };
    
    res.status(200).json({
      status: 'success',
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Merge guest cart with user cart
// @route   POST /api/cart/merge
// @access  Private
exports.mergeGuestCart = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required',
      });
    }
    
    // Merge carts
    const mergedCart = await Cart.mergeGuestCart(sessionId, req.user._id);
    
    if (!mergedCart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Guest cart not found',
      });
    }
    
    // Populate cart items
    await mergedCart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await mergedCart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      message: 'Carts merged successfully',
      data: mergedCart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Save cart
// @route   POST /api/cart/save
// @access  Private
exports.saveCart = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cart name is required',
      });
    }
    
    // Find user cart
    const cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cart is empty',
      });
    }
    
    // Update user with saved cart
    const user = await User.findById(req.user._id);
    
    // Check if cart name already exists
    const cartExists = user.savedCarts.some(c => c.name === name);
    
    if (cartExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cart with this name already exists',
      });
    }
    
    // Create saved cart items
    const savedCartItems = cart.items.map(item => ({
      product: item.product,
      quantity: item.quantity,
    }));
    
    // Add to saved carts
    user.savedCarts.push({
      name,
      items: savedCartItems,
    });
    
    await user.save();
    
    res.status(200).json({
      status: 'success',
      message: 'Cart saved successfully',
      data: {
        name,
        items: savedCartItems,
        createdAt: new Date(),
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

// @desc    Get saved carts
// @route   GET /api/cart/saved
// @access  Private
exports.getSavedCarts = async (req, res) => {
  try {
    // Get user with saved carts
    const user = await User.findById(req.user._id)
      .populate('savedCarts.items.product', 'name price images');
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: user.savedCarts,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Load saved cart
// @route   POST /api/cart/saved/:cartId
// @access  Private
exports.loadSavedCart = async (req, res) => {
  try {
    const { cartId } = req.params;
    const { replace = false } = req.body;
    
    // Get user with saved carts
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Find saved cart
    const savedCart = user.savedCarts.id(cartId);
    
    if (!savedCart) {
      return res.status(404).json({
        status: 'fail',
        message: 'Saved cart not found',
      });
    }
    
    // Get current cart
    let cart = await Cart.findOne({ user: req.user._id });
    
    if (!cart) {
      cart = new Cart({
        user: req.user._id,
        items: [],
        shops: [],
      });
    } else if (replace) {
      // Clear current cart if replace is true
      cart.items = [];
    }
    
    // Add saved cart items to current cart
    for (const savedItem of savedCart.items) {
      // Check if product exists and is active
      const product = await Product.findById(savedItem.product)
        .populate('shop', 'status');
      
      if (!product || !product.isActive || product.shop.status !== 'active') {
        continue;
      }
      
      // Check if product already exists in cart
      const existingItemIndex = cart.items.findIndex(item => 
        item.product.toString() === savedItem.product.toString()
      );
      
      if (existingItemIndex !== -1) {
        // Update quantity
        cart.items[existingItemIndex].quantity += savedItem.quantity;
        
        // Check if new quantity exceeds stock
        if (cart.items[existingItemIndex].quantity > product.stock) {
          cart.items[existingItemIndex].quantity = product.stock;
        }
      } else {
        // Add new item
        cart.items.push({
          product: savedItem.product,
          shop: product.shop._id,
          quantity: Math.min(savedItem.quantity, product.stock),
          price: product.price,
          totalPrice: product.price * Math.min(savedItem.quantity, product.stock),
        });
      }
    }
    
    // Update cart status and last activity
    cart.status = 'active';
    cart.lastActivity = new Date();
    
    // Save cart
    await cart.save();
    
    // Populate cart items
    await cart.populate({
      path: 'items.product',
      select: 'name price images category shop',
      populate: {
        path: 'shop',
        select: 'name logo',
      },
    });
    
    await cart.populate('shops.shop', 'name logo');
    
    res.status(200).json({
      status: 'success',
      message: 'Saved cart loaded successfully',
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};