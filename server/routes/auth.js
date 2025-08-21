// server/routes/auth.js

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const User     = require('../models/User');
const Otp      = require('../models/Otp');

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register a new user (with optional ?ref=REFCODE)
router.post('/signup', async (req, res) => {
  const { email, password, sponsorCode } = req.body;

  try {
    // 1) make sure email's free
    let user = await User.findOne({ where: { email } });
    if (user) return res.status(400).json({ msg: 'Email already in use' });

    // 2) hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // 3) find sponsor if provided
    let sponsorId = null;
    if (sponsorCode) {
      const sponsor = await User.findOne({ where: { referralCode: sponsorCode } });
      if (sponsor) sponsorId = sponsor.id;
    }

    // 4) create user with new referralCode
    const newReferralCode = nanoid(8);
    user = await User.create({
      email,
      password: hash,
      sponsorId: sponsorId,
      referralCode: newReferralCode
    });

    // 5) sign & return a JWT
    const payload = { userId: user.id, role: user.role };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).send('Server error');
  }
});


// @route   POST /api/auth/login
// @desc    Authenticate user & get token
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { userId: user.id, role: user.role };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).send('Server error');
  }
});


// @route   POST /api/auth/reset-password
// @desc    Verify OTP & reset password (Forgot Password flow)
// @body    { email, code, newPassword }
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ msg: 'Email, code, and newPassword are required' });
  }

  try {
    // a) find matching OTP
    const { Op } = require('sequelize');
    const otp = await Otp.findOne({
      where: {
        email,
        code,
        used: false,
        expiresAt: { [Op.gt]: new Date() }
      }
    });
    if (!otp) return res.status(400).json({ msg: 'Invalid or expired OTP' });

    // b) mark OTP used
    otp.used = true;
    await otp.save();

    // c) hash & set new password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    user.password = hash;
    await user.save();

    res.json({ msg: 'Password reset successful' });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).send('Server error');
  }
});


module.exports = router;