const Inventory = require('../models/inventory.model');
const Product = require('../models/product.model');
const Shop = require('../models/shop.model');
const User = require('../models/user.model');

// @desc    Get all inventory items
// @route   GET /api/inventory
// @access  Private (Admin, Vendor, Staff)
exports.getInventory = async (req, res) => {
  try {
    const { 
      shop, 
      status, 
      search,
      page = 1,
      limit = 10,
      sort = '-createdAt'
    } = req.query;
    
    // Build query
    const query = {};
    
    if (status) query.status = status;
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all inventory
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see inventory for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access inventory for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Add search functionality
    if (search) {
      // First find products that match the search
      const products = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      
      const productIds = products.map(p => p._id);
      query.product = { $in: productIds };
    }
    
    // Count total inventory items
    const total = await Inventory.countDocuments(query);
    
    // Get inventory items
    const inventoryItems = await Inventory.find(query)
      .populate('product', 'name price images sku barcode stock')
      .populate('shop', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: inventoryItems.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: inventoryItems,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get inventory item by ID
// @route   GET /api/inventory/:id
// @access  Private (Admin, Vendor, Staff)
exports.getInventoryById = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id)
      .populate('product', 'name price images sku barcode stock unit')
      .populate('shop', 'name')
      .populate('transactions.performedBy', 'name');
    
    if (!inventory) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found',
      });
    }
    
    // Check if user has permission to view this inventory
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === inventory.shop._id.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this inventory item',
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: inventory,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new inventory item
// @route   POST /api/inventory
// @access  Private (Admin, Vendor, Staff)
exports.createInventory = async (req, res) => {
  try {
    const { 
      product: productId, 
      shop: shopId, 
      initialStock, 
      currentStock,
      lowStockThreshold,
      sku,
      barcode,
      location,
      costPrice,
      supplierInfo,
      expiryDates,
      autoReorder
    } = req.body;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Check if shop exists
    const shop = await Shop.findById(shopId);
    if (!shop) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user has permission to create inventory for this shop
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === shopId && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to create inventory for this shop',
        });
      }
    }
    
    // Check if inventory already exists for this product and shop
    const existingInventory = await Inventory.findOne({
      product: productId,
      shop: shopId,
    });
    
    if (existingInventory) {
      return res.status(400).json({
        status: 'fail',
        message: 'Inventory already exists for this product and shop',
      });
    }
    
    // Create inventory
    const inventory = await Inventory.create({
      product: productId,
      shop: shopId,
      initialStock: initialStock || 0,
      currentStock: currentStock || initialStock || 0,
      lowStockThreshold: lowStockThreshold || 10,
      sku,
      barcode,
      location,
      costPrice,
      supplierInfo,
      expiryDates,
      autoReorder,
      transactions: [
        {
          type: 'purchase',
          quantity: initialStock || 0,
          notes: 'Initial stock',
          performedBy: req.user._id,
        },
      ],
    });
    
    // Update product stock
    await Product.findByIdAndUpdate(productId, {
      stock: currentStock || initialStock || 0,
      sku: sku || product.sku,
      barcode: barcode || product.barcode,
    });
    
    res.status(201).json({
      status: 'success',
      data: inventory,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update inventory
// @route   PUT /api/inventory/:id
// @access  Private (Admin, Vendor, Staff)
exports.updateInventory = async (req, res) => {
  try {
    const { 
      lowStockThreshold,
      sku,
      barcode,
      location,
      costPrice,
      supplierInfo,
      autoReorder
    } = req.body;
    
    // Find inventory
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found',
      });
    }
    
    // Check if user has permission to update this inventory
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === inventory.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to update this inventory item',
        });
      }
    }
    
    // Update inventory
    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      {
        lowStockThreshold,
        sku,
        barcode,
        location,
        costPrice,
        supplierInfo,
        autoReorder,
      },
      { new: true, runValidators: true }
    );
    
    // Update product SKU and barcode if provided
    if (sku || barcode) {
      await Product.findByIdAndUpdate(inventory.product, {
        sku: sku || undefined,
        barcode: barcode || undefined,
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: updatedInventory,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete inventory
// @route   DELETE /api/inventory/:id
// @access  Private (Admin, Vendor)
exports.deleteInventory = async (req, res) => {
  try {
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found',
      });
    }
    
    // Check if user has permission to delete this inventory
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === inventory.shop.toString() && 
        shop.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this inventory item',
        });
      }
    }
    
    await inventory.deleteOne();
    
    res.status(200).json({
      status: 'success',
      message: 'Inventory item deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Adjust inventory stock
// @route   POST /api/inventory/:id/adjust
// @access  Private (Admin, Vendor, Staff)
exports.adjustStock = async (req, res) => {
  try {
    const { 
      type, 
      quantity, 
      notes,
      reference
    } = req.body;
    
    // Find inventory
    const inventory = await Inventory.findById(req.params.id);
    if (!inventory) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found',
      });
    }
    
    // Check if user has permission to adjust this inventory
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === inventory.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to adjust this inventory',
        });
      }
    }
    
    // Calculate new stock level
    let newStock = inventory.currentStock;
    
    if (type === 'purchase' || type === 'return' || type === 'adjustment') {
      newStock += quantity;
    } else if (type === 'sale' || type === 'loss' || type === 'transfer') {
      newStock -= quantity;
      
      // Check if there's enough stock
      if (newStock < 0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Not enough stock available',
        });
      }
    } else {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid adjustment type',
      });
    }
    
    // Add transaction
    const transaction = {
      type,
      quantity,
      date: new Date(),
      notes,
      reference,
      performedBy: req.user._id,
    };
    
    // Update inventory
    const updatedInventory = await Inventory.findByIdAndUpdate(
      req.params.id,
      {
        currentStock: newStock,
        $push: { transactions: transaction },
      },
      { new: true }
    );
    
    // Update product stock
    await Product.findByIdAndUpdate(inventory.product, {
      stock: newStock,
    });
    
    res.status(200).json({
      status: 'success',
      data: updatedInventory,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get low stock items
// @route   GET /api/inventory/low-stock
// @access  Private (Admin, Vendor, Staff)
exports.getLowStockItems = async (req, res) => {
  try {
    const { shop } = req.query;
    
    // Build query
    const query = {
      status: 'low_stock',
    };
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can see all low stock items
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only see low stock items for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to access inventory for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get low stock items
    const lowStockItems = await Inventory.find(query)
      .populate('product', 'name price images sku barcode stock')
      .populate('shop', 'name')
      .sort('currentStock');
    
    res.status(200).json({
      status: 'success',
      count: lowStockItems.length,
      data: lowStockItems,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get inventory by shop
// @route   GET /api/inventory/shop/:shopId
// @access  Private (Admin, Vendor, Staff)
exports.getInventoryByShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { 
      status, 
      search,
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
    
    // Check if user has permission to view inventory for this shop
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === shopId && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to view inventory for this shop',
        });
      }
    }
    
    // Build query
    const query = { shop: shopId };
    
    if (status) query.status = status;
    
    // Add search functionality
    if (search) {
      // First find products that match the search
      const products = await Product.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      
      const productIds = products.map(p => p._id);
      query.product = { $in: productIds };
    }
    
    // Count total inventory items
    const total = await Inventory.countDocuments(query);
    
    // Get inventory items
    const inventoryItems = await Inventory.find(query)
      .populate('product', 'name price images sku barcode stock')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    res.status(200).json({
      status: 'success',
      count: inventoryItems.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: inventoryItems,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get inventory by product
// @route   GET /api/inventory/product/:productId
// @access  Private (Admin, Vendor, Staff)
exports.getInventoryByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }
    
    // Build query
    const query = { product: productId };
    
    // Filter by user role
    if (req.user.role !== 'admin') {
      // Vendor/staff can only see inventory for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
    }
    
    // Get inventory items
    const inventoryItems = await Inventory.find(query)
      .populate('shop', 'name')
      .sort('-currentStock');
    
    res.status(200).json({
      status: 'success',
      count: inventoryItems.length,
      data: inventoryItems,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get inventory transactions
// @route   GET /api/inventory/:id/transactions
// @access  Private (Admin, Vendor, Staff)
exports.getInventoryTransactions = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      type, 
      startDate, 
      endDate,
      page = 1,
      limit = 10,
      sort = '-date'
    } = req.query;
    
    // Find inventory
    const inventory = await Inventory.findById(id);
    if (!inventory) {
      return res.status(404).json({
        status: 'fail',
        message: 'Inventory item not found',
      });
    }
    
    // Check if user has permission to view this inventory
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(shop => 
        shop.shop.toString() === inventory.shop.toString() && 
        (shop.role === 'owner' || shop.role === 'staff')
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to access this inventory item',
        });
      }
    }
    
    // Filter transactions
    let transactions = inventory.transactions;
    
    if (type) {
      transactions = transactions.filter(t => t.type === type);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      transactions = transactions.filter(t => new Date(t.date) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      transactions = transactions.filter(t => new Date(t.date) <= end);
    }
    
    // Sort transactions
    if (sort === '-date') {
      transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === 'date') {
      transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    // Paginate transactions
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedTransactions = transactions.slice(startIndex, endIndex);
    
    // Get user details for transactions
    const userIds = [...new Set(paginatedTransactions.map(t => t.performedBy?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('name');
    
    const usersMap = users.reduce((map, user) => {
      map[user._id.toString()] = user.name;
      return map;
    }, {});
    
    // Add user names to transactions
    const transactionsWithUserNames = paginatedTransactions.map(t => ({
      ...t.toObject(),
      performedByName: t.performedBy ? usersMap[t.performedBy.toString()] : null,
    }));
    
    res.status(200).json({
      status: 'success',
      count: transactionsWithUserNames.length,
      total: transactions.length,
      totalPages: Math.ceil(transactions.length / limit),
      currentPage: parseInt(page),
      data: transactionsWithUserNames,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Import inventory
// @route   POST /api/inventory/import
// @access  Private (Admin, Vendor)
exports.importInventory = async (req, res) => {
  try {
    const { shop, items } = req.body;
    
    // Check if shop exists
    const shopExists = await Shop.findById(shop);
    if (!shopExists) {
      return res.status(404).json({
        status: 'fail',
        message: 'Shop not found',
      });
    }
    
    // Check if user has permission to import inventory for this shop
    if (req.user.role !== 'admin') {
      const hasAccess = req.user.shops.some(s => 
        s.shop.toString() === shop && 
        s.role === 'owner'
      );
      
      if (!hasAccess) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to import inventory for this shop',
        });
      }
    }
    
    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Items array is required and must not be empty',
      });
    }
    
    const results = {
      success: [],
      errors: [],
    };
    
    // Process each item
    for (const item of items) {
      try {
        const { 
          product: productId, 
          initialStock, 
          currentStock,
          lowStockThreshold,
          sku,
          barcode,
          location,
          costPrice
        } = item;
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
          results.errors.push({
            productId,
            error: 'Product not found',
          });
          continue;
        }
        
        // Check if inventory already exists for this product and shop
        const existingInventory = await Inventory.findOne({
          product: productId,
          shop,
        });
        
        if (existingInventory) {
          // Update existing inventory
          const updatedInventory = await Inventory.findByIdAndUpdate(
            existingInventory._id,
            {
              currentStock: currentStock || existingInventory.currentStock,
              lowStockThreshold: lowStockThreshold || existingInventory.lowStockThreshold,
              sku: sku || existingInventory.sku,
              barcode: barcode || existingInventory.barcode,
              location: location || existingInventory.location,
              costPrice: costPrice || existingInventory.costPrice,
              $push: {
                transactions: {
                  type: 'adjustment',
                  quantity: currentStock - existingInventory.currentStock,
                  notes: 'Imported from bulk update',
                  performedBy: req.user._id,
                },
              },
            },
            { new: true }
          );
          
          // Update product stock
          await Product.findByIdAndUpdate(productId, {
            stock: currentStock || existingInventory.currentStock,
            sku: sku || product.sku,
            barcode: barcode || product.barcode,
          });
          
          results.success.push({
            productId,
            inventoryId: updatedInventory._id,
            action: 'updated',
          });
        } else {
          // Create new inventory
          const newInventory = await Inventory.create({
            product: productId,
            shop,
            initialStock: initialStock || 0,
            currentStock: currentStock || initialStock || 0,
            lowStockThreshold: lowStockThreshold || 10,
            sku,
            barcode,
            location,
            costPrice,
            transactions: [
              {
                type: 'purchase',
                quantity: initialStock || 0,
                notes: 'Initial stock from import',
                performedBy: req.user._id,
              },
            ],
          });
          
          // Update product stock
          await Product.findByIdAndUpdate(productId, {
            stock: currentStock || initialStock || 0,
            sku: sku || product.sku,
            barcode: barcode || product.barcode,
          });
          
          results.success.push({
            productId,
            inventoryId: newInventory._id,
            action: 'created',
          });
        }
      } catch (error) {
        results.errors.push({
          productId: item.product,
          error: error.message,
        });
      }
    }
    
    res.status(200).json({
      status: 'success',
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Export inventory
// @route   GET /api/inventory/export
// @access  Private (Admin, Vendor, Staff)
exports.exportInventory = async (req, res) => {
  try {
    const { shop, format = 'json' } = req.query;
    
    // Build query
    const query = {};
    
    // Filter by user role
    if (req.user.role === 'admin') {
      // Admin can export all inventory
      if (shop) query.shop = shop;
    } else if (req.user.role === 'vendor' || req.user.role === 'staff') {
      // Vendor/staff can only export inventory for their shops
      const shopIds = req.user.shops
        .filter(s => s.role === 'owner' || s.role === 'staff')
        .map(s => s.shop);
      
      query.shop = { $in: shopIds };
      
      if (shop) {
        // Check if user has access to this shop
        if (!shopIds.includes(shop)) {
          return res.status(403).json({
            status: 'fail',
            message: 'Not authorized to export inventory for this shop',
          });
        }
        
        query.shop = shop;
      }
    }
    
    // Get inventory items with populated references
    const inventoryItems = await Inventory.find(query)
      .populate('product', 'name sku barcode price stock unit')
      .populate('shop', 'name');
    
    // Format data for export
    const exportData = inventoryItems.map(item => ({
      productId: item.product._id,
      productName: item.product.name,
      sku: item.sku || item.product.sku,
      barcode: item.barcode || item.product.barcode,
      shopId: item.shop._id,
      shopName: item.shop.name,
      currentStock: item.currentStock,
      initialStock: item.initialStock,
      lowStockThreshold: item.lowStockThreshold,
      status: item.status,
      costPrice: item.costPrice,
      sellingPrice: item.product.price,
      unit: item.product.unit,
      location: item.location,
    }));
    
    // Return data in requested format
    if (format === 'csv') {
      // Convert to CSV
      const fields = Object.keys(exportData[0] || {});
      const csv = [
        fields.join(','),
        ...exportData.map(item => 
          fields.map(field => {
            const value = item[field];
            // Handle values that might contain commas
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value}"`;
            }
            return value;
          }).join(',')
        ),
      ].join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
      return res.send(csv);
    } else {
      // Return as JSON
      res.status(200).json({
        status: 'success',
        count: exportData.length,
        data: exportData,
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};