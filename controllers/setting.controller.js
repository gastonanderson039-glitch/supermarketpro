const Setting = require('../models/setting.model');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private (Admin)
exports.getSettings = async (req, res) => {
  try {
    const { group } = req.query;
    
    // Build query
    const query = {};
    
    if (group) {
      query.group = group;
    }
    
    // Get settings
    const settings = await Setting.find(query).sort('group key');
    
    // Convert to key-value object
    const settingsObject = settings.reduce((obj, setting) => {
      obj[setting.key] = {
        value: setting.value,
        group: setting.group,
        description: setting.description,
        dataType: setting.dataType,
        options: setting.options,
        isPublic: setting.isPublic,
        updatedAt: setting.updatedAt,
      };
      return obj;
    }, {});
    
    res.status(200).json({
      status: 'success',
      data: settingsObject,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get setting by key
// @route   GET /api/settings/:key
// @access  Private (Admin)
exports.getSettingByKey = async (req, res) => {
  try {
    const { key } = req.params;
    
    // Get setting
    const setting = await Setting.findOne({ key });
    
    if (!setting) {
      return res.status(404).json({
        status: 'fail',
        message: 'Setting not found',
      });
    }
    
    res.status(200).json({
      status: 'success',
      data: setting,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update setting
// @route   PUT /api/settings/:key
// @access  Private (Admin)
exports.updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, isPublic, description, options } = req.body;
    
    // Find setting
    const setting = await Setting.findOne({ key });
    
    if (!setting) {
      return res.status(404).json({
        status: 'fail',
        message: 'Setting not found',
      });
    }
    
    // Validate value type
    if (value !== undefined) {
      let isValidType = false;
      
      switch (setting.dataType) {
        case 'string':
          isValidType = typeof value === 'string';
          break;
        case 'number':
          isValidType = typeof value === 'number';
          break;
        case 'boolean':
          isValidType = typeof value === 'boolean';
          break;
        case 'array':
          isValidType = Array.isArray(value);
          break;
        case 'object':
          isValidType = typeof value === 'object' && value !== null && !Array.isArray(value);
          break;
        case 'date':
          isValidType = value instanceof Date || !isNaN(new Date(value).getTime());
          break;
        default:
          isValidType = true;
      }
      
      if (!isValidType) {
        return res.status(400).json({
          status: 'fail',
          message: `Value must be of type ${setting.dataType}`,
        });
      }
      
      // Validate against options if provided
      if (setting.options && setting.options.length > 0) {
        const validValues = setting.options.map(option => option.value);
        
        if (!validValues.includes(value)) {
          return res.status(400).json({
            status: 'fail',
            message: `Value must be one of: ${validValues.join(', ')}`,
          });
        }
      }
    }
    
    // Update setting
    const updatedSetting = await Setting.findOneAndUpdate(
      { key },
      {
        value: value !== undefined ? value : setting.value,
        isPublic: isPublic !== undefined ? isPublic : setting.isPublic,
        description: description || setting.description,
        options: options || setting.options,
        updatedBy: req.user._id,
      },
      { new: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: updatedSetting,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update multiple settings
// @route   PUT /api/settings
// @access  Private (Admin)
exports.updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    // Validate settings
    if (!settings || !Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Settings array is required and must not be empty',
      });
    }
    
    const results = {
      success: [],
      errors: [],
    };
    
    // Update each setting
    for (const setting of settings) {
      try {
        const { key, value, isPublic } = setting;
        
        if (!key) {
          results.errors.push({
            key,
            error: 'Key is required',
          });
          continue;
        }
        
        // Find setting
        const existingSetting = await Setting.findOne({ key });
        
        if (!existingSetting) {
          results.errors.push({
            key,
            error: 'Setting not found',
          });
          continue;
        }
        
        // Validate value type
        if (value !== undefined) {
          let isValidType = false;
          
          switch (existingSetting.dataType) {
            case 'string':
              isValidType = typeof value === 'string';
              break;
            case 'number':
              isValidType = typeof value === 'number';
              break;
            case 'boolean':
              isValidType = typeof value === 'boolean';
              break;
            case 'array':
              isValidType = Array.isArray(value);
              break;
            case 'object':
              isValidType = typeof value === 'object' && value !== null && !Array.isArray(value);
              break;
            case 'date':
              isValidType = value instanceof Date || !isNaN(new Date(value).getTime());
              break;
            default:
              isValidType = true;
          }
          
          if (!isValidType) {
            results.errors.push({
              key,
              error: `Value must be of type ${existingSetting.dataType}`,
            });
            continue;
          }
          
          // Validate against options if provided
          if (existingSetting.options && existingSetting.options.length > 0) {
            const validValues = existingSetting.options.map(option => option.value);
            
            if (!validValues.includes(value)) {
              results.errors.push({
                key,
                error: `Value must be one of: ${validValues.join(', ')}`,
              });
              continue;
            }
          }
        }
        
        // Update setting
        const updatedSetting = await Setting.findOneAndUpdate(
          { key },
          {
            value: value !== undefined ? value : existingSetting.value,
            isPublic: isPublic !== undefined ? isPublic : existingSetting.isPublic,
            updatedBy: req.user._id,
          },
          { new: true }
        );
        
        results.success.push({
          key,
          value: updatedSetting.value,
        });
      } catch (error) {
        results.errors.push({
          key: setting.key,
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

// @desc    Get public settings
// @route   GET /api/settings/public
// @access  Public
exports.getPublicSettings = async (req, res) => {
  try {
    // Get public settings
    const settings = await Setting.find({ isPublic: true });
    
    // Convert to key-value object
    const publicSettings = settings.reduce((obj, setting) => {
      obj[setting.key] = setting.value;
      return obj;
    }, {});
    
    res.status(200).json({
      status: 'success',
      data: publicSettings,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get settings by group
// @route   GET /api/settings/group/:group
// @access  Private (Admin)
exports.getSettingsByGroup = async (req, res) => {
  try {
    const { group } = req.params;
    
    // Get settings for this group
    const settings = await Setting.find({ group });
    
    // Convert to key-value object
    const groupSettings = settings.reduce((obj, setting) => {
      obj[setting.key] = {
        value: setting.value,
        description: setting.description,
        dataType: setting.dataType,
        options: setting.options,
        isPublic: setting.isPublic,
        updatedAt: setting.updatedAt,
      };
      return obj;
    }, {});
    
    res.status(200).json({
      status: 'success',
      data: groupSettings,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Server error',
      error: error.message,
    });
  }
};