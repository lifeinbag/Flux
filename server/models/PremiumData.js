// server/models/PremiumData.js
const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Optimized Premium Data Model Factory with Standardized Schema
 * Uses snake_case columns matching project standards
 */
class PremiumDataFactory {
  static models = new Map();
  
  // Standardized schema configuration
  static SCHEMA = {
    COLUMNS: {
      ID: 'id',
      ACCOUNT_SET_ID: 'account_set_id',
      TIMESTAMP: 'timestamp',
      FUTURE_BID: 'future_bid',
      FUTURE_ASK: 'future_ask',
      SPOT_BID: 'spot_bid',
      SPOT_ASK: 'spot_ask',
      BUY_PREMIUM: 'buy_premium',
      SELL_PREMIUM: 'sell_premium'
    },
    TYPES: {
      PRECISION: DataTypes.DECIMAL(15, 8),
      ACCOUNT_SET_ID: DataTypes.STRING(255),
      TIMESTAMP: DataTypes.DATE
    }
  };
  
  /**
   * Get or create premium model with standardized schema
   */
  static getModel(companyName) {
    const tableName = `premium_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    if (this.models.has(tableName)) {
      return this.models.get(tableName);
    }
    
    const PremiumModel = sequelize.define(tableName, {
      [this.SCHEMA.COLUMNS.ID]: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]: {
        type: this.SCHEMA.TYPES.ACCOUNT_SET_ID,
        allowNull: false,
        field: this.SCHEMA.COLUMNS.ACCOUNT_SET_ID
      },
      [this.SCHEMA.COLUMNS.TIMESTAMP]: {
        type: this.SCHEMA.TYPES.TIMESTAMP,
        allowNull: false,
        defaultValue: Sequelize.NOW,
        field: this.SCHEMA.COLUMNS.TIMESTAMP
      },
      [this.SCHEMA.COLUMNS.FUTURE_BID]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.FUTURE_BID
      },
      [this.SCHEMA.COLUMNS.FUTURE_ASK]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.FUTURE_ASK
      },
      [this.SCHEMA.COLUMNS.SPOT_BID]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.SPOT_BID
      },
      [this.SCHEMA.COLUMNS.SPOT_ASK]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.SPOT_ASK
      },
      [this.SCHEMA.COLUMNS.BUY_PREMIUM]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.BUY_PREMIUM
      },
      [this.SCHEMA.COLUMNS.SELL_PREMIUM]: {
        type: this.SCHEMA.TYPES.PRECISION,
        allowNull: true,
        field: this.SCHEMA.COLUMNS.SELL_PREMIUM
      }
    }, {
      tableName,
      timestamps: false,
      underscored: true,
      indexes: [
        {
          name: `idx_${tableName}_account_set_id`,
          fields: [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]
        },
        {
          name: `idx_${tableName}_timestamp`,
          fields: [this.SCHEMA.COLUMNS.TIMESTAMP]
        },
        {
          name: `idx_${tableName}_account_timestamp`,
          fields: [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID, this.SCHEMA.COLUMNS.TIMESTAMP]
        }
      ]
    });
    
    this.models.set(tableName, PremiumModel);
    return PremiumModel;
  }
  
  /**
   * Ensure table exists with correct schema
   */
  static async ensureTable(companyName) {
    const model = this.getModel(companyName);
    await model.sync({ alter: false });
    return model;
  }
  
  /**
   * Insert premium data with validation
   */
  static async insertData(companyName, data) {
    const model = this.getModel(companyName);
    
    // Validate required fields
    if (!data.account_set_id) {
      throw new Error('account_set_id is required');
    }
    
    const record = {
      [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]: data.account_set_id,
      [this.SCHEMA.COLUMNS.TIMESTAMP]: data.timestamp || new Date(),
      [this.SCHEMA.COLUMNS.FUTURE_BID]: data.future_bid,
      [this.SCHEMA.COLUMNS.FUTURE_ASK]: data.future_ask,
      [this.SCHEMA.COLUMNS.SPOT_BID]: data.spot_bid,
      [this.SCHEMA.COLUMNS.SPOT_ASK]: data.spot_ask,
      [this.SCHEMA.COLUMNS.BUY_PREMIUM]: data.buy_premium,
      [this.SCHEMA.COLUMNS.SELL_PREMIUM]: data.sell_premium
    };
    
    return await model.create(record);
  }
  
  /**
   * Get premium data with optimized queries
   */
  static async getData(companyName, accountSetId, options = {}) {
    const model = this.getModel(companyName);
    const {
      limit = 1000,
      offset = 0,
      startDate = null,
      endDate = null,
      orderBy = 'DESC'
    } = options;
    
    const where = { [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]: accountSetId };
    
    if (startDate || endDate) {
      where[this.SCHEMA.COLUMNS.TIMESTAMP] = {};
      if (startDate) where[this.SCHEMA.COLUMNS.TIMESTAMP][Sequelize.Op.gte] = startDate;
      if (endDate) where[this.SCHEMA.COLUMNS.TIMESTAMP][Sequelize.Op.lte] = endDate;
    }
    
    return await model.findAll({
      where,
      order: [[this.SCHEMA.COLUMNS.TIMESTAMP, orderBy]],
      limit,
      offset,
      raw: true
    });
  }
  
  /**
   * Get latest premium data
   */
  static async getLatest(companyName, accountSetId) {
    const model = this.getModel(companyName);
    return await model.findOne({
      where: { [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]: accountSetId },
      order: [[this.SCHEMA.COLUMNS.TIMESTAMP, 'DESC']],
      raw: true
    });
  }
  
  /**
   * Cleanup old records efficiently
   */
  static async cleanup(companyName, daysToKeep = 30) {
    const model = this.getModel(companyName);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await model.destroy({
      where: {
        [this.SCHEMA.COLUMNS.TIMESTAMP]: {
          [Sequelize.Op.lt]: cutoffDate
        }
      }
    });
    
    console.log(`Cleaned up ${result} old records from ${model.tableName}`);
    return result;
  }
  
  /**
   * Get aggregated OHLC data for charting
   */
  static async getOHLC(companyName, accountSetId, interval = '1h', limit = 100) {
    const model = this.getModel(companyName);
    const tableName = model.tableName;
    
    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];
    if (!validIntervals.includes(interval)) {
      throw new Error(`Invalid interval. Must be one of: ${validIntervals.join(', ')}`);
    }
    
    // Convert interval to PostgreSQL format
    const pgInterval = interval.replace(/(\d+)([mhd])/, (match, num, unit) => {
      const unitMap = { m: 'minute', h: 'hour', d: 'day' };
      return `${num} ${unitMap[unit]}`;
    });
    
    const query = `
      SELECT 
        DATE_TRUNC('${pgInterval}', ${this.SCHEMA.COLUMNS.TIMESTAMP}) as period,
        MIN(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as low,
        MAX(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as high,
        (array_agg(${this.SCHEMA.COLUMNS.BUY_PREMIUM} ORDER BY ${this.SCHEMA.COLUMNS.TIMESTAMP} ASC))[1] as open,
        (array_agg(${this.SCHEMA.COLUMNS.BUY_PREMIUM} ORDER BY ${this.SCHEMA.COLUMNS.TIMESTAMP} DESC))[1] as close,
        AVG(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as avg_buy_premium,
        AVG(${this.SCHEMA.COLUMNS.SELL_PREMIUM}) as avg_sell_premium,
        COUNT(*) as data_points
      FROM "${tableName}"
      WHERE ${this.SCHEMA.COLUMNS.ACCOUNT_SET_ID} = :accountSetId
        AND ${this.SCHEMA.COLUMNS.TIMESTAMP} >= NOW() - INTERVAL '${limit} ${pgInterval}'
        AND ${this.SCHEMA.COLUMNS.BUY_PREMIUM} IS NOT NULL
      GROUP BY DATE_TRUNC('${pgInterval}', ${this.SCHEMA.COLUMNS.TIMESTAMP})
      ORDER BY period DESC
      LIMIT :limit
    `;
    
    return await sequelize.query(query, {
      replacements: { accountSetId, limit },
      type: Sequelize.QueryTypes.SELECT
    });
  }
  
  /**
   * Get premium statistics
   */
  static async getStats(companyName, accountSetId, hours = 24) {
    const model = this.getModel(companyName);
    const tableName = model.tableName;
    
    const query = `
      SELECT 
        COUNT(*) as total_records,
        AVG(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as avg_buy_premium,
        AVG(${this.SCHEMA.COLUMNS.SELL_PREMIUM}) as avg_sell_premium,
        MIN(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as min_buy_premium,
        MAX(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as max_buy_premium,
        STDDEV(${this.SCHEMA.COLUMNS.BUY_PREMIUM}) as std_buy_premium,
        MIN(${this.SCHEMA.COLUMNS.TIMESTAMP}) as earliest_record,
        MAX(${this.SCHEMA.COLUMNS.TIMESTAMP}) as latest_record
      FROM "${tableName}"
      WHERE ${this.SCHEMA.COLUMNS.ACCOUNT_SET_ID} = :accountSetId
        AND ${this.SCHEMA.COLUMNS.TIMESTAMP} >= NOW() - INTERVAL '${hours} hours'
    `;
    
    const result = await sequelize.query(query, {
      replacements: { accountSetId },
      type: Sequelize.QueryTypes.SELECT
    });
    
    return result[0] || {};
  }
  
  /**
   * Bulk insert for high-performance data recording
   */
  static async bulkInsert(companyName, dataArray) {
    const model = this.getModel(companyName);
    
    const records = dataArray.map(data => ({
      [this.SCHEMA.COLUMNS.ACCOUNT_SET_ID]: data.account_set_id,
      [this.SCHEMA.COLUMNS.TIMESTAMP]: data.timestamp || new Date(),
      [this.SCHEMA.COLUMNS.FUTURE_BID]: data.future_bid,
      [this.SCHEMA.COLUMNS.FUTURE_ASK]: data.future_ask,
      [this.SCHEMA.COLUMNS.SPOT_BID]: data.spot_bid,
      [this.SCHEMA.COLUMNS.SPOT_ASK]: data.spot_ask,
      [this.SCHEMA.COLUMNS.BUY_PREMIUM]: data.buy_premium,
      [this.SCHEMA.COLUMNS.SELL_PREMIUM]: data.sell_premium
    }));
    
    return await model.bulkCreate(records, { 
      ignoreDuplicates: true,
      validate: false 
    });
  }
  
  /**
   * Check if table exists
   */
  static async tableExists(companyName) {
    const tableName = `premium_${companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    
    const result = await sequelize.query(
      `SELECT to_regclass('public."${tableName}"') as exists`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    return result[0]?.exists !== null;
  }
  
  /**
   * Get all premium tables
   */
  static async getAllTables() {
    const result = await sequelize.query(
      `SELECT table_name FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name LIKE 'premium_%'
       ORDER BY table_name`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    
    return result.map(row => row.table_name);
  }
}

module.exports = PremiumDataFactory;