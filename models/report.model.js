const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'sales', 
        'revenue', 
        'products', 
        'customers', 
        'inventory', 
        'delivery', 
        'payments',
        'commissions',
        'taxes',
        'refunds',
        'custom'
      ],
      required: true,
    },
    scope: {
      type: String,
      enum: ['platform', 'shop', 'user'],
      required: true,
    },
    period: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    filters: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    summary: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    charts: [
      {
        type: {
          type: String,
          enum: ['line', 'bar', 'pie', 'doughnut', 'area', 'scatter', 'radar', 'table'],
        },
        title: String,
        data: mongoose.Schema.Types.Mixed,
        options: mongoose.Schema.Types.Mixed,
      },
    ],
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed'],
      default: 'generating',
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
    },
    isScheduled: {
      type: Boolean,
      default: false,
    },
    schedule: {
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly'],
      },
      nextRun: Date,
      lastRun: Date,
      recipients: [
        {
          email: String,
          name: String,
        },
      ],
      isActive: {
        type: Boolean,
        default: true,
      },
    },
    format: {
      type: String,
      enum: ['json', 'csv', 'pdf', 'excel'],
      default: 'json',
    },
    fileUrl: String,
    error: {
      message: String,
      stack: String,
      timestamp: Date,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Static method to generate a sales report
reportSchema.statics.generateSalesReport = async function(options) {
  const { 
    name, 
    scope, 
    period, 
    startDate, 
    endDate, 
    shop, 
    generatedBy, 
    filters = {} 
  } = options;
  
  // Create report instance
  const report = new this({
    name,
    type: 'sales',
    scope,
    period,
    startDate,
    endDate,
    filters,
    shop,
    generatedBy,
    status: 'generating',
    data: {},
  });
  
  try {
    // Save initial report
    await report.save();
    
    // Get Order model
    const Order = mongoose.model('Order');
    
    // Build query
    const query = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $nin: ['cancelled', 'failed'] },
    };
    
    if (scope === 'shop' && shop) {
      query.shop = shop;
    }
    
    // Apply additional filters
    if (filters.paymentMethod) {
      query.paymentMethod = filters.paymentMethod;
    }
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    // Get orders
    const orders = await Order.find(query)
      .populate('customer', 'name email')
      .populate('shop', 'name')
      .sort({ createdAt: 1 });
    
    // Process data based on period
    let groupedData = {};
    let timeFormat;
    
    switch (period) {
      case 'daily':
        timeFormat = '%Y-%m-%d';
        break;
      case 'weekly':
        timeFormat = '%Y-W%U';
        break;
      case 'monthly':
        timeFormat = '%Y-%m';
        break;
      case 'quarterly':
        // Custom handling for quarters
        orders.forEach(order => {
          const date = new Date(order.createdAt);
          const year = date.getFullYear();
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          const key = `${year}-Q${quarter}`;
          
          if (!groupedData[key]) {
            groupedData[key] = {
              period: key,
              orders: [],
              totalSales: 0,
              totalOrders: 0,
              averageOrderValue: 0,
            };
          }
          
          groupedData[key].orders.push(order);
          groupedData[key].totalSales += order.total;
          groupedData[key].totalOrders += 1;
        });
        break;
      case 'yearly':
        timeFormat = '%Y';
        break;
      default:
        timeFormat = '%Y-%m-%d';
    }
    
    // Use aggregation for non-quarterly periods
    if (period !== 'quarterly') {
      const aggregationResult = await Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: { $dateToString: { format: timeFormat, date: '$createdAt' } },
            totalSales: { $sum: '$total' },
            totalOrders: { $count: {} },
            averageOrderValue: { $avg: '$total' },
            orders: { $push: '$_id' },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      
      aggregationResult.forEach(item => {
        groupedData[item._id] = {
          period: item._id,
          totalSales: item.totalSales,
          totalOrders: item.totalOrders,
          averageOrderValue: item.averageOrderValue,
          orders: item.orders,
        };
      });
    }
    
    // Calculate summary
    const summary = {
      totalSales: orders.reduce((sum, order) => sum + order.total, 0),
      totalOrders: orders.length,
      averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0,
      topProducts: await getTopProducts(orders),
      paymentMethods: getPaymentMethodBreakdown(orders),
    };
    
    // Prepare chart data
    const charts = [
      {
        type: 'line',
        title: 'Sales Trend',
        data: {
          labels: Object.keys(groupedData),
          datasets: [
            {
              label: 'Sales',
              data: Object.values(groupedData).map(item => item.totalSales),
            },
          ],
        },
      },
      {
        type: 'bar',
        title: 'Order Count',
        data: {
          labels: Object.keys(groupedData),
          datasets: [
            {
              label: 'Orders',
              data: Object.values(groupedData).map(item => item.totalOrders),
            },
          ],
        },
      },
      {
        type: 'pie',
        title: 'Payment Methods',
        data: {
          labels: Object.keys(summary.paymentMethods),
          datasets: [
            {
              data: Object.values(summary.paymentMethods),
            },
          ],
        },
      },
    ];
    
    // Update report with data
    report.data = groupedData;
    report.summary = summary;
    report.charts = charts;
    report.status = 'completed';
    
    await report.save();
    
    return report;
  } catch (error) {
    // Update report with error
    report.status = 'failed';
    report.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
    };
    
    await report.save();
    
    throw error;
  }
};

// Helper function to get top products
async function getTopProducts(orders) {
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
  
  return Object.values(productMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

// Helper function to get payment method breakdown
function getPaymentMethodBreakdown(orders) {
  const paymentMethods = {};
  
  orders.forEach(order => {
    const method = order.paymentMethod;
    
    if (!paymentMethods[method]) {
      paymentMethods[method] = 0;
    }
    
    paymentMethods[method] += 1;
  });
  
  return paymentMethods;
}

// Indexes for efficient querying
reportSchema.index({ type: 1, scope: 1 });
reportSchema.index({ generatedBy: 1 });
reportSchema.index({ shop: 1 });
reportSchema.index({ startDate: 1, endDate: 1 });
reportSchema.index({ 'schedule.nextRun': 1, 'schedule.isActive': 1 });
reportSchema.index({ createdAt: -1 });

const Report = mongoose.model('Report', reportSchema);

module.exports = Report;