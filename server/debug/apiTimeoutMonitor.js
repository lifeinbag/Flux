const sequelize = require('../config/database');
const axios = require('axios');

/**
 * 🚨 API Timeout & Health Monitor
 * Identifies brokers causing timeout issues and API failures
 */
class ApiTimeoutMonitor {
    
    /**
     * Create API call logs table if it doesn't exist
     */
    static async ensureApiLogTable() {
        try {
            await sequelize.query(`
                CREATE TABLE IF NOT EXISTS api_call_logs (
                    id SERIAL PRIMARY KEY,
                    broker_name VARCHAR(100) NOT NULL,
                    account_id VARCHAR(100),
                    endpoint VARCHAR(255) NOT NULL,
                    method VARCHAR(10) DEFAULT 'GET',
                    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'timeout', 'error', 'failed')),
                    response_time_ms INTEGER,
                    error_message TEXT,
                    request_payload JSONB,
                    response_size INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            await sequelize.query(`
                CREATE INDEX IF NOT EXISTS idx_broker_status ON api_call_logs (broker_name, status);
                CREATE INDEX IF NOT EXISTS idx_created_at ON api_call_logs (created_at);
                CREATE INDEX IF NOT EXISTS idx_response_time ON api_call_logs (response_time_ms);
            `);
            
            console.log('✅ API call logs table ready');
        } catch (error) {
            console.error('❌ Failed to create API logs table:', error.message);
        }
    }

    /**
     * Log API call result
     */
    static async logApiCall(brokerName, accountId, endpoint, method, status, responseTimeMs, errorMessage = null, requestPayload = null, responseSize = 0) {
        try {
            await sequelize.query(`
                INSERT INTO api_call_logs 
                (broker_name, account_id, endpoint, method, status, response_time_ms, error_message, request_payload, response_size)
                VALUES (:brokerName, :accountId, :endpoint, :method, :status, :responseTimeMs, :errorMessage, :requestPayload, :responseSize)
            `, {
                replacements: {
                    brokerName, accountId, endpoint, method, status, responseTimeMs, errorMessage, 
                    requestPayload: JSON.stringify(requestPayload), responseSize
                }
            });
        } catch (error) {
            console.error('Failed to log API call:', error.message);
        }
    }

    /**
     * Get timeout statistics for all brokers
     */
    static async getTimeoutStats(hoursBack = 24) {
        try {
            const results = await sequelize.query(`
                SELECT 
                    broker_name,
                    COUNT(*) as total_calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_calls,
                    SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) as timeout_calls,
                    SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_calls,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_calls,
                    AVG(CASE WHEN status = 'success' THEN response_time_ms END) as avg_response_time,
                    MAX(CASE WHEN status = 'success' THEN response_time_ms END) as max_response_time,
                    MIN(created_at) as first_call,
                    MAX(created_at) as last_call
                FROM api_call_logs 
                WHERE created_at >= NOW() - INTERVAL '1 hour' * :hoursBack
                GROUP BY broker_name
                ORDER BY timeout_calls DESC, error_calls DESC
            `, {
                replacements: { hoursBack },
                type: sequelize.QueryTypes.SELECT
            });

            return results.map(row => ({
                ...row,
                successRate: row.total_calls > 0 ? (row.successful_calls / row.total_calls * 100).toFixed(1) : '0',
                timeoutRate: row.total_calls > 0 ? (row.timeout_calls / row.total_calls * 100).toFixed(1) : '0',
                errorRate: row.total_calls > 0 ? (row.error_calls / row.total_calls * 100).toFixed(1) : '0'
            }));
            
        } catch (error) {
            console.error('❌ Failed to get timeout stats:', error.message);
            return [];
        }
    }

    /**
     * Get recent timeout errors with details
     */
    static async getRecentTimeouts(limit = 50) {
        try {
            const results = await sequelize.query(`
                SELECT 
                    broker_name,
                    account_id,
                    endpoint,
                    method,
                    status,
                    response_time_ms,
                    error_message,
                    created_at
                FROM api_call_logs 
                WHERE status IN ('timeout', 'error', 'failed')
                ORDER BY created_at DESC
                LIMIT :limit
            `, {
                replacements: { limit },
                type: sequelize.QueryTypes.SELECT
            });

            return results;
        } catch (error) {
            console.error('❌ Failed to get recent timeouts:', error.message);
            return [];
        }
    }

    /**
     * Test broker API endpoints directly
     */
    static async testBrokerEndpoints(brokerList = []) {
        console.log('🔍 Testing Broker API Endpoints...\n');
        
        // Get broker configurations from database
        let query = `
            SELECT DISTINCT 
                ba.broker_name,
                ba.account_number,
                ba.server_ip,
                ba.terminal_type,
                ba.status as account_status
            FROM broker_accounts ba
            WHERE ba.status = 'active'
        `;
        
        let replacements = {};
        if (brokerList.length > 0) {
            query += ` AND ba.broker_name IN (:brokerList)`;
            replacements.brokerList = brokerList;
        }
        
        query += ` ORDER BY ba.broker_name`;
        
        const brokers = await sequelize.query(query, {
            replacements,
            type: sequelize.QueryTypes.SELECT
        });

        const results = [];

        for (const broker of brokers) {
            console.log(`🔍 Testing ${broker.broker_name} (${broker.account_number})...`);
            
            const testStart = Date.now();
            let testResult = {
                broker: broker.broker_name,
                account: broker.account_number,
                server: broker.server_ip,
                terminal: broker.terminal_type,
                tests: []
            };

            // Test basic connectivity
            try {
                const pingResult = await this.testEndpoint(
                    `http://${broker.server_ip}:8080/health`,
                    'GET',
                    null,
                    5000
                );
                testResult.tests.push({
                    name: 'Health Check',
                    ...pingResult
                });
            } catch (error) {
                testResult.tests.push({
                    name: 'Health Check',
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - testStart
                });
            }

            // Test quotes endpoint
            try {
                const quotesResult = await this.testEndpoint(
                    `http://${broker.server_ip}:8080/quotes/EURUSD`,
                    'GET',
                    null,
                    10000
                );
                testResult.tests.push({
                    name: 'Quotes API',
                    ...quotesResult
                });
            } catch (error) {
                testResult.tests.push({
                    name: 'Quotes API',
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - testStart
                });
            }

            // Test symbols endpoint
            try {
                const symbolsResult = await this.testEndpoint(
                    `http://${broker.server_ip}:8080/symbols`,
                    'GET',
                    null,
                    15000
                );
                testResult.tests.push({
                    name: 'Symbols API',
                    ...symbolsResult
                });
            } catch (error) {
                testResult.tests.push({
                    name: 'Symbols API',
                    success: false,
                    error: error.message,
                    responseTime: Date.now() - testStart
                });
            }

            results.push(testResult);

            // Display results
            for (const test of testResult.tests) {
                const status = test.success ? '✅' : '❌';
                const time = test.responseTime ? `${test.responseTime}ms` : 'N/A';
                console.log(`  ${status} ${test.name}: ${time}`);
                
                if (!test.success) {
                    console.log(`    Error: ${test.error || 'Unknown error'}`);
                }
            }
            console.log('');
        }

        return results;
    }

    /**
     * Test a single endpoint
     */
    static async testEndpoint(url, method = 'GET', data = null, timeoutMs = 10000) {
        const startTime = Date.now();
        
        try {
            const config = {
                method,
                url,
                timeout: timeoutMs,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);
            const responseTime = Date.now() - startTime;

            return {
                success: true,
                responseTime,
                statusCode: response.status,
                dataSize: JSON.stringify(response.data).length
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            let errorType = 'unknown';
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                errorType = 'timeout';
            } else if (error.code === 'ECONNREFUSED') {
                errorType = 'connection_refused';
            } else if (error.code === 'ENOTFOUND') {
                errorType = 'dns_error';
            }

            return {
                success: false,
                responseTime,
                error: error.message,
                errorType,
                statusCode: error.response?.status || null
            };
        }
    }

    /**
     * Generate comprehensive timeout report
     */
    static async generateTimeoutReport() {
        console.log('📊 FluxNetwork API Timeout Report\n');
        console.log('=' .repeat(80));
        
        await this.ensureApiLogTable();

        // Get timeout statistics
        console.log('\n🚨 BROKER TIMEOUT STATISTICS (Last 24h):\n');
        const stats = await this.getTimeoutStats(24);
        
        if (stats.length > 0) {
            console.log('Broker'.padEnd(20) + 'Success%'.padEnd(10) + 'Timeouts'.padEnd(10) + 'Errors'.padEnd(10) + 'Avg Time'.padEnd(12) + 'Status');
            console.log('-'.repeat(85));
            
            for (const stat of stats) {
                const status = stat.successRate > 90 ? '✅ Good' : 
                              stat.successRate > 70 ? '⚠️  Warning' : '🚨 Critical';
                
                console.log(
                    stat.broker_name.padEnd(20) + 
                    `${stat.successRate}%`.padEnd(10) + 
                    stat.timeout_calls.toString().padEnd(10) + 
                    stat.error_calls.toString().padEnd(10) + 
                    `${Math.round(stat.avg_response_time || 0)}ms`.padEnd(12) + 
                    status
                );
            }
        } else {
            console.log('No API call data available. API logging may not be enabled.');
        }

        // Get recent timeout details
        console.log('\n🔍 RECENT TIMEOUT DETAILS:\n');
        const recentTimeouts = await this.getRecentTimeouts(20);
        
        if (recentTimeouts.length > 0) {
            for (const timeout of recentTimeouts) {
                const time = new Date(timeout.created_at).toLocaleString();
                console.log(`❌ ${timeout.broker_name} (${timeout.account_id}) - ${timeout.endpoint}`);
                console.log(`   Status: ${timeout.status} | Time: ${time}`);
                if (timeout.error_message) {
                    console.log(`   Error: ${timeout.error_message}`);
                }
                console.log('');
            }
        } else {
            console.log('No recent timeouts found.');
        }

        // Test broker endpoints
        console.log('\n🔬 LIVE ENDPOINT TESTING:\n');
        await this.testBrokerEndpoints();

        console.log('\n✅ Timeout report complete!');
        console.log('\n💡 Recommendations:');
        console.log('- Brokers with <70% success rate need immediate attention');
        console.log('- Check network connectivity to broker servers');
        console.log('- Consider increasing timeout values for slow brokers');
        console.log('- Monitor server resource usage during peak times');
    }

    /**
     * Monitor specific broker for issues
     */
    static async monitorBroker(brokerName, durationMinutes = 5) {
        console.log(`🔍 Monitoring ${brokerName} for ${durationMinutes} minutes...\n`);
        
        const endTime = Date.now() + (durationMinutes * 60 * 1000);
        const results = [];
        
        while (Date.now() < endTime) {
            const testResult = await this.testBrokerEndpoints([brokerName]);
            
            if (testResult.length > 0) {
                const broker = testResult[0];
                const timestamp = new Date().toLocaleString();
                
                console.log(`[${timestamp}] Testing ${brokerName}...`);
                
                for (const test of broker.tests) {
                    const status = test.success ? '✅' : '❌';
                    console.log(`  ${status} ${test.name}: ${test.responseTime}ms`);
                    
                    results.push({
                        timestamp: new Date(),
                        test: test.name,
                        success: test.success,
                        responseTime: test.responseTime,
                        error: test.error
                    });
                }
                
                console.log('');
            }
            
            // Wait 30 seconds before next test
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
        
        // Generate summary
        console.log('\n📊 MONITORING SUMMARY:\n');
        
        const testNames = [...new Set(results.map(r => r.test))];
        for (const testName of testNames) {
            const testResults = results.filter(r => r.test === testName);
            const successCount = testResults.filter(r => r.success).length;
            const avgTime = testResults.reduce((sum, r) => sum + r.responseTime, 0) / testResults.length;
            
            console.log(`${testName}:`);
            console.log(`  Success Rate: ${(successCount / testResults.length * 100).toFixed(1)}%`);
            console.log(`  Average Time: ${Math.round(avgTime)}ms`);
            console.log('');
        }
    }
}

module.exports = ApiTimeoutMonitor;

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0] || 'report';
    
    (async () => {
        switch (command) {
            case 'report':
                await ApiTimeoutMonitor.generateTimeoutReport();
                break;
            case 'test':
                const brokers = args.slice(1);
                await ApiTimeoutMonitor.testBrokerEndpoints(brokers);
                break;
            case 'monitor':
                const brokerName = args[1];
                const minutes = parseInt(args[2]) || 5;
                if (!brokerName) {
                    console.log('Usage: node apiTimeoutMonitor.js monitor <broker_name> [minutes]');
                    process.exit(1);
                }
                await ApiTimeoutMonitor.monitorBroker(brokerName, minutes);
                break;
            default:
                console.log('Usage: node apiTimeoutMonitor.js [report|test|monitor]');
                break;
        }
        process.exit(0);
    })();
}