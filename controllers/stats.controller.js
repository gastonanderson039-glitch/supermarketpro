const Shop = require('../models/shop.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async.middleware');
const { default: mongoose } = require('mongoose');

// @desc    Get shop statistics
// @route   GET /api/shops/:id/stats
// @access  Private (Shop owner/admin)
exports.getShopStats = asyncHandler(async (req, res, next) => {
    const shopId = req.params.id;

    // Verify shop exists and user has access
    const shop = await Shop.findById(shopId);
    if (!shop) {
        return next(new ErrorResponse(`Shop not found with id of ${shopId}`, 404));
    }

    // Check if user is shop owner or admin
    if (shop.owner.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to access this shop`, 401));
    }

    // Current date calculations
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 1. Basic Stats
    const totalProducts = await Product.countDocuments({ shop: shopId });
    const totalOrders = await Order.countDocuments({ shop: shopId });
    const totalRevenue = await Order.aggregate([
        { $match: { shop: new mongoose.Types.ObjectId(shopId), paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    // 2. Order Stats
    const orderStats = await Order.aggregate([
        { $match: { shop: new mongoose.Types.ObjectId(shopId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                revenue: { $sum: '$total' }
            }
        }
    ]);

    // 3. Monthly Sales
    const monthlySales = await Order.aggregate([
        {
            $match: {
                shop: new mongoose.Types.ObjectId(shopId),
                createdAt: { $gte: threeMonthsAgo }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                },
                count: { $sum: 1 },
                revenue: { $sum: '$total' }
            }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        {
            $project: {
                _id: 0,
                month: {
                    $dateToString: {
                        format: '%Y-%m',
                        date: {
                            $dateFromParts: {
                                year: '$_id.year',
                                month: '$_id.month'
                            }
                        }
                    }
                },
                count: 1,
                revenue: 1
            }
        }
    ]);

    // 4. Product Stats - Fixed version
    const productStats = await Product.aggregate([
        { $match: { shop: new mongoose.Types.ObjectId(shopId) } },
        {
            $lookup: {
                from: 'orderitems',
                localField: '_id',
                foreignField: 'product',
                as: 'orderItems'
            }
        },
        {
            $project: {
                name: 1,
                stock: 1,
                sold: {
                    $cond: {
                        if: { $isArray: '$orderItems' },
                        then: { $size: '$orderItems' },
                        else: 0
                    }
                }
            }
        },
        { $sort: { sold: -1 } },
        { $limit: 5 }
    ]);

    // 5. Staff Performance (if applicable)
    const staffStats = await Order.aggregate([
        {
            $match: {
                shop: new mongoose.Types.ObjectId(shopId),
                createdAt: { $gte: oneMonthAgo }
            }
        },
        { $unwind: '$staff' },
        {
            $group: {
                _id: '$staff.user',
                orderCount: { $sum: 1 },
                totalRevenue: { $sum: '$total' }
            }
        },
        {
            $lookup: {
                from: 'users',
                localField: '_id',
                foreignField: '_id',
                as: 'user'
            }
        },
        { $unwind: '$user' },
        {
            $project: {
                _id: 0,
                staffId: '$_id',
                name: '$user.name',
                email: '$user.email',
                orderCount: 1,
                totalRevenue: 1
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            overview: {
                totalProducts,
                totalOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
            },
            orderStatus: orderStats,
            monthlySales,
            topProducts: productStats,
            staffPerformance: staffStats
        }
    });
});
// @desc    Get shop product sales analytics
// @route   GET /api/shops/:id/analytics/products
// @access  Private (Shop owner/admin)
exports.getProductAnalytics = asyncHandler(async (req, res, next) => {
    const shopId = req.params.id;

    // Verify shop exists and user has access
    const shop = await Shop.findById(shopId);
    if (!shop) {
        return next(new ErrorResponse(`Shop not found with id of ${shopId}`, 404));
    }

    // Check if user is shop owner or admin
    if (shop.owner.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to access this shop`, 401));
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Get product sales data
    const productSales = await Order.aggregate([
        {
            $match: {
                shop: new mongoose.Types.ObjectId(shopId),
                createdAt: { $gte: sixMonthsAgo }
            }
        },
        { $unwind: '$items' },
        {
            $group: {
                _id: {
                    product: '$items.product',
                    month: { $month: '$createdAt' },
                    year: { $year: '$createdAt' }
                },
                quantitySold: { $sum: '$items.quantity' }
            }
        },
        {
            $lookup: {
                from: 'products',
                localField: '_id.product',
                foreignField: '_id',
                as: 'product'
            }
        },
        { $unwind: '$product' },
        {
            $group: {
                _id: '$_id.product',
                name: { $first: '$product.name' },
                sales: {
                    $push: {
                        month: '$_id.month',
                        year: '$_id.year',
                        quantity: '$quantitySold'
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                productId: '$_id',
                name: 1,
                sales: 1
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: productSales
    });
});