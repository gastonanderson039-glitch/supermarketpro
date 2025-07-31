const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    group: {
      type: String,
      enum: [
        'general',
        'payment',
        'delivery',
        'notification',
        'appearance',
        'seo',
        'integration',
        'security',
        'commission',
        'tax',
        'email',
        'social',
        'analytics',
        'other'
      ],
      default: 'general',
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
    },
    dataType: {
      type: String,
      enum: ['string', 'number', 'boolean', 'array', 'object', 'date'],
      required: true,
    },
    options: [
      {
        label: String,
        value: mongoose.Schema.Types.Mixed,
      },
    ],
    validation: {
      required: {
        type: Boolean,
        default: false,
      },
      min: Number,
      max: Number,
      pattern: String,
      minLength: Number,
      maxLength: Number,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Static method to get setting by key
settingSchema.statics.getByKey = async function(key) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : null;
};

// Static method to get multiple settings by group
settingSchema.statics.getByGroup = async function(group, isPublic = null) {
  const query = { group };
  
  if (isPublic !== null) {
    query.isPublic = isPublic;
  }
  
  const settings = await this.find(query);
  return settings.reduce((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
};

// Static method to update setting by key
settingSchema.statics.updateByKey = async function(key, value, userId) {
  const setting = await this.findOne({ key });
  
  if (!setting) {
    throw new Error(`Setting with key '${key}' not found`);
  }
  
  setting.value = value;
  setting.updatedBy = userId;
  
  return setting.save();
};

// Static method to bulk update settings
settingSchema.statics.bulkUpdate = async function(settings, userId) {
  const operations = settings.map(({ key, value }) => ({
    updateOne: {
      filter: { key },
      update: { $set: { value, updatedBy: userId } },
    },
  }));
  
  return this.bulkWrite(operations);
};

// Index for efficient querying
settingSchema.index({ key: 1 });
settingSchema.index({ group: 1 });
settingSchema.index({ isPublic: 1 });

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;