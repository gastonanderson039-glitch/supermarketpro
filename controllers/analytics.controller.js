const Analytics = require('../models/analytics.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');

// @desc    Get dashboard stats
// @route   GET /api/analytics/dashboard
// @access  Private (Admin, Vendor, Staff)
exports.getDashboardStats = async (req, res) => {
  try {
    const { shop, period = 'daily' } = req.query;
    
    // Set date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setDate(now.getDate() - 7); // Last 7 days
        break;
      case 'weekly':
        startDate.setDate(now.getDate() - 30); // Last 30 days
        break;
      case 'monthly':
        startDate.setMonth(now.getMonth() - 6); // Last 6 months
        break;
      case 'yearly':
        startDate.setFullYear(now.getFullYear() - 1); // Last year
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Default to last 7 days
    }
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: now },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('customer', 'name')
      .populate('shop', 'name')
      .sort('createdAt');
    
    // Calculate stats
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Get payment methods breakdown
    const paymentMethods = {};
    orders.forEach(order => {
      const method = order.paymentMethod;
      paymentMethods[method] = (paymentMethods[method] || 0) + 1;
    });
    
    // Get order status breakdown
    const orderStatus = {};
    orders.forEach(order => {
      const status = order.status;
      orderStatus[status] = (orderStatus[status] || 0) + 1;
    });
    
    // Get sales by date
    const salesByDate = {};
    orders.forEach(order => {
      let dateKey;
      const orderDate = new Date(order.createdAt);
      
      switch (period) {
        case 'daily':
          dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekNumber = Math.ceil((orderDate.getDate() + 
            new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getDay()) / 7);
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'monthly':
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
          break;
        case 'yearly':
          dateKey = `${orderDate.getFullYear()}`;
          break;
        default:
          dateKey = orderDate.toISOString().split('T')[0];
      }
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          orders: 0,
          sales: 0,
        };
      }
      
      salesByDate[dateKey].orders += 1;
      salesByDate[dateKey].sales += order.total;
    });
    
    // Get top products
    const productMap = {};
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.toString();
        
        if (!productMap[productId]) {
          productMap[productId] = {
            productId,
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        
        productMap[productId].quantity += item.quantity;
        productMap[productId].revenue += item.totalPrice;
      });
    });
    
    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    
    // Get customer count
    const customerCount = await User.countDocuments({ role: 'customer' });
    
    // Get new customers in period
    const newCustomers = await User.countDocuments({
      role: 'customer',
      createdAt: { $gte: startDate, $lte: now },
    });
    
    // Get shop count
    const shopCount = await Shop.countDocuments({ status: 'active' });
    
    // Prepare response
    const stats = {
      totalOrders,
      totalSales,
      averageOrderValue,
      paymentMethods,
      orderStatus,
      salesByDate: Object.values(salesByDate),
      topProducts,
      customerCount,
      newCustomers,
      shopCount,
      period,
      startDate,
      endDate: now,
    };
    
    res.status(200).json({
      status: 'success',
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get sales analytics
// @route   GET /api/analytics/sales
// @access  Private (Admin, Vendor, Staff)
exports.getSalesAnalytics = async (req, res) => {
  try {
    const { 
      shop, 
      period = 'daily', 
      startDate: startDateParam, 
      endDate: endDateParam,
      compareWithPrevious = 'false'
    } = req.query;
    
    // Set date range based on period and params
    const now = new Date();
    let startDate = startDateParam ? new Date(startDateParam) : new Date();
    let endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    if (!startDateParam) {
      switch (period) {
        case 'daily':
          startDate.setDate(now.getDate() - 30); // Last 30 days
          break;
        case 'weekly':
          startDate.setDate(now.getDate() - 90); // Last 90 days
          break;
        case 'monthly':
          startDate.setMonth(now.getMonth() - 12); // Last 12 months
          break;
        case 'yearly':
          startDate.setFullYear(now.getFullYear() - 3); // Last 3 years
          break;
        default:
          startDate.setDate(now.getDate() - 30);
      }
    }
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders for current period
    const orders = await Order.find(query).sort('createdAt');
    
    // Group orders by date
    const salesByDate = {};
    
    orders.forEach(order => {
      let dateKey;
      const orderDate = new Date(order.createdAt);
      
      switch (period) {
        case 'daily':
          dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekNumber = Math.ceil((orderDate.getDate() + 
            new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getDay()) / 7);
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'monthly':
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
          break;
        case 'yearly':
          dateKey = `${orderDate.getFullYear()}`;
          break;
        default:
          dateKey = orderDate.toISOString().split('T')[0];
      }
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = {
          date: dateKey,
          orders: 0,
          sales: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
        };
      }
      
      salesByDate[dateKey].orders += 1;
      salesByDate[dateKey].sales += order.total;
      salesByDate[dateKey].tax += order.tax || 0;
      salesByDate[dateKey].shipping += order.deliveryFee || 0;
      salesByDate[dateKey].discount += order.discount || 0;
    });
    
    // Calculate totals
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalTax = orders.reduce((sum, order) => sum + (order.tax || 0), 0);
    const totalShipping = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Get comparison data if requested
    let comparisonData = null;
    
    if (compareWithPrevious === 'true') {
      // Calculate previous period
      const timeDiff = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - timeDiff);
      const prevEndDate = new Date(startDate.getTime() - 1); // 1ms before current start
      
      // Get orders for previous period
      const prevQuery = { ...query };
      prevQuery.createdAt = { $gte: prevStartDate, $lte: prevEndDate };
      
      const prevOrders = await Order.find(prevQuery);
      
      // Calculate previous totals
      const prevTotalOrders = prevOrders.length;
      const prevTotalSales = prevOrders.reduce((sum, order) => sum + order.total, 0);
      
      // Calculate growth
      const orderGrowth = prevTotalOrders > 0 
        ? ((totalOrders - prevTotalOrders) / prevTotalOrders) * 100 
        : totalOrders > 0 ? 100 : 0;
      
      const salesGrowth = prevTotalSales > 0 
        ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 
        : totalSales > 0 ? 100 : 0;
      
      comparisonData = {
        prevTotalOrders,
        prevTotalSales,
        orderGrowth,
        salesGrowth,
        prevStartDate,
        prevEndDate,
      };
    }
    
    // Prepare response
    const salesAnalytics = {
      totalOrders,
      totalSales,
      totalTax,
      totalShipping,
      totalDiscount,
      averageOrderValue,
      salesByDate: Object.values(salesByDate),
      period,
      startDate,
      endDate,
      comparison: comparisonData,
    };
    
    res.status(200).json({
      status: 'success',
      data: salesAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get product analytics
// @route   GET /api/analytics/products
// @access  Private (Admin, Vendor, Staff)
exports.getProductAnalytics = async (req, res) => {
  try {
    const { 
      shop, 
      startDate: startDateParam, 
      endDate: endDateParam,
      category,
      limit = 10
    } = req.query;
    
    // Set date range
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setMonth(now.getMonth() - 1));
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders
    const orders = await Order.find(query);
    
    // Get product data
    const productMap = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product.toString();
        
        if (!productMap[productId]) {
          productMap[productId] = {
            productId,
            name: item.name,
            quantity: 0,
            revenue: 0,
            orders: 0,
          };
        }
        
        productMap[productId].quantity += item.quantity;
        productMap[productId].revenue += item.totalPrice;
        productMap[productId].orders += 1;
      });
    });
    
    // Convert to array and sort
    let productAnalytics = Object.values(productMap);
    
    // Filter by category if provided
    if (category) {
      // Get products in this category
      const products = await Product.find({ category }).select('_id');
      const productIds = products.map(p => p._id.toString());
      
      productAnalytics = productAnalytics.filter(p => 
        productIds.includes(p.productId)
      );
    }
    
    // Sort by revenue (highest first)
    productAnalytics.sort((a, b) => b.revenue - a.revenue);
    
    // Get top products
    const topProducts = productAnalytics.slice(0, parseInt(limit));
    
    // Get low performing products
    const lowPerformingProducts = [...productAnalytics]
      .sort((a, b) => a.revenue - b.revenue)
      .slice(0, parseInt(limit));
    
    // Get product categories breakdown
    const categoryMap = {};
    
    // Get all products that were sold
    const productIds = Object.keys(productMap);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('category');
    
    // Create map of product ID to category
    const productCategoryMap = {};
    products.forEach(product => {
      productCategoryMap[product._id.toString()] = product.category;
    });
    
    // Calculate category totals
    Object.keys(productMap).forEach(productId => {
      const category = productCategoryMap[productId];
      if (category) {
        if (!categoryMap[category]) {
          categoryMap[category] = {
            category,
            quantity: 0,
            revenue: 0,
          };
        }
        
        categoryMap[category].quantity += productMap[productId].quantity;
        categoryMap[category].revenue += productMap[productId].revenue;
      }
    });
    
    // Convert to array and sort
    const categoryAnalytics = Object.values(categoryMap)
      .sort((a, b) => b.revenue - a.revenue);
    
    // Prepare response
    const analytics = {
      topProducts,
      lowPerformingProducts,
      categoryAnalytics,
      totalProducts: productAnalytics.length,
      totalQuantitySold: productAnalytics.reduce((sum, p) => sum + p.quantity, 0),
      totalRevenue: productAnalytics.reduce((sum, p) => sum + p.revenue, 0),
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get customer analytics
// @route   GET /api/analytics/customers
// @access  Private (Admin, Vendor)
exports.getCustomerAnalytics = async (req, res) => {
  try {
    const { 
      shop, 
      startDate: startDateParam, 
      endDate: endDateParam,
      limit = 10
    } = req.query;
    
    // Set date range
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setMonth(now.getMonth() - 3));
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('customer', 'name email');
    
    // Get customer data
    const customerMap = {};
    
    orders.forEach(order => {
      const customerId = order.customer._id.toString();
      const customerName = order.customer.name;
      const customerEmail = order.customer.email;
      
      if (!customerMap[customerId]) {
        customerMap[customerId] = {
          customerId,
          name: customerName,
          email: customerEmail,
          orders: 0,
          totalSpent: 0,
          lastOrder: null,
        };
      }
      
      customerMap[customerId].orders += 1;
      customerMap[customerId].totalSpent += order.total;
      
      // Update last order if this one is more recent
      if (!customerMap[customerId].lastOrder || 
          new Date(order.createdAt) > new Date(customerMap[customerId].lastOrder)) {
        customerMap[customerId].lastOrder = order.createdAt;
      }
    });
    
    // Convert to array and sort
    const customerAnalytics = Object.values(customerMap);
    
    // Sort by total spent (highest first)
    customerAnalytics.sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Get top customers
    const topCustomers = customerAnalytics.slice(0, parseInt(limit));
    
    // Get new vs returning customers
    const newCustomers = await User.countDocuments({
      role: 'customer',
      createdAt: { $gte: startDate, $lte: endDate },
    });
    
    // Get customer order frequency
    const orderFrequency = {};
    customerAnalytics.forEach(customer => {
      const frequency = customer.orders;
      orderFrequency[frequency] = (orderFrequency[frequency] || 0) + 1;
    });
    
    // Calculate average order value per customer
    const averageOrderValue = customerAnalytics.length > 0
      ? customerAnalytics.reduce((sum, c) => sum + (c.totalSpent / c.orders), 0) / customerAnalytics.length
      : 0;
    
    // Prepare response
    const analytics = {
      topCustomers,
      totalCustomers: customerAnalytics.length,
      newCustomers,
      returningCustomers: customerAnalytics.length - newCustomers,
      averageOrderValue,
      orderFrequency,
      totalRevenue: customerAnalytics.reduce((sum, c) => sum + c.totalSpent, 0),
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get shop analytics
// @route   GET /api/analytics/shops
// @access  Private (Admin)
exports.getShopAnalytics = async (req, res) => {
  try {
    const { 
      startDate: startDateParam, 
      endDate: endDateParam,
      limit = 10
    } = req.query;
    
    // Set date range
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setMonth(now.getMonth() - 3));
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Get orders
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    }).populate('shop', 'name');
    
    // Get shop data
    const shopMap = {};
    
    orders.forEach(order => {
      const shopId = order.shop._id.toString();
      const shopName = order.shop.name;
      
      if (!shopMap[shopId]) {
        shopMap[shopId] = {
          shopId,
          name: shopName,
          orders: 0,
          revenue: 0,
          platformFees: 0,
          shopEarnings: 0,
        };
      }
      
      shopMap[shopId].orders += 1;
      shopMap[shopId].revenue += order.total;
      shopMap[shopId].platformFees += order.commissionAmount || 0;
      shopMap[shopId].shopEarnings += order.shopEarnings || 0;
    });
    
    // Convert to array and sort
    const shopAnalytics = Object.values(shopMap);
    
    // Sort by revenue (highest first)
    shopAnalytics.sort((a, b) => b.revenue - a.revenue);
    
    // Get top shops
    const topShops = shopAnalytics.slice(0, parseInt(limit));
    
    // Get shop count
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ status: 'active' });
    const pendingShops = await Shop.countDocuments({ status: 'pending' });
    const suspendedShops = await Shop.countDocuments({ status: 'suspended' });
    
    // Get new shops in period
    const newShops = await Shop.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    
    // Prepare response
    const analytics = {
      topShops,
      shopCounts: {
        total: totalShops,
        active: activeShops,
        pending: pendingShops,
        suspended: suspendedShops,
        new: newShops,
      },
      totalOrders: orders.length,
      totalRevenue: shopAnalytics.reduce((sum, s) => sum + s.revenue, 0),
      totalPlatformFees: shopAnalytics.reduce((sum, s) => sum + s.platformFees, 0),
      totalShopEarnings: shopAnalytics.reduce((sum, s) => sum + s.shopEarnings, 0),
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get delivery analytics
// @route   GET /api/analytics/delivery
// @access  Private (Admin, Vendor, Staff)
exports.getDeliveryAnalytics = async (req, res) => {
  try {
    const { 
      shop, 
      startDate: startDateParam, 
      endDate: endDateParam
    } = req.query;
    
    // Set date range
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setMonth(now.getMonth() - 1));
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders with delivery info
    const orders = await Order.find(query)
      .populate('deliveryPersonnel', 'name')
      .select('deliveryPersonnel deliveryType deliveryFee scheduledDelivery actualDeliveryTime status createdAt');
    
    // Calculate delivery stats
    const totalDeliveries = orders.filter(o => 
      o.status === 'delivered' || o.status === 'out_for_delivery'
    ).length;
    
    const completedDeliveries = orders.filter(o => o.status === 'delivered').length;
    const inProgressDeliveries = orders.filter(o => o.status === 'out_for_delivery').length;
    
    // Calculate average delivery time
    let totalDeliveryTime = 0;
    let deliveriesWithTime = 0;
    
    orders.forEach(order => {
      if (order.status === 'delivered' && order.actualDeliveryTime) {
        const deliveryTime = new Date(order.actualDeliveryTime) - new Date(order.createdAt);
        totalDeliveryTime += deliveryTime;
        deliveriesWithTime++;
      }
    });
    
    const averageDeliveryTime = deliveriesWithTime > 0 
      ? totalDeliveryTime / deliveriesWithTime 
      : 0;
    
    // Get delivery type breakdown
    const deliveryTypes = {
      shop: orders.filter(o => o.deliveryType === 'shop').length,
      global: orders.filter(o => o.deliveryType === 'global').length,
    };
    
    // Get delivery personnel performance
    const personnelMap = {};
    
    orders.forEach(order => {
      if (order.deliveryPersonnel) {
        const personnelId = order.deliveryPersonnel._id.toString();
        const personnelName = order.deliveryPersonnel.name;
        
        if (!personnelMap[personnelId]) {
          personnelMap[personnelId] = {
            personnelId,
            name: personnelName,
            deliveries: 0,
            completed: 0,
            inProgress: 0,
          };
        }
        
        personnelMap[personnelId].deliveries += 1;
        
        if (order.status === 'delivered') {
          personnelMap[personnelId].completed += 1;
        } else if (order.status === 'out_for_delivery') {
          personnelMap[personnelId].inProgress += 1;
        }
      }
    });
    
    // Convert to array and sort
    const personnelPerformance = Object.values(personnelMap)
      .sort((a, b) => b.completed - a.completed);
    
    // Get scheduled vs on-demand deliveries
    const scheduledDeliveries = orders.filter(o => 
      o.scheduledDelivery && o.scheduledDelivery.isScheduled
    ).length;
    
    const onDemandDeliveries = totalDeliveries - scheduledDeliveries;
    
    // Prepare response
    const analytics = {
      totalDeliveries,
      completedDeliveries,
      inProgressDeliveries,
      averageDeliveryTime,
      deliveryTypes,
      personnelPerformance,
      scheduledDeliveries,
      onDemandDeliveries,
      totalDeliveryFees: orders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0),
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: analytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get revenue analytics
// @route   GET /api/analytics/revenue
// @access  Private (Admin, Vendor)
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const { 
      shop, 
      period = 'monthly', 
      startDate: startDateParam, 
      endDate: endDateParam
    } = req.query;
    
    // Set date range based on period and params
    const now = new Date();
    let startDate = startDateParam ? new Date(startDateParam) : new Date();
    let endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    if (!startDateParam) {
      switch (period) {
        case 'daily':
          startDate.setDate(now.getDate() - 30); // Last 30 days
          break;
        case 'weekly':
          startDate.setDate(now.getDate() - 90); // Last 90 days
          break;
        case 'monthly':
          startDate.setMonth(now.getMonth() - 12); // Last 12 months
          break;
        case 'yearly':
          startDate.setFullYear(now.getFullYear() - 3); // Last 3 years
          break;
        default:
          startDate.setMonth(now.getMonth() - 12);
      }
    }
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get orders
    const orders = await Order.find(query)
      .select('total subtotal tax deliveryFee discount commissionAmount shopEarnings platformEarnings createdAt');
    
    // Group orders by date
    const revenueByDate = {};
    
    orders.forEach(order => {
      let dateKey;
      const orderDate = new Date(order.createdAt);
      
      switch (period) {
        case 'daily':
          dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get week number
          const weekNumber = Math.ceil((orderDate.getDate() + 
            new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getDay()) / 7);
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'monthly':
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
          break;
        case 'yearly':
          dateKey = `${orderDate.getFullYear()}`;
          break;
        default:
          dateKey = orderDate.toISOString().split('T')[0];
      }
      
      if (!revenueByDate[dateKey]) {
        revenueByDate[dateKey] = {
          date: dateKey,
          grossRevenue: 0,
          netRevenue: 0,
          platformFees: 0,
          shopEarnings: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
        };
      }
      
      revenueByDate[dateKey].grossRevenue += order.total;
      revenueByDate[dateKey].netRevenue += order.subtotal;
      revenueByDate[dateKey].platformFees += order.commissionAmount || 0;
      revenueByDate[dateKey].shopEarnings += order.shopEarnings || 0;
      revenueByDate[dateKey].tax += order.tax || 0;
      revenueByDate[dateKey].shipping += order.deliveryFee || 0;
      revenueByDate[dateKey].discount += order.discount || 0;
    });
    
    // Calculate totals
    const totalGrossRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalNetRevenue = orders.reduce((sum, order) => sum + order.subtotal, 0);
    const totalPlatformFees = orders.reduce((sum, order) => sum + (order.commissionAmount || 0), 0);
    const totalShopEarnings = orders.reduce((sum, order) => sum + (order.shopEarnings || 0), 0);
    const totalTax = orders.reduce((sum, order) => sum + (order.tax || 0), 0);
    const totalShipping = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    
    // Prepare response
    const revenueAnalytics = {
      totalGrossRevenue,
      totalNetRevenue,
      totalPlatformFees,
      totalShopEarnings,
      totalTax,
      totalShipping,
      totalDiscount,
      revenueByDate: Object.values(revenueByDate),
      period,
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: revenueAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get inventory analytics
// @route   GET /api/analytics/inventory
// @access  Private (Admin, Vendor, Staff)
exports.getInventoryAnalytics = async (req, res) => {
  try {
    const { shop } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all stats
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get inventory items
    const inventoryItems = await Inventory.find(query)
      .populate('product', 'name price category')
      .populate('shop', 'name');
    
    // Calculate inventory stats
    const totalItems = inventoryItems.length;
    const totalStock = inventoryItems.reduce((sum, item) => sum + item.currentStock, 0);
    const totalValue = inventoryItems.reduce((sum, item) => {
      const price = item.product.price || 0;
      return sum + (price * item.currentStock);
    }, 0);
    
    // Get stock status breakdown
    const stockStatus = {
      in_stock: inventoryItems.filter(item => item.status === 'in_stock').length,
      low_stock: inventoryItems.filter(item => item.status === 'low_stock').length,
      out_of_stock: inventoryItems.filter(item => item.status === 'out_of_stock').length,
    };
    
    // Get category breakdown
    const categoryMap = {};
    
    inventoryItems.forEach(item => {
      const category = item.product.category;
      
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          items: 0,
          stock: 0,
          value: 0,
        };
      }
      
      categoryMap[category].items += 1;
      categoryMap[category].stock += item.currentStock;
      categoryMap[category].value += (item.product.price || 0) * item.currentStock;
    });
    
    // Convert to array and sort
    const categoryBreakdown = Object.values(categoryMap)
      .sort((a, b) => b.value - a.value);
    
    // Get low stock items
    const lowStockItems = inventoryItems
      .filter(item => item.status === 'low_stock')
      .map(item => ({
        id: item._id,
        productId: item.product._id,
        productName: item.product.name,
        currentStock: item.currentStock,
        lowStockThreshold: item.lowStockThreshold,
        shop: item.shop.name,
      }))
      .sort((a, b) => a.currentStock - b.currentStock);
    
    // Get out of stock items
    const outOfStockItems = inventoryItems
      .filter(item => item.status === 'out_of_stock')
      .map(item => ({
        id: item._id,
        productId: item.product._id,
        productName: item.product.name,
        shop: item.shop.name,
      }));
    
    // Prepare response
    const inventoryAnalytics = {
      totalItems,
      totalStock,
      totalValue,
      stockStatus,
      categoryBreakdown,
      lowStockItems,
      outOfStockItems,
    };
    
    res.status(200).json({
      status: 'success',
      data: inventoryAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get custom analytics
// @route   POST /api/analytics/custom
// @access  Private (Admin, Vendor)
exports.getCustomAnalytics = async (req, res) => {
  try {
    const { 
      metrics, 
      filters, 
      groupBy, 
      startDate: startDateParam, 
      endDate: endDateParam,
      limit = 10
    } = req.body;
    
    // Validate required fields
    if (!metrics || !Array.isArray(metrics) || metrics.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Metrics array is required and must not be empty',
      });
    }
    
    if (!groupBy) {
      return res.status(400).json({
        status: 'fail',
        message: 'groupBy field is required',
      });
    }
    
    // Set date range
    const now = new Date();
    const startDate = startDateParam ? new Date(startDateParam) : new Date(now.setMonth(now.getMonth() - 1));
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    
    // Ensure endDate has time set to end of day
    endDate.setHours(23, 59, 59, 999);
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    // Apply filters
    if (filters) {
      if (filters.shop) query.shop = filters.shop;
      if (filters.status) query.status = filters.status;
      if (filters.paymentMethod) query.paymentMethod = filters.paymentMethod;
      if (filters.paymentStatus) query.paymentStatus = filters.paymentStatus;
    }
    
    // Filter by user role
    if (req.user.role === 'vendor') {
      // Vendor can only see stats for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (filters && filters.shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(filters.shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access analytics for this shop',
          });
        }
        
        query.shop = filters.shop;
      }
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('customer', 'name')
      .populate('shop', 'name');
    
    // Group data based on groupBy parameter
    const groupedData = {};
    
    orders.forEach(order => {
      let groupKey;
      
      switch (groupBy) {
        case 'date':
          groupKey = order.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          const weekNumber = Math.ceil((order.createdAt.getDate() + 
            new Date(order.createdAt.getFullYear(), order.createdAt.getMonth(), 1).getDay()) / 7);
          groupKey = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'month':
          groupKey = `${order.createdAt.getFullYear()}-${order.createdAt.getMonth() + 1}`;
          break;
        case 'year':
          groupKey = `${order.createdAt.getFullYear()}`;
          break;
        case 'shop':
          groupKey = order.shop.name;
          break;
        case 'customer':
          groupKey = order.customer.name;
          break;
        case 'paymentMethod':
          groupKey = order.paymentMethod;
          break;
        case 'status':
          groupKey = order.status;
          break;
        default:
          groupKey = 'all';
      }
      
      if (!groupedData[groupKey]) {
        groupedData[groupKey] = {
          key: groupKey,
          orders: 0,
          sales: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
          platformFees: 0,
          shopEarnings: 0,
          items: 0,
        };
      }
      
      // Calculate metrics
      groupedData[groupKey].orders += 1;
      groupedData[groupKey].sales += order.total;
      groupedData[groupKey].tax += order.tax || 0;
      groupedData[groupKey].shipping += order.deliveryFee || 0;
      groupedData[groupKey].discount += order.discount || 0;
      groupedData[groupKey].platformFees += order.commissionAmount || 0;
      groupedData[groupKey].shopEarnings += order.shopEarnings || 0;
      groupedData[groupKey].items += order.items.reduce((sum, item) => sum + item.quantity, 0);
    });
    
    // Convert to array and sort
    let analyticsData = Object.values(groupedData);
    
    // Sort by sales (highest first)
    analyticsData.sort((a, b) => b.sales - a.sales);
    
    // Limit results if needed
    if (limit) {
      analyticsData = analyticsData.slice(0, parseInt(limit));
    }
    
    // Filter metrics to only include requested ones
    analyticsData = analyticsData.map(item => {
      const filteredItem = { key: item.key };
      
      metrics.forEach(metric => {
        if (item[metric] !== undefined) {
          filteredItem[metric] = item[metric];
        }
      });
      
      return filteredItem;
    });
    
    // Calculate totals
    const totals = {
      orders: orders.length,
      sales: orders.reduce((sum, order) => sum + order.total, 0),
      tax: orders.reduce((sum, order) => sum + (order.tax || 0), 0),
      shipping: orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0),
      discount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
      platformFees: orders.reduce((sum, order) => sum + (order.commissionAmount || 0), 0),
      shopEarnings: orders.reduce((sum, order) => sum + (order.shopEarnings || 0), 0),
      items: orders.reduce((sum, order) => 
        sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0),
    };
    
    // Filter totals to only include requested metrics
    const filteredTotals = {};
    metrics.forEach(metric => {
      if (totals[metric] !== undefined) {
        filteredTotals[metric] = totals[metric];
      }
    });
    
    // Prepare response
    const customAnalytics = {
      data: analyticsData,
      totals: filteredTotals,
      groupBy,
      metrics,
      filters,
      startDate,
      endDate,
    };
    
    res.status(200).json({
      status: 'success',
      data: customAnalytics,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};