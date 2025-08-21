// server/routes/user.js

const express = require('express');
const auth    = require('../middleware/auth');
const User    = require('../models/User');

const router = express.Router();

/**
 * @route   GET /api/users/me
 * @desc    Return the current user's profile (minus password)
 * @access  Private
 */
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error('User route error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST /api/users/account
 * @desc    Link or update an MT4/MT5 trading account token on the user record
 * @access  Private
 */
router.post('/account', auth, async (req, res) => {
	console.log('▶️ POST /api/users/account payload:', req.body);
  try {
    const { terminal, token, serverName, accountNumber } = req.body;

    // Basic validation
    if (!['MT4', 'MT5'].includes(terminal) || !token) {
      return res.status(400).json({ msg: 'terminal (MT4/MT5) and token are required' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Get current tradingAccounts array (stored as JSONB)
    let tradingAccounts = user.tradingAccounts || [];

    // Upsert into tradingAccounts array
    const idx = tradingAccounts.findIndex(a => a.terminal === terminal);
    if (idx >= 0) {
      // Update existing entry
      tradingAccounts[idx].token         = token;
      tradingAccounts[idx].serverName    = serverName    || tradingAccounts[idx].serverName;
      tradingAccounts[idx].accountNumber = accountNumber || tradingAccounts[idx].accountNumber;
      tradingAccounts[idx].linkedAt      = new Date();
    } else {
      // Add new entry
      tradingAccounts.push({
        terminal,
        token,
        serverName:    serverName    || '',
        accountNumber: accountNumber || '',
        linkedAt:      new Date()
      });
    }

    // Update the user with new tradingAccounts array
    user.tradingAccounts = tradingAccounts;
    await user.save();
	
	console.log('✅ Updated tradingAccounts:', user.tradingAccounts);

    // Return the updated array of tradingAccounts
    return res.json({ tradingAccounts: user.tradingAccounts });
  } catch (err) {
    console.error('User route error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   GET /api/users/network
 * @desc    Get current user's 2-tier referral network with sponsor information
 * @access  Private
 */
router.get('/network', auth, async (req, res) => {
  try {
    // Get current user's share percentages
    const currentUser = await User.findByPk(req.user.id, {
      attributes: ['level1Share', 'level2Share']
    });

    // Level 1 referrals (direct referrals)
    const level1 = await User.findAll({
      where: { sponsorId: req.user.id },
      attributes: ['id', 'email', 'mt4Account', 'mt5Account']
    });

    // Level 2 referrals (referrals of referrals) with sponsor information
    const level1Ids = level1.map(u => u.id);
    const level2Raw = await User.findAll({
      where: { 
        sponsorId: { 
          [require('sequelize').Op.in]: level1Ids 
        } 
      },
      attributes: ['id', 'email', 'mt4Account', 'mt5Account', 'sponsorId'],
      include: [{
        model: User,
        as: 'sponsor',
        attributes: ['id', 'email'],
        required: true
      }]
    });

    // Transform level2 data to include sponsor email
    const level2 = level2Raw.map(user => ({
      id: user.id,
      email: user.email,
      mt4Account: user.mt4Account,
      mt5Account: user.mt5Account,
      sponsorId: user.sponsorId,
      sponsorEmail: user.sponsor ? user.sponsor.email : 'Unknown'
    }));

    res.json({ 
      level1, 
      level2,
      level1Share: currentUser.level1Share || 0,
      level2Share: currentUser.level2Share || 0
    });
  } catch (err) {
    console.error('Network endpoint error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * @route   POST /api/users/network/shares
 * @desc    Save level-1 and level-2 share percentages for the user
 * @access  Private
 */
router.post('/network/shares', auth, async (req, res) => {
  try {
    const { level1, level2 } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    user.level1Share = level1;
    user.level2Share = level2;
    await user.save();

    res.json({ level1Share: level1, level2Share: level2 });
  } catch (err) {
    console.error('User route error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;