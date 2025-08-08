// server/config/mail.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,                // true if port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send an email
 * @param {string} to    Recipient address
 * @param {string} subject
 * @param {string} text
 */
async function sendMail(to, subject, text) {
  await transporter.sendMail({
    from: `"Flux Network" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
}

module.exports = sendMail;
