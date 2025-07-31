const Report = require('../models/report.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const Shop = require('../models/shop.model');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// @desc    Get all reports
// @route   GET /api/reports
// @access  Private (Admin, Vendor)
exports.getReports = async (req, res) => {
  try {
    const { 
      type, 
      status, 
      shop,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (type) query.type = type;
    if (status) query.status = status;
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all reports
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see reports for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access reports for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Count total reports
    const total = await Report.countDocuments(query);
    
    // Get reports
    const reports = await Report.find(query)
      .populate('shop', 'name')
      .populate('createdBy', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: reports.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get report by ID
// @route   GET /api/reports/:id
// @access  Private (Admin, Vendor)
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id)
      .populate('shop', 'name')
      .populate('createdBy', 'name');
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found',
      });
    }
    
    // Check if user has permission to view this report
    if (req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === report.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this report',
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new report
// @route   POST /api/reports
// @access  Private (Admin, Vendor)
exports.createReport = async (req, res) => {
  try {
    const { 
      name, 
      type, 
      shop, 
      dateRange,
      filters,
      format,
      data
    } = req.body;
    
    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name and type are required',
      });
    }
    
    // Check if user has permission to create report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to create report for this shop',
        });
      }
    }
    
    // Create report
    const report = await Report.create({
      name,
      type,
      shop,
      dateRange,
      filters,
      format: format || 'json',
      data,
      createdBy: req.user._id,
    });
    
    res.status(201).json({
      status: 'success',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete report
// @route   DELETE /api/reports/:id
// @access  Private (Admin, Vendor)
exports.deleteReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found',
      });
    }
    
    // Check if user has permission to delete this report
    if (req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === report.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this report',
        });
      }
    }
    
    // Delete report file if exists
    if (report.filePath) {
      try {
        fs.unlinkSync(report.filePath);
      } catch (err) {
        console.error('Error deleting report file:', err);
      }
    }
    
    await report.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Report deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Download report
// @route   GET /api/reports/:id/download
// @access  Private (Admin, Vendor)
exports.downloadReport = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found',
      });
    }
    
    // Check if user has permission to download this report
    if (req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === report.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to download this report',
        });
      }
    }
    
    // Check if report file exists
    if (!report.filePath) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report file not found',
      });
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(report.filePath)) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report file not found on server',
      });
    }
    
    // Set appropriate content type
    let contentType = 'application/json';
    
    if (report.format === 'csv') {
      contentType = 'text/csv';
    } else if (report.format === 'pdf') {
      contentType = 'application/pdf';
    } else if (report.format === 'excel') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${report.name}.${report.format}`);
    
    // Stream file
    const fileStream = fs.createReadStream(report.filePath);
    fileStream.pipe(res);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Schedule report
// @route   POST /api/reports/schedule
// @access  Private (Admin, Vendor)
exports.scheduleReport = async (req, res) => {
  try {
    const { 
      name, 
      type, 
      shop, 
      schedule,
      dateRange,
      filters,
      format,
      recipients
    } = req.body;
    
    // Validate required fields
    if (!name || !type || !schedule) {
      return res.status(400).json({
        status: 'fail',
        message: 'Name, type, and schedule are required',
      });
    }
    
    // Check if user has permission to schedule report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to schedule report for this shop',
        });
      }
    }
    
    // Create scheduled report
    const report = await Report.create({
      name,
      type,
      shop,
      isScheduled: true,
      schedule,
      dateRange,
      filters,
      format: format || 'json',
      recipients,
      createdBy: req.user._id,
    });
    
    res.status(201).json({
      status: 'success',
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update schedule
// @route   PUT /api/reports/schedule/:id
// @access  Private (Admin, Vendor)
exports.updateSchedule = async (req, res) => {
  try {
    const { 
      schedule, 
      isActive,
      recipients
    } = req.body;
    
    // Find report
    const report = await Report.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({
        status: 'fail',
        message: 'Report not found',
      });
    }
    
    // Check if report is scheduled
    if (!report.isScheduled) {
      return res.status(400).json({
        status: 'fail',
        message: 'This report is not scheduled',
      });
    }
    
    // Check if user has permission to update this report
    if (req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === report.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to update this report',
        });
      }
    }
    
    // Update schedule
    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      {
        schedule: schedule || report.schedule,
        isActive: isActive !== undefined ? isActive : report.isActive,
        recipients: recipients || report.recipients,
      },
      { new: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedReport,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get scheduled reports
// @route   GET /api/reports/schedule
// @access  Private (Admin, Vendor)
exports.getScheduledReports = async (req, res) => {
  try {
    const { shop } = req.query;
    
    // Build query
    const query = { isScheduled: true };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all scheduled reports
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see scheduled reports for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access reports for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get scheduled reports
    const reports = await Report.find(query)
      .populate('shop', 'name')
      .populate('createdBy', 'name')
      .sort('-createdAt');
    
    res.status(200).json({
      status: 'success',
      count: reports.length,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Generate sales report
// @route   POST /api/reports/generate/sales
// @access  Private (Admin, Vendor)
exports.generateSalesReport = async (req, res) => {
  try {
    const { 
      shop, 
      startDate, 
      endDate, 
      format = 'json',
      groupBy = 'day',
      includeDetails = false
    } = req.body;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required',
      });
    }
    
    // Check if user has permission to generate report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to generate report for this shop',
        });
      }
    }
    
    // Build query
    const query = {
      createdAt: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    if (shop) {
      query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see data for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('shop', 'name')
      .populate('customer', 'name email')
      .sort('createdAt');
    
    // Group orders by date
    const salesByDate = {};
    
    orders.forEach(order => {
      let dateKey;
      const orderDate = new Date(order.createdAt);
      
      switch (groupBy) {
        case 'day':
          dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          // Get week number
          const weekNumber = Math.ceil((orderDate.getDate() + 
            new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getDay()) / 7);
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'month':
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
          break;
        case 'year':
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
          orderDetails: [],
        };
      }
      
      salesByDate[dateKey].orders += 1;
      salesByDate[dateKey].sales += order.total;
      salesByDate[dateKey].tax += order.tax || 0;
      salesByDate[dateKey].shipping += order.deliveryFee || 0;
      salesByDate[dateKey].discount += order.discount || 0;
      
      if (includeDetails) {
        salesByDate[dateKey].orderDetails.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          customer: order.customer ? order.customer.name : 'Guest',
          total: order.total,
          status: order.status,
          paymentMethod: order.paymentMethod,
          date: order.createdAt,
        });
      }
    });
    
    // Calculate totals
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalTax = orders.reduce((sum, order) => sum + (order.tax || 0), 0);
    const totalShipping = orders.reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
    const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    // Prepare report data
    const reportData = {
      title: 'Sales Report',
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalOrders,
        totalSales,
        totalTax,
        totalShipping,
        totalDiscount,
        averageOrderValue,
      },
      salesByDate: Object.values(salesByDate),
    };
    
    // Create report
    const report = await Report.create({
      name: `Sales Report ${new Date().toISOString().split('T')[0]}`,
      type: 'sales',
      shop,
      dateRange: {
        startDate,
        endDate,
      },
      format,
      data: reportData,
      createdBy: req.user._id,
    });
    
    // Generate file if needed
    if (format !== 'json') {
      const fileName = `sales_report_${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '..', 'uploads', 'reports', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let fileContent = '';
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'Date,Orders,Sales,Tax,Shipping,Discount\n';
        const rows = Object.values(salesByDate).map(day => 
          `${day.date},${day.orders},${day.sales},${day.tax},${day.shipping},${day.discount}`
        ).join('\n');
        
        fileContent = header + rows;
      } else {
        // Default to JSON
        fileContent = JSON.stringify(reportData, null, 2);
      }
      
      // Write file
      await writeFileAsync(filePath, fileContent);
      
      // Update report with file path
      report.filePath = filePath;
      await report.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        report,
        reportData,
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

// @desc    Generate revenue report
// @route   POST /api/reports/generate/revenue
// @access  Private (Admin, Vendor)
exports.generateRevenueReport = async (req, res) => {
  try {
    const { 
      shop, 
      startDate, 
      endDate, 
      format = 'json',
      groupBy = 'day'
    } = req.body;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required',
      });
    }
    
    // Check if user has permission to generate report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to generate report for this shop',
        });
      }
    }
    
    // Build query
    const query = {
      createdAt: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    if (shop) {
      query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see data for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    // Get orders
    const orders = await Order.find(query)
      .select('createdAt total subtotal tax deliveryFee discount commissionAmount shopEarnings')
      .sort('createdAt');
    
    // Group orders by date
    const revenueByDate = {};
    
    orders.forEach(order => {
      let dateKey;
      const orderDate = new Date(order.createdAt);
      
      switch (groupBy) {
        case 'day':
          dateKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'week':
          // Get week number
          const weekNumber = Math.ceil((orderDate.getDate() + 
            new Date(orderDate.getFullYear(), orderDate.getMonth(), 1).getDay()) / 7);
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}-W${weekNumber}`;
          break;
        case 'month':
          dateKey = `${orderDate.getFullYear()}-${orderDate.getMonth() + 1}`;
          break;
        case 'year':
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
    
    // Prepare report data
    const reportData = {
      title: 'Revenue Report',
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalGrossRevenue,
        totalNetRevenue,
        totalPlatformFees,
        totalShopEarnings,
        totalTax,
        totalShipping,
        totalDiscount,
      },
      revenueByDate: Object.values(revenueByDate),
    };
    
    // Create report
    const report = await Report.create({
      name: `Revenue Report ${new Date().toISOString().split('T')[0]}`,
      type: 'revenue',
      shop,
      dateRange: {
        startDate,
        endDate,
      },
      format,
      data: reportData,
      createdBy: req.user._id,
    });
    
    // Generate file if needed
    if (format !== 'json') {
      const fileName = `revenue_report_${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '..', 'uploads', 'reports', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let fileContent = '';
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'Date,Gross Revenue,Net Revenue,Platform Fees,Shop Earnings,Tax,Shipping,Discount\n';
        const rows = Object.values(revenueByDate).map(day => 
          `${day.date},${day.grossRevenue},${day.netRevenue},${day.platformFees},${day.shopEarnings},${day.tax},${day.shipping},${day.discount}`
        ).join('\n');
        
        fileContent = header + rows;
      } else {
        // Default to JSON
        fileContent = JSON.stringify(reportData, null, 2);
      }
      
      // Write file
      await writeFileAsync(filePath, fileContent);
      
      // Update report with file path
      report.filePath = filePath;
      await report.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        report,
        reportData,
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

// @desc    Generate product report
// @route   POST /api/reports/generate/products
// @access  Private (Admin, Vendor)
exports.generateProductReport = async (req, res) => {
  try {
    const { 
      shop, 
      startDate, 
      endDate, 
      format = 'json',
      category,
      limit = 100
    } = req.body;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required',
      });
    }
    
    // Check if user has permission to generate report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to generate report for this shop',
        });
      }
    }
    
    // Build query
    const query = {
      createdAt: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    if (shop) {
      query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see data for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('items.product', 'name category')
      .sort('createdAt');
    
    // Get product data
    const productMap = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        const productId = item.product ? item.product._id.toString() : item.productId.toString();
        const productName = item.product ? item.product.name : item.name;
        const productCategory = item.product ? item.product.category : null;
        
        // Skip if category filter is applied and product doesn't match
        if (category && productCategory && productCategory.toString() !== category) {
          return;
        }
        
        if (!productMap[productId]) {
          productMap[productId] = {
            productId,
            name: productName,
            category: productCategory,
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
    
    // Sort by revenue (highest first)
    productAnalytics.sort((a, b) => b.revenue - a.revenue);
    
    // Limit results if needed
    if (limit) {
      productAnalytics = productAnalytics.slice(0, parseInt(limit));
    }
    
    // Calculate totals
    const totalProducts = productAnalytics.length;
    const totalQuantity = productAnalytics.reduce((sum, p) => sum + p.quantity, 0);
    const totalRevenue = productAnalytics.reduce((sum, p) => sum + p.revenue, 0);
    
    // Prepare report data
    const reportData = {
      title: 'Product Report',
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalProducts,
        totalQuantity,
        totalRevenue,
      },
      products: productAnalytics,
    };
    
    // Create report
    const report = await Report.create({
      name: `Product Report ${new Date().toISOString().split('T')[0]}`,
      type: 'product',
      shop,
      dateRange: {
        startDate,
        endDate,
      },
      format,
      data: reportData,
      createdBy: req.user._id,
    });
    
    // Generate file if needed
    if (format !== 'json') {
      const fileName = `product_report_${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '..', 'uploads', 'reports', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let fileContent = '';
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'Product ID,Name,Quantity Sold,Revenue,Orders\n';
        const rows = productAnalytics.map(product => 
          `${product.productId},${product.name.replace(/,/g, ' ')},${product.quantity},${product.revenue},${product.orders}`
        ).join('\n');
        
        fileContent = header + rows;
      } else {
        // Default to JSON
        fileContent = JSON.stringify(reportData, null, 2);
      }
      
      // Write file
      await writeFileAsync(filePath, fileContent);
      
      // Update report with file path
      report.filePath = filePath;
      await report.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        report,
        reportData,
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

// @desc    Generate customer report
// @route   POST /api/reports/generate/customers
// @access  Private (Admin, Vendor)
exports.generateCustomerReport = async (req, res) => {
  try {
    const { 
      shop, 
      startDate, 
      endDate, 
      format = 'json',
      limit = 100
    } = req.body;
    
    // Validate date range
    if (!startDate || !endDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Start date and end date are required',
      });
    }
    
    // Check if user has permission to generate report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to generate report for this shop',
        });
      }
    }
    
    // Build query
    const query = {
      createdAt: { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    if (shop) {
      query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see data for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('customer', 'name email')
      .sort('createdAt');
    
    // Get customer data
    const customerMap = {};
    
    orders.forEach(order => {
      if (!order.customer) return; // Skip guest orders
      
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
    let customerAnalytics = Object.values(customerMap);
    
    // Sort by total spent (highest first)
    customerAnalytics.sort((a, b) => b.totalSpent - a.totalSpent);
    
    // Limit results if needed
    if (limit) {
      customerAnalytics = customerAnalytics.slice(0, parseInt(limit));
    }
    
    // Calculate totals
    const totalCustomers = customerAnalytics.length;
    const totalOrders = customerAnalytics.reduce((sum, c) => sum + c.orders, 0);
    const totalRevenue = customerAnalytics.reduce((sum, c) => sum + c.totalSpent, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Prepare report data
    const reportData = {
      title: 'Customer Report',
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        totalCustomers,
        totalOrders,
        totalRevenue,
        averageOrderValue,
      },
      customers: customerAnalytics,
    };
    
    // Create report
    const report = await Report.create({
      name: `Customer Report ${new Date().toISOString().split('T')[0]}`,
      type: 'customer',
      shop,
      dateRange: {
        startDate,
        endDate,
      },
      format,
      data: reportData,
      createdBy: req.user._id,
    });
    
    // Generate file if needed
    if (format !== 'json') {
      const fileName = `customer_report_${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '..', 'uploads', 'reports', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let fileContent = '';
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'Customer ID,Name,Email,Orders,Total Spent,Last Order\n';
        const rows = customerAnalytics.map(customer => 
          `${customer.customerId},${customer.name.replace(/,/g, ' ')},${customer.email},${customer.orders},${customer.totalSpent},${customer.lastOrder}`
        ).join('\n');
        
        fileContent = header + rows;
      } else {
        // Default to JSON
        fileContent = JSON.stringify(reportData, null, 2);
      }
      
      // Write file
      await writeFileAsync(filePath, fileContent);
      
      // Update report with file path
      report.filePath = filePath;
      await report.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        report,
        reportData,
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

// @desc    Generate inventory report
// @route   POST /api/reports/generate/inventory
// @access  Private (Admin, Vendor)
exports.generateInventoryReport = async (req, res) => {
  try {
    const { 
      shop, 
      format = 'json',
      includeZeroStock = true,
      includeLowStock = true
    } = req.body;
    
    // Check if user has permission to generate report for this shop
    if (shop && req.user.role === 'vendor') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to generate report for this shop',
        });
      }
    }
    
    // Build query
    const query = {};
    
    if (shop) {
      query.shop = shop;
    } else if (req.user.role === 'vendor') {
      // Vendor can only see data for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    if (!includeZeroStock) {
      query.stock = { $gt: 0 };
    }
    
    // Get products
    const products = await Product.find(query)
      .populate('shop', 'name')
      .populate('category', 'name')
      .sort('name');
    
    // Filter low stock items if requested
    let inventoryItems = products;
    
    if (includeLowStock) {
      // Get low stock threshold from settings or use default
      const lowStockThreshold = 10; // Default value
      
      // Mark low stock items
      inventoryItems = products.map(product => {
        const isLowStock = product.stock <= lowStockThreshold;
        return {
          ...product.toObject(),
          isLowStock,
        };
      });
    }
    
    // Calculate totals
    const totalProducts = inventoryItems.length;
    const totalStock = inventoryItems.reduce((sum, item) => sum + item.stock, 0);
    const totalValue = inventoryItems.reduce((sum, item) => sum + (item.price * item.stock), 0);
    const lowStockCount = inventoryItems.filter(item => item.isLowStock).length;
    const outOfStockCount = inventoryItems.filter(item => item.stock === 0).length;
    
    // Prepare report data
    const reportData = {
      title: 'Inventory Report',
      generatedAt: new Date(),
      summary: {
        totalProducts,
        totalStock,
        totalValue,
        lowStockCount,
        outOfStockCount,
      },
      inventory: inventoryItems.map(item => ({
        productId: item._id,
        name: item.name,
        sku: item.sku,
        barcode: item.barcode,
        shop: item.shop ? item.shop.name : null,
        category: item.category ? item.category.name : null,
        stock: item.stock,
        price: item.price,
        value: item.price * item.stock,
        isLowStock: item.isLowStock,
        isOutOfStock: item.stock === 0,
      })),
    };
    
    // Create report
    const report = await Report.create({
      name: `Inventory Report ${new Date().toISOString().split('T')[0]}`,
      type: 'inventory',
      shop,
      format,
      data: reportData,
      createdBy: req.user._id,
    });
    
    // Generate file if needed
    if (format !== 'json') {
      const fileName = `inventory_report_${Date.now()}.${format}`;
      const filePath = path.join(__dirname, '..', 'uploads', 'reports', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      let fileContent = '';
      
      if (format === 'csv') {
        // Generate CSV
        const header = 'Product ID,Name,SKU,Barcode,Shop,Category,Stock,Price,Value,Low Stock,Out of Stock\n';
        const rows = reportData.inventory.map(item => 
          `${item.productId},${item.name.replace(/,/g, ' ')},${item.sku || ''},${item.barcode || ''},${(item.shop || '').replace(/,/g, ' ')},${(item.category || '').replace(/,/g, ' ')},${item.stock},${item.price},${item.value},${item.isLowStock},${item.isOutOfStock}`
        ).join('\n');
        
        fileContent = header + rows;
      } else {
        // Default to JSON
        fileContent = JSON.stringify(reportData, null, 2);
      }
      
      // Write file
      await writeFileAsync(filePath, fileContent);
      
      // Update report with file path
      report.filePath = filePath;
      await report.save();
    }
    
    res.status(200).json({
      status: 'success',
      data: {
        report,
        reportData,
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