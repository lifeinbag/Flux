// server/middleware/auth.js
require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function auth(req, res, next) {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      clockTolerance: 30, // 30-second grace period
      ignoreExpiration: false // But still check expiry
    });
  } catch (err) {
    const message = err.name === 'TokenExpiredError' 
      ? 'Session expired - please login again'
      : 'Invalid token';
    return res.status(401).json({ success: false, message });
  }

  // Determine user ID from payload
  const userId =
    payload.user?.id ||
    payload.id ||
    payload.userId;

  if (!userId) {
    console.error('⚠️ Unexpected JWT payload:', payload);
    return res.status(401).json({ success: false, message: 'Token missing user ID' });
  }

  try {
    // Optional: verify user still exists
    const user = await User.findByPk(userId, {
      attributes: ['id', 'role']
    });
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    // Attach to request
    req.user = { id: user.id.toString(), role: user.role || 'user' };
    // Continue to next handler
    next();
  } catch (err) {
    console.error('[/middleware/auth] Error looking up user:', err);
    return res.status(500).json({ success: false, message: 'Server error in auth middleware' });
  }
};