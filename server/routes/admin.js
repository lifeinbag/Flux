// server/routes/admin.js
const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { AccountSet, Broker } = require('../models/AccountSet');

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Access denied: admins only' });
  }
  next();
};

// @route   GET /api/admin/users
// @desc    Return all users with account set and terminal counts (admins only)
// @access  Private (admin)
router.get('/users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      include: [{
        model: AccountSet,
        as: 'accountSets',
        include: [{
          model: Broker,
          as: 'brokers'
        }]
      }],
      order: [['createdAt', 'DESC']]
    });

    // Transform users to include counts
    const usersWithCounts = users.map(user => {
      const accountSets = user.accountSets || [];
      const allBrokers = accountSets.flatMap(set => set.brokers || []);
      
      return {
        ...user.toJSON(),
        accountSetsCount: accountSets.length,
        mt4Count: allBrokers.filter(broker => broker.terminal === 'MT4').length,
        mt5Count: allBrokers.filter(broker => broker.terminal === 'MT5').length,
      };
    });

    res.json(usersWithCounts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/users/:id/details
// @desc    Get detailed user information including account sets and brokers
// @access  Private (admin)
router.get('/users/:id/details', auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: AccountSet,
        as: 'accountSets',
        include: [{
          model: Broker,
          as: 'brokers'
        }]
      }]
    });

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user role (admins only)
// @access  Private (admin)
router.put('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ msg: 'Invalid role' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ msg: 'User role updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admins only)
// @access  Private (admin)
router.delete('/users/:id', auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({ msg: 'Cannot delete your own account' });
    }

    await user.destroy();
    res.json({ msg: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admin/users/:id/account-sets
// @desc    Add account set for user (admins only)
// @access  Private (admin)
router.post('/users/:id/account-sets', auth, requireAdmin, async (req, res) => {
  try {
    const { name, brokers } = req.body;
    
    // Validate input
    if (!name || !name.trim()) {
      return res.status(400).json({ msg: 'Account set name is required' });
    }
    
    if (!Array.isArray(brokers) || brokers.length !== 2) {
      return res.status(400).json({ msg: 'Exactly 2 brokers required (MT4 and MT5)' });
    }
    
    // Validate brokers
    const requiredFields = ['terminal', 'accountNumber', 'password', 'server'];
    for (const broker of brokers) {
      for (const field of requiredFields) {
        if (!broker[field] || typeof broker[field] !== 'string') {
          return res.status(400).json({ msg: `Missing or invalid ${field} in broker data` });
        }
      }
      if (!['MT4', 'MT5'].includes(broker.terminal)) {
        return res.status(400).json({ msg: 'Broker terminal must be either MT4 or MT5' });
      }
    }
    
    // Check if user exists
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Create account set
    const accountSet = await AccountSet.create({
      userId: req.params.id,
      name: name.trim()
    });
    
    // Create brokers
    const brokerPromises = brokers.map(broker => 
      Broker.create({
        accountSetId: accountSet.id,
        terminal: broker.terminal,
        accountNumber: broker.accountNumber,
        password: broker.password,
        server: broker.server
      })
    );
    
    await Promise.all(brokerPromises);
    
    // Return the created account set with brokers
    const newAccountSet = await AccountSet.findByPk(accountSet.id, {
      include: [{
        model: Broker,
        as: 'brokers'
      }]
    });
    
    res.json({ 
      msg: 'Account set created successfully',
      accountSet: newAccountSet
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admin/account-sets/:id/brokers
// @desc    Add broker to account set (admins only)
// @access  Private (admin)
router.post('/account-sets/:id/brokers', auth, requireAdmin, async (req, res) => {
  try {
    const { terminal, accountNumber, password, server } = req.body;
    
    // Validate input
    if (!terminal || !accountNumber || !password || !server) {
      return res.status(400).json({ msg: 'All broker fields are required' });
    }
    
    if (!['MT4', 'MT5'].includes(terminal)) {
      return res.status(400).json({ msg: 'Terminal must be either MT4 or MT5' });
    }
    
    // Check if account set exists
    const accountSet = await AccountSet.findByPk(req.params.id);
    if (!accountSet) {
      return res.status(404).json({ msg: 'Account set not found' });
    }
    
    // Create broker
    const broker = await Broker.create({
      accountSetId: req.params.id,
      terminal,
      accountNumber,
      password,
      server
    });
    
    res.json({ 
      msg: 'Broker added successfully',
      broker
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/admin/account-sets/:id
// @desc    Delete account set (admins only)
// @access  Private (admin)
router.delete('/account-sets/:id', auth, requireAdmin, async (req, res) => {
  try {
    const accountSet = await AccountSet.findByPk(req.params.id);
    if (!accountSet) {
      return res.status(404).json({ msg: 'Account set not found' });
    }
    
    await accountSet.destroy();
    res.json({ msg: 'Account set deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   DELETE /api/admin/brokers/:id
// @desc    Delete broker (admins only)
// @access  Private (admin)
router.delete('/brokers/:id', auth, requireAdmin, async (req, res) => {
  try {
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ msg: 'Broker not found' });
    }
    
    await broker.destroy();
    res.json({ msg: 'Broker deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   PUT /api/admin/brokers/:id
// @desc    Update broker (admins only)
// @access  Private (admin)
router.put('/brokers/:id', auth, requireAdmin, async (req, res) => {
  try {
    const { terminal, accountNumber, password, server } = req.body;
    
    const broker = await Broker.findByPk(req.params.id);
    if (!broker) {
      return res.status(404).json({ msg: 'Broker not found' });
    }
    
    // Update fields if provided
    if (terminal && ['MT4', 'MT5'].includes(terminal)) {
      broker.terminal = terminal;
    }
    if (accountNumber) broker.accountNumber = accountNumber;
    if (password) broker.password = password;
    if (server) broker.server = server;
    
    await broker.save();
    
    res.json({ 
      msg: 'Broker updated successfully',
      broker
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/stats
// @desc    Get admin statistics
// @access  Private (admin)
router.get('/stats', auth, requireAdmin, async (req, res) => {
  try {
    const { Op } = require('sequelize');
    
    const totalUsers = await User.count();
    const adminUsers = await User.count({ where: { role: 'admin' } });
    const regularUsers = await User.count({ where: { role: 'user' } });
    const totalAccountSets = await AccountSet.count();
    const totalBrokers = await Broker.count();
    const mt4Brokers = await Broker.count({ where: { terminal: 'MT4' } });
    const mt5Brokers = await Broker.count({ where: { terminal: 'MT5' } });
    
    // Get recent activity (users created in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = await User.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });
    
    const recentAccountSets = await AccountSet.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    res.json({
      totalUsers,
      adminUsers,
      regularUsers,
      totalAccountSets,
      totalBrokers,
      mt4Brokers,
      mt5Brokers,
      recentUsers,
      recentAccountSets
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/system-health
// @desc    Get system health information
// @access  Private (admin)
router.get('/system-health', auth, requireAdmin, async (req, res) => {
  try {
    const { sequelize } = require('../models');
    
    // Test database connection
    let dbStatus = 'healthy';
    let dbLatency = 0;
    
    try {
      const start = Date.now();
      await sequelize.authenticate();
      dbLatency = Date.now() - start;
    } catch (err) {
      dbStatus = 'error';
      console.error('Database health check failed:', err);
    }
    
    // Get system uptime
    const uptime = process.uptime();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    
    res.json({
      database: {
        status: dbStatus,
        latency: dbLatency
      },
      system: {
        uptime: uptime,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        nodeVersion: process.version,
        platform: process.platform
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   POST /api/admin/broadcast
// @desc    Broadcast message to all users (future feature)
// @access  Private (admin)
router.post('/broadcast', auth, requireAdmin, async (req, res) => {
  try {
    const { message, type = 'info' } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ msg: 'Message is required' });
    }
    
    // For now, just log the broadcast
    // In the future, this could send emails, push notifications, etc.
    console.log(`📢 Admin broadcast (${type}): ${message}`);
    
    res.json({ 
      msg: 'Broadcast sent successfully',
      recipients: await User.count()
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// @route   GET /api/admin/audit-log
// @desc    Get audit log of admin actions (future feature)
// @access  Private (admin)
router.get('/audit-log', auth, requireAdmin, async (req, res) => {
  try {
    // This would typically come from a dedicated audit log table
    // For now, return mock data
    const auditLog = [
      {
        id: 1,
        admin: req.user.email,
        action: 'USER_ROLE_CHANGED',
        target: 'user@example.com',
        timestamp: new Date(),
        details: 'Changed role from user to admin'
      }
    ];
    
    res.json(auditLog);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;