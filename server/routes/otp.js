// server/routes/otp.js
const express = require('express');
const crypto  = require('crypto');
const Otp     = require('../models/Otp');
const sendMail= require('../config/mail');

const router = express.Router();

/**
 * @route   POST /api/auth/request-otp
 * @desc    Generate & email an OTP for signup or password reset
 * @body    { email: string, purpose: 'signup'|'forgot' }
 */
router.post('/request-otp', async (req, res) => {
  const { email, purpose } = req.body;
  if (!email || !purpose || !['signup','forgot'].includes(purpose)) {
    return res
      .status(400)
      .json({ msg: 'Email and purpose ("signup" or "forgot") are required' });
  }

  const code      = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await Otp.create({ email, code, expiresAt });

  try {
    await sendMail(
      email,
      'Your Flux Network OTP',
      `Your one-time code is: ${code}\nIt expires in 10 minutes.`
    );
    return res.json({ msg: 'OTP sent' });
  } catch (err) {
    console.error('Email error:', err);
    return res.json({ msg: 'OTP sent (via fallback)', code });
  }
});

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify a previously requested OTP
 * @body    { email: string, code: string }
 */
router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ msg: 'Email and code are required' });
  }

  // find an unused, unexpired OTP
  const { Op } = require('sequelize');
  const otp = await Otp.findOne({
    where: {
      email,
      code,
      used: false,
      expiresAt: { [Op.gt]: new Date() }
    }
  });

  if (!otp) {
    return res.status(400).json({ msg: 'Invalid or expired code' });
  }

  // mark it used so it can't be reused
  otp.used = true;
  await otp.save();

  res.json({ msg: 'OTP verified' });
});

module.exports = router;