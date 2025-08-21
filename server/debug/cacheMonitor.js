const sequelize = require('../config/database');

/**
 * 🔍 Cache & Database Monitoring Tool
 * Helps identify cache staleness and API timeout issues
 */
class CacheMonitor {
    
    /**
     * Check last update times for all broker quote tables
     */
    static async checkTableUpdateTimes() {
        console.log('🔍 Checking all broker quote table update times...\n');
        
        try {
            // Get all quote tables
            const tables = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = current_database() 
                AND table_name LIKE '%_quotes'
                ORDER BY table_name
            `, {
                type: sequelize.QueryTypes.SELECT
            });

            const results = [];
            
            for (const table of tables) {
                const tableName = table.table_name;
                
                try {
                    // Get latest update time and count
                    const rows = await sequelize.query(`
                        SELECT 
                            COUNT(*) as total_rows,
                            MAX(updated_at) as last_update,
                            MIN(updated_at) as first_update,
                            EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))::integer as seconds_old
                        FROM "${tableName}"
                    `, {
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    const data = rows[0];
                    const broker = tableName.replace('_quotes', '');
                    
                    results.push({
                        broker,
                        tableName,
                        totalRows: data.total_rows,
                        lastUpdate: data.last_update,
                        firstUpdate: data.first_update,
                        secondsOld: data.seconds_old,
                        isStale: data.seconds_old > 30 // Consider stale if > 30 seconds
                    });
                    
                } catch (error) {
                    console.log(`❌ Error checking ${tableName}: ${error.message}`);
                }
            }
            
            // Sort by staleness (most stale first)
            results.sort((a, b) => b.secondsOld - a.secondsOld);
            
            console.log('📊 BROKER QUOTE TABLE STATUS:\n');
            console.log('Broker'.padEnd(20) + 'Last Update'.padEnd(25) + 'Age (seconds)'.padEnd(15) + 'Rows'.padEnd(10) + 'Status');
            console.log('-'.repeat(80));
            
            for (const result of results) {
                const status = result.isStale ? '🔴 STALE' : '✅ FRESH';
                const lastUpdate = result.lastUpdate ? 
                    new Date(result.lastUpdate).toLocaleString() : 
                    'No data';
                
                console.log(
                    result.broker.padEnd(20) + 
                    lastUpdate.padEnd(25) + 
                    result.secondsOld.toString().padEnd(15) + 
                    result.totalRows.toString().padEnd(10) + 
                    status
                );
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Error checking table update times:', error);
            throw error;
        }
    }

    /**
     * Monitor specific broker API health
     */
    static async checkBrokerAPIHealth(brokerList = []) {
        console.log('\n🏥 Checking Broker API Health...\n');
        
        if (brokerList.length === 0) {
            // Get all active brokers from database
            const brokers = await sequelize.query(`
                SELECT DISTINCT broker_name as broker 
                FROM broker_accounts 
                WHERE status = 'active'
            `, {
                type: sequelize.QueryTypes.SELECT
            });
            brokerList = brokers.map(b => b.broker);
        }
        
        for (const broker of brokerList) {
            console.log(`🔍 Testing ${broker}...`);
            
            try {
                // Check recent API call success rate
                const apiLogs = await sequelize.query(`
                    SELECT 
                        COUNT(*) as total_calls,
                        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_calls,
                        SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_calls,
                        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_calls,
                        MAX(created_at) as last_call
                    FROM api_call_logs 
                    WHERE broker_name = :broker 
                    AND created_at >= NOW() - INTERVAL '1 hour'
                `, {
                    replacements: { broker },
                    type: sequelize.QueryTypes.SELECT
                });
                
                const stats = apiLogs[0];
                const successRate = stats.total_calls > 0 ? 
                    ((stats.successful_calls / stats.total_calls) * 100).toFixed(1) : 
                    'N/A';
                
                console.log(`  📈 Success Rate: ${successRate}% (${stats.successful_calls}/${stats.total_calls})`);
                console.log(`  ⏰ Timeouts: ${stats.timeout_calls}`);
                console.log(`  ❌ Errors: ${stats.error_calls}`);
                console.log(`  🕐 Last Call: ${stats.last_call ? new Date(stats.last_call).toLocaleString() : 'Never'}`);
                
                // Check if this broker is causing issues
                if (stats.timeout_calls > 5) {
                    console.log(`  🚨 HIGH TIMEOUT COUNT for ${broker}!`);
                }
                
                if (successRate < 80 && stats.total_calls > 5) {
                    console.log(`  ⚠️  LOW SUCCESS RATE for ${broker}!`);
                }
                
            } catch (error) {
                console.log(`  ❌ Error checking ${broker}: ${error.message}`);
            }
            
            console.log('');
        }
    }

    /**
     * Check cache freshness across all symbols
     */
    static async checkCacheFreshness() {
        console.log('\n💾 Cache Freshness Report...\n');
        
        try {
            const symbolsCache = await sequelize.query(`
                SELECT 
                    broker_name,
                    terminal_type,
                    symbols_count,
                    last_updated,
                    EXTRACT(EPOCH FROM (NOW() - last_updated))/60 as minutes_old
                FROM broker_symbols_cache
                ORDER BY last_updated DESC
            `, {
                type: sequelize.QueryTypes.SELECT
            });
            
            console.log('Broker'.padEnd(20) + 'Terminal'.padEnd(10) + 'Symbols'.padEnd(10) + 'Age (min)'.padEnd(12) + 'Status');
            console.log('-'.repeat(65));
            
            for (const cache of symbolsCache) {
                const status = cache.minutes_old > 60 ? '🔴 OLD' : 
                             cache.minutes_old > 30 ? '🟡 AGING' : '✅ FRESH';
                
                console.log(
                    cache.broker_name.padEnd(20) + 
                    cache.terminal_type.padEnd(10) + 
                    cache.symbols_count.toString().padEnd(10) + 
                    cache.minutes_old.toString().padEnd(12) + 
                    status
                );
            }
            
        } catch (error) {
            console.error('❌ Error checking cache freshness:', error);
        }
    }

    /**
     * Find problematic broker-symbol combinations
     */
    static async findProblematicQuotes() {
        console.log('\n🔍 Finding Problematic Quotes...\n');
        
        try {
            // Find symbols that haven't been updated recently across all brokers
            const tables = await sequelize.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = current_database() 
                AND table_name LIKE '%_quotes'
            `, {
                type: sequelize.QueryTypes.SELECT
            });

            const problems = [];

            for (const table of tables) {
                const tableName = table.table_name;
                const broker = tableName.replace('_quotes', '');
                
                try {
                    const staleQuotes = await sequelize.query(`
                        SELECT 
                            symbol,
                            bid,
                            ask,
                            updated_at,
                            EXTRACT(EPOCH FROM (NOW() - updated_at))::integer as seconds_old
                        FROM "${tableName}"
                        WHERE EXTRACT(EPOCH FROM (NOW() - updated_at)) > 60
                        ORDER BY updated_at ASC
                        LIMIT 10
                    `, {
                        type: sequelize.QueryTypes.SELECT
                    });
                    
                    if (staleQuotes.length > 0) {
                        problems.push({
                            broker,
                            staleCount: staleQuotes.length,
                            staleQuotes
                        });
                    }
                    
                } catch (error) {
                    console.log(`❌ Error checking ${tableName}: ${error.message}`);
                }
            }

            if (problems.length > 0) {
                console.log('🚨 PROBLEMATIC BROKERS:\n');
                
                for (const problem of problems) {
                    console.log(`❌ ${problem.broker} - ${problem.staleCount} stale quotes:`);
                    
                    for (const quote of problem.staleQuotes) {
                        console.log(`  📊 ${quote.symbol}: ${quote.seconds_old}s old (${new Date(quote.updated_at).toLocaleString()})`);
                    }
                    console.log('');
                }
            } else {
                console.log('✅ No problematic quotes found!');
            }
            
        } catch (error) {
            console.error('❌ Error finding problematic quotes:', error);
        }
    }

    /**
     * Run complete diagnostic
     */
    static async runCompleteCheck() {
        console.log('🚀 FluxNetwork Cache & API Health Monitor\n');
        console.log('=' .repeat(80));
        
        try {
            await this.checkTableUpdateTimes();
            await this.checkCacheFreshness();
            await this.findProblematicQuotes();
            await this.checkBrokerAPIHealth();
            
            console.log('\n✅ Complete diagnostic finished!');
            console.log('\n💡 Tips:');
            console.log('- Tables with >30s age need attention');
            console.log('- Check external API endpoints for brokers with high timeouts');
            console.log('- Consider increasing cache tolerance for slow brokers');
            
        } catch (error) {
            console.error('❌ Diagnostic failed:', error);
        }
    }
}

module.exports = CacheMonitor;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'complete';
    
    (async () => {
        switch (command) {
            case 'tables':
                await CacheMonitor.checkTableUpdateTimes();
                break;
            case 'cache':
                await CacheMonitor.checkCacheFreshness();
                break;
            case 'problems':
                await CacheMonitor.findProblematicQuotes();
                break;
            case 'api':
                const brokers = args.slice(1);
                await CacheMonitor.checkBrokerAPIHealth(brokers);
                break;
            case 'complete':
            default:
                await CacheMonitor.runCompleteCheck();
                break;
        }
        process.exit(0);
    })();
}