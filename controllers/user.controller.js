const User = require('../models/user.model');

// @desc    Get all users (with pagination and filtering)
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter = {};
    
    if (req.query.role) {
      filter.role = req.query.role;
    }
    
    if (req.query.isActive) {
      filter.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    
    // Execute query
    const users = await User.find(filter)
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await User.countDocuments(filter);
    
    res.status(200).json({
      status: 'success',
      results: users.length,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: users,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (user) {
      res.status(200).json({
        status: 'success',
        data: user,
      });
    } else {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
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

// @desc    Create a new user (by admin)
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: 'fail',
        message: 'User already exists',
      });
    }
    
    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role,
      phone,
    });
    
    if (user) {
      res.status(201).json({
        status: 'success',
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
        },
      });
    } else {
      res.status(400).json({
        status: 'fail',
        message: 'Invalid user data',
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

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, phone, isActive } = req.body;
    
    // Find user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (phone) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    
    // Save updated user
    const updatedUser = await user.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone,
        isActive: updatedUser.isActive,
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

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (user) {
      await user.deleteOne();
      
      res.status(200).json({
        status: 'success',
        message: 'User deleted successfully',
      });
    } else {
      res.status(404).json({
        status: 'fail',
        message: 'User not found',
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

// @desc    Add user address
// @route   POST /api/users/address
// @access  Private
exports.addAddress = async (req, res) => {
  try {
    const { street, city, state, zipCode, country, isDefault } = req.body;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Create new address
    const newAddress = {
      street,
      city,
      state,
      zipCode,
      country,
      isDefault: isDefault || false,
    };
    
    // If new address is default, set all other addresses to non-default
    if (newAddress.isDefault) {
      user.addresses.forEach(address => {
        address.isDefault = false;
      });
    }
    
    // Add new address
    user.addresses.push(newAddress);
    
    // If this is the first address, make it default
    if (user.addresses.length === 1) {
      user.addresses[0].isDefault = true;
    }
    
    await user.save();
    
    res.status(201).json({
      status: 'success',
      data: {
        addresses: user.addresses,
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

// @desc    Update user address
// @route   PUT /api/users/address/:addressId
// @access  Private
exports.updateAddress = async (req, res) => {
  try {
    const { street, city, state, zipCode, country, isDefault } = req.body;
    const { addressId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Find address
    const address = user.addresses.id(addressId);
    
    if (!address) {
      return res.status(404).json({
        status: 'fail',
        message: 'Address not found',
      });
    }
    
    // Update address fields
    if (street) address.street = street;
    if (city) address.city = city;
    if (state) address.state = state;
    if (zipCode) address.zipCode = zipCode;
    if (country) address.country = country;
    
    // Handle default address
    if (isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = addr._id.toString() === addressId;
      });
    }
    
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        addresses: user.addresses,
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

// @desc    Delete user address
// @route   DELETE /api/users/address/:addressId
// @access  Private
exports.deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }
    
    // Find address
    const address = user.addresses.id(addressId);
    
    if (!address) {
      return res.status(404).json({
        status: 'fail',
        message: 'Address not found',
      });
    }
    
    // Check if it's the default address
    const isDefault = address.isDefault;
    
    // Remove address
    user.addresses.pull(addressId);
    
    // If deleted address was default and there are other addresses, make the first one default
    if (isDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    
    await user.save();
    
    res.status(200).json({
      status: 'success',
      data: {
        addresses: user.addresses,
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