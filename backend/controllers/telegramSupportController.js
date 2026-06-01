const TelegramSupport = require('../models/telegramSupport');
const winston = require('winston');

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: './logs/telegram-support.log' }),
    new winston.transports.Console()
  ]
});

// Get all telegram support topics
exports.getAllSupport = async (req, res) => {
  try {
    const supportTopics = await TelegramSupport.find({})
      .populate('createdBy', 'username email')
      .populate('updatedBy', 'username email')
      .sort({ priority: 1, createdAt: 1 });

    res.json({
      success: true,
      data: supportTopics,
      count: supportTopics.length
    });
  } catch (error) {
    logger.error('Error fetching telegram support topics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support topics',
      error: error.message
    });
  }
};

// Get active support topics for users
exports.getActiveSupport = async (req, res) => {
  try {
    const supportTopics = await TelegramSupport.getActiveTopics();

    res.json({
      success: true,
      data: supportTopics,
      count: supportTopics.length
    });
  } catch (error) {
    logger.error('Error fetching active support topics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active support topics',
      error: error.message
    });
  }
};

// Create new support topic
exports.createSupport = async (req, res) => {
  try {
    // Debug logging
    console.log('Creating support topic - req.user:', req.user);
    console.log('Creating support topic - req.admin:', req.admin);
    console.log('Creating support topic - body:', req.body);
    
    const {
      topic,
      title,
      description,
      telegramUsername,
      telegramUserId,
      priority,
      icon
    } = req.body;

    // Validate required fields
    if (!topic || !title || !description || !telegramUsername) {
      return res.status(400).json({
        success: false,
        message: 'Topic, title, description, and telegram username are required'
      });
    }

    // Check if topic already exists
    const existingTopic = await TelegramSupport.findOne({ topic });
    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: 'Support topic already exists'
      });
    }

    // Clean telegram username more thoroughly
    const cleanUsername = telegramUsername.replace(/[@]/g, '');
    console.log('Original username:', telegramUsername, 'Cleaned:', cleanUsername);

    const supportTopic = new TelegramSupport({
      topic,
      title,
      description,
      telegramUsername: cleanUsername,
      telegramUserId,
      priority: priority || 1,
      icon: icon || 'QuestionMarkCircleIcon',
      createdBy: req.admin._id // Use req.admin._id like other admin controllers
    });

    await supportTopic.save();

    logger.info(`New telegram support topic created: ${topic} by admin ${req.admin._id}`); // Use req.admin._id

    res.status(201).json({
      success: true,
      message: 'Support topic created successfully',
      data: supportTopic
    });
  } catch (error) {
    logger.error('Error creating telegram support topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create support topic',
      error: error.message
    });
  }
};

// Update support topic
exports.updateSupport = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      telegramUsername,
      telegramUserId,
      priority,
      icon,
      isActive
    } = req.body;

    const supportTopic = await TelegramSupport.findById(id);
    if (!supportTopic) {
      return res.status(404).json({
        success: false,
        message: 'Support topic not found'
      });
    }

    // Update fields
    if (title) supportTopic.title = title;
    if (description) supportTopic.description = description;
    if (telegramUsername) {
      // Clean telegram username more thoroughly
      supportTopic.telegramUsername = telegramUsername.replace(/[@]/g, '');
    }
    if (telegramUserId !== undefined) supportTopic.telegramUserId = telegramUserId;
    if (priority !== undefined) supportTopic.priority = priority;
    if (icon) supportTopic.icon = icon;
    if (isActive !== undefined) supportTopic.isActive = isActive;
    
    supportTopic.updatedBy = req.admin._id; // Use req.admin._id instead of req.user.id

    await supportTopic.save();

    logger.info(`Telegram support topic updated: ${id} by admin ${req.admin._id}`); // Use req.admin._id

    res.json({
      success: true,
      message: 'Support topic updated successfully',
      data: supportTopic
    });
  } catch (error) {
    logger.error('Error updating telegram support topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update support topic',
      error: error.message
    });
  }
};

// Delete support topic
exports.deleteSupport = async (req, res) => {
  try {
    const { id } = req.params;

    const supportTopic = await TelegramSupport.findById(id);
    if (!supportTopic) {
      return res.status(404).json({
        success: false,
        message: 'Support topic not found'
      });
    }

    await TelegramSupport.findByIdAndDelete(id);

    logger.info(`Telegram support topic deleted: ${id} by admin ${req.admin._id}`); // Use req.admin._id

    res.json({
      success: true,
      message: 'Support topic deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting telegram support topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete support topic',
      error: error.message
    });
  }
};

// Get support by topic
exports.getSupportByTopic = async (req, res) => {
  try {
    const { topic } = req.params;

    const supportTopic = await TelegramSupport.getBySupportTopic(topic);
    if (!supportTopic) {
      return res.status(404).json({
        success: false,
        message: 'Support topic not found'
      });
    }

    res.json({
      success: true,
      data: supportTopic
    });
  } catch (error) {
    logger.error('Error fetching support topic:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch support topic',
      error: error.message
    });
  }
};

// Toggle support topic status
exports.toggleSupportStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const supportTopic = await TelegramSupport.findById(id);
    if (!supportTopic) {
      return res.status(404).json({
        success: false,
        message: 'Support topic not found'
      });
    }

    supportTopic.isActive = !supportTopic.isActive;
    supportTopic.updatedBy = req.admin._id; // Use req.admin._id instead of req.user.id
    await supportTopic.save();

    logger.info(`Telegram support topic status toggled: ${id} to ${supportTopic.isActive} by admin ${req.admin._id}`); // Use req.admin._id

    res.json({
      success: true,
      message: `Support topic ${supportTopic.isActive ? 'activated' : 'deactivated'} successfully`,
      data: supportTopic
    });
  } catch (error) {
    logger.error('Error toggling support topic status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle support topic status',
      error: error.message
    });
  }
};
