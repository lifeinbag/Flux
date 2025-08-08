// server/utils/intelligentBrokerNormalizer.js

const sequelize = require('../config/database');
const logger = require('./logger');

class IntelligentBrokerNormalizer {
  constructor() {
    this.knownBrokers = new Map(); // Cache for known broker patterns
    this.initializeDatabase();
  }

  /**
   * Initialize the broker_mappings table for storing learned patterns
   */
  async initializeDatabase() {
    try {
      await sequelize.query(`
        CREATE TABLE IF NOT EXISTS broker_mappings (
          id SERIAL PRIMARY KEY,
          user_input VARCHAR(255) NOT NULL,
          normalized_name VARCHAR(100) NOT NULL,
          confidence_score DECIMAL(3,2) DEFAULT 0.00,
          server_pattern VARCHAR(255),
          company_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          usage_count INTEGER DEFAULT 1
        )
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_broker_mappings_user_input 
        ON broker_mappings (user_input)
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_broker_mappings_normalized 
        ON broker_mappings (normalized_name)
      `);

      // Load existing mappings into cache
      await this.loadKnownMappings();
      
      logger.info('✅ Intelligent broker normalizer initialized');
    } catch (err) {
      logger.error('Failed to initialize broker mappings table', err.message);
    }
  }

  /**
   * Load existing broker mappings from database into memory cache
   */
  async loadKnownMappings() {
    try {
      const [results] = await sequelize.query(`
        SELECT user_input, normalized_name, confidence_score, server_pattern, company_name
        FROM broker_mappings 
        WHERE confidence_score >= 0.7
        ORDER BY usage_count DESC, confidence_score DESC
      `);

      results.forEach(row => {
        this.knownBrokers.set(row.user_input.toLowerCase(), {
          normalized: row.normalized_name,
          confidence: parseFloat(row.confidence_score),
          serverPattern: row.server_pattern,
          companyName: row.company_name
        });
      });

      logger.info(`📚 Loaded ${results.length} known broker mappings into cache`);
    } catch (err) {
      logger.error('Failed to load known broker mappings', err.message);
    }
  }

  /**
   * MAIN NORMALIZATION FUNCTION
   * Intelligently normalizes broker name using multiple detection methods
   */
  async normalizeBrokerName(userInput, serverName = null, companyName = null) {
    if (!userInput || typeof userInput !== 'string') {
      return 'unknown';
    }

    const cleanInput = userInput.toLowerCase().trim();
    
    // 1. Check cache first (fastest)
    if (this.knownBrokers.has(cleanInput)) {
      const cached = this.knownBrokers.get(cleanInput);
      logger.info(`🎯 Found cached mapping: "${userInput}" → "${cached.normalized}" (confidence: ${cached.confidence})`);
      await this.incrementUsageCount(cleanInput);
      return cached.normalized;
    }

    // 2. Try intelligent detection
    const detected = await this.detectBrokerName(userInput, serverName, companyName);
    
    // 3. Save the new mapping for future use
    await this.saveBrokerMapping(userInput, detected.normalized, detected.confidence, serverName, companyName);
    
    return detected.normalized;
  }

  /**
   * Intelligent broker detection using multiple methods
   */
  async detectBrokerName(userInput, serverName = null, companyName = null) {
    const cleanInput = userInput.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Method 1: Server name analysis (highest confidence)
    if (serverName) {
      const serverDetection = this.detectFromServer(serverName);
      if (serverDetection.confidence > 0.8) {
        logger.info(`🔍 Detected from server "${serverName}": ${serverDetection.normalized}`);
        return serverDetection;
      }
    }

    // Method 2: Company name analysis
    if (companyName) {
      const companyDetection = this.detectFromCompany(companyName);
      if (companyDetection.confidence > 0.7) {
        logger.info(`🏢 Detected from company "${companyName}": ${companyDetection.normalized}`);
        return companyDetection;
      }
    }

    // Method 3: Fuzzy matching with existing patterns
    const fuzzyMatch = await this.fuzzyMatchExisting(cleanInput);
    if (fuzzyMatch.confidence > 0.6) {
      logger.info(`🔄 Fuzzy matched "${userInput}": ${fuzzyMatch.normalized}`);
      return fuzzyMatch;
    }

    // Method 4: Pattern-based extraction
    const patternDetection = this.detectFromPatterns(cleanInput);
    if (patternDetection.confidence > 0.5) {
      logger.info(`📋 Pattern detected "${userInput}": ${patternDetection.normalized}`);
      return patternDetection;
    }

    // Method 5: Length-based heuristics
    const heuristicDetection = this.detectFromHeuristics(cleanInput);
    logger.warn(`⚠️ Using heuristic detection for "${userInput}": ${heuristicDetection.normalized}`);
    return heuristicDetection;
  }

  /**
   * Detect broker from server name (most reliable method)
   */
  detectFromServer(serverName) {
    const server = serverName.toLowerCase();
    
    // Extract core broker name from server
    const patterns = [
      { pattern: /octafx/i, name: 'octafx', confidence: 0.95 },
      { pattern: /icmarkets?/i, name: 'icmarkets', confidence: 0.95 },
      { pattern: /multibank/i, name: 'multibank', confidence: 0.95 },
      { pattern: /vpfx|vantage/i, name: 'vpfx', confidence: 0.90 },
      { pattern: /xm(?:global|group)?/i, name: 'xm', confidence: 0.95 },
      { pattern: /fxpro/i, name: 'fxpro', confidence: 0.95 },
      { pattern: /pepperstone/i, name: 'pepperstone', confidence: 0.95 },
      { pattern: /admirals?/i, name: 'admirals', confidence: 0.95 },
      { pattern: /avatrade/i, name: 'avatrade', confidence: 0.95 },
      { pattern: /exness/i, name: 'exness', confidence: 0.95 },
    ];

    for (const { pattern, name, confidence } of patterns) {
      if (pattern.test(server)) {
        return { normalized: name, confidence };
      }
    }

    // Extract first meaningful part
    const extracted = server.split(/[.-]/)[0].replace(/(demo|real|live|server|mt[45])$/gi, '');
    if (extracted.length >= 3) {
      return { normalized: extracted, confidence: 0.7 };
    }

    return { normalized: server.substring(0, 10), confidence: 0.4 };
  }

  /**
   * Detect broker from company name
   */
  detectFromCompany(companyName) {
    const company = companyName.toLowerCase();
    
    if (company.includes('octafx')) return { normalized: 'octafx', confidence: 0.9 };
    if (company.includes('ic') && company.includes('market')) return { normalized: 'icmarkets', confidence: 0.9 };
    if (company.includes('multibank')) return { normalized: 'multibank', confidence: 0.9 };
    if (company.includes('vpfx') || company.includes('vantage')) return { normalized: 'vpfx', confidence: 0.85 };
    if (company.includes('xm')) return { normalized: 'xm', confidence: 0.9 };
    if (company.includes('fxpro')) return { normalized: 'fxpro', confidence: 0.9 };
    
    // Extract main word from company name
    const words = company.split(/\s+/).filter(word => word.length > 3);
    if (words.length > 0) {
      return { normalized: words[0], confidence: 0.6 };
    }

    return { normalized: company.substring(0, 10), confidence: 0.4 };
  }

  /**
   * Fuzzy matching with existing broker names
   */
  async fuzzyMatchExisting(cleanInput) {
    try {
      const [results] = await sequelize.query(`
        SELECT normalized_name, 
               CASE 
                 WHEN user_input = :input THEN 1.0
                 WHEN user_input LIKE :inputPattern THEN 0.8
                 WHEN :input LIKE CONCAT('%', user_input, '%') THEN 0.7
                 ELSE (1.0 - (LENGTH(:input) - LENGTH(user_input)) * 0.1)
               END as similarity_score
        FROM broker_mappings 
        WHERE user_input LIKE :fuzzyPattern 
           OR :input LIKE CONCAT('%', user_input, '%')
           OR user_input LIKE CONCAT('%', :partialInput, '%')
        ORDER BY similarity_score DESC, usage_count DESC
        LIMIT 1
      `, {
        replacements: {
          input: cleanInput,
          inputPattern: `${cleanInput}%`,
          fuzzyPattern: `%${cleanInput}%`,
          partialInput: cleanInput.substring(0, Math.min(5, cleanInput.length))
        }
      });

      if (results.length > 0 && results[0].similarity_score > 0.6) {
        return {
          normalized: results[0].normalized_name,
          confidence: parseFloat(results[0].similarity_score)
        };
      }
    } catch (err) {
      logger.error('Error in fuzzy matching', err.message);
    }

    return { normalized: cleanInput, confidence: 0.3 };
  }

  /**
   * Pattern-based detection using common broker naming patterns
   */
  detectFromPatterns(cleanInput) {
    // Remove common suffixes and prefixes
    let processed = cleanInput
      .replace(/^(broker|fx|mt[45])/g, '')
      .replace(/(demo|live|real|server|mt[45]|group|global|ltd|llc)$/g, '')
      .trim();

    // Common broker abbreviations
    const abbreviations = {
      'ic': 'icmarkets',
      'octa': 'octafx',
      'xm': 'xm',
      'multi': 'multibank',
      'vpfx': 'vpfx',
      'fxpro': 'fxpro'
    };

    if (abbreviations[processed]) {
      return { normalized: abbreviations[processed], confidence: 0.8 };
    }

    // If still long enough, use as is
    if (processed.length >= 3) {
      return { normalized: processed, confidence: 0.6 };
    }

    return { normalized: cleanInput, confidence: 0.4 };
  }

  /**
   * Length and character-based heuristics (fallback)
   */
  detectFromHeuristics(cleanInput) {
    // Very short inputs - likely abbreviations
    if (cleanInput.length <= 3) {
      return { normalized: cleanInput, confidence: 0.3 };
    }

    // Medium length - likely good broker name
    if (cleanInput.length >= 4 && cleanInput.length <= 12) {
      return { normalized: cleanInput, confidence: 0.5 };
    }

    // Long inputs - truncate to reasonable length
    const truncated = cleanInput.substring(0, 10);
    return { normalized: truncated, confidence: 0.4 };
  }

  /**
   * Save broker mapping to database for future learning
   */
  async saveBrokerMapping(userInput, normalizedName, confidence, serverName = null, companyName = null) {
    try {
      const cleanInput = userInput.toLowerCase().trim();
      
      // Check if mapping already exists
      const [existing] = await sequelize.query(`
        SELECT id FROM broker_mappings WHERE user_input = :input
      `, {
        replacements: { input: cleanInput }
      });

      if (existing.length > 0) {
        // Update existing mapping
        await sequelize.query(`
          UPDATE broker_mappings 
          SET usage_count = usage_count + 1,
              confidence_score = GREATEST(confidence_score, :confidence),
              updated_at = CURRENT_TIMESTAMP
          WHERE user_input = :input
        `, {
          replacements: { input: cleanInput, confidence }
        });
      } else {
        // Insert new mapping
        await sequelize.query(`
          INSERT INTO broker_mappings 
          (user_input, normalized_name, confidence_score, server_pattern, company_name)
          VALUES (:input, :normalized, :confidence, :server, :company)
        `, {
          replacements: {
            input: cleanInput,
            normalized: normalizedName,
            confidence,
            server: serverName,
            company: companyName
          }
        });
      }

      // Update cache
      this.knownBrokers.set(cleanInput, {
        normalized: normalizedName,
        confidence,
        serverPattern: serverName,
        companyName: companyName
      });

      logger.info(`💾 Saved broker mapping: "${userInput}" → "${normalizedName}" (confidence: ${confidence})`);
    } catch (err) {
      logger.error('Failed to save broker mapping', err.message);
    }
  }

  /**
   * Increment usage count for existing mapping
   */
  async incrementUsageCount(userInput) {
    try {
      await sequelize.query(`
        UPDATE broker_mappings 
        SET usage_count = usage_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_input = :input
      `, {
        replacements: { input: userInput }
      });
    } catch (err) {
      logger.error('Failed to increment usage count', err.message);
    }
  }

  /**
   * Get broker mapping statistics for admin dashboard
   */
  async getBrokerStats() {
    try {
      const [results] = await sequelize.query(`
        SELECT 
          normalized_name,
          COUNT(*) as variation_count,
          AVG(confidence_score) as avg_confidence,
          SUM(usage_count) as total_usage,
          array_agg(user_input ORDER BY usage_count DESC) as variations
        FROM broker_mappings 
        GROUP BY normalized_name
        ORDER BY total_usage DESC
      `);

      return results;
    } catch (err) {
      logger.error('Failed to get broker stats', err.message);
      return [];
    }
  }

  /**
   * Clean up low-confidence or unused mappings
   */
  async cleanupMappings() {
    try {
      const [deleted] = await sequelize.query(`
        DELETE FROM broker_mappings 
        WHERE confidence_score < 0.3 
           OR (usage_count = 1 AND created_at < NOW() - INTERVAL '30 days')
        RETURNING id
      `);

      logger.info(`🧹 Cleaned up ${deleted.length} low-quality broker mappings`);
      await this.loadKnownMappings(); // Reload cache
    } catch (err) {
      logger.error('Failed to cleanup broker mappings', err.message);
    }
  }

  /**
   * Manually add or update a broker mapping (for admin use)
   */
  async addManualMapping(userInput, normalizedName, confidence = 1.0) {
    await this.saveBrokerMapping(userInput, normalizedName, confidence, null, null);
    logger.info(`➕ Manually added mapping: "${userInput}" → "${normalizedName}"`);
  }
}

module.exports = new IntelligentBrokerNormalizer();