// server/cleanup-expired-data.js
const { Op } = require('sequelize');
const Otp = require('./models/Otp');

async function cleanupExpiredData() {
  try {
    console.log('🧹 Starting cleanup of EXPIRED OTPs ONLY...');
    
    // ONLY DELETE EXPIRED OTPs - NO OTHER DATA TOUCHED
    const expiredOtps = await Otp.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: new Date() } },
          { used: true, updatedAt: { [Op.lt]: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        ]
      }
    });

    console.log(`✅ Cleaned up ${expiredOtps} expired OTP records ONLY`);
    
    // ONLY DELETE OLD UNUSED OTPs - NO OTHER DATA TOUCHED
    const oldUnusedOtps = await Otp.destroy({
      where: {
        used: false,
        createdAt: { [Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }
    });

    console.log(`✅ Cleaned up ${oldUnusedOtps} old unused OTP records ONLY`);
    
    // Get current OTP count
    const remainingOtps = await Otp.count();
    console.log(`📊 Remaining OTPs in database: ${remainingOtps}`);
    console.log('🔒 NO OTHER DATA WAS TOUCHED - USERS, ACCOUNT SETS, BROKERS ARE SAFE');
    
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupExpiredData()
    .then(() => {
      console.log('🏁 Cleanup completed');
      process.exit(0);
    })
    .catch(err => {
      console.error('💥 Cleanup failed:', err);
      process.exit(1);
    });
}

module.exports = cleanupExpiredData;