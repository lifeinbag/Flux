# 🔧 FLUX NETWORK - STRUCTURED LOGGING SYSTEM

## 📊 Overview

The new structured logging system provides:
- **Clean Console Display**: Organized broker status with console.table
- **Error Tracking**: Specific error logging for brokers/accounts
- **Noise Filtering**: Suppress verbose logs while preserving critical information
- **Real-time Monitoring**: Live status updates every 30 seconds

## 🚀 Quick Start

The system starts automatically when the server launches. You'll see:

```
🚀 FLUX NETWORK - CLEAN LOGGING ENVIRONMENT ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Status display: ENABLED (organized broker status)
🔇 Verbose logging: DISABLED (filtered noise)
❌ Error logging: ALWAYS ENABLED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 📋 Status Display Format

Every 30 seconds, you'll see a clean table like this:

```
🌐 FLUX NETWORK - BROKER STATUS MONITOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Last Updated: 21/08/2025, 3:45:30 PM

┌─────────┬────────────────┬─────────────┬──────────┬─────────────┬─────────────┬──────────────┬───────────────┬──────────────┬─────────────┐
│ (index) │ Account Set    │ Broker      │ Account  │ Terminal     │ Status      │ Token       │ Last Quote   │ Last Balance │ Last Orders │
├─────────┼────────────────┼─────────────┼──────────┼─────────────┼─────────────┼─────────────┼──────────────┼───────────────┼──────────────┤
│ 0       │ 'Gold Scalp'   │ 'ICMarkets' │ '2011491'│ 'MT5'       │ '✅ Active' │ '✅ Valid'  │ '3:45:29 PM' │ '3:45:28 PM' │ '3:45:30 PM'│
│ 1       │ 'Gold Scalp'   │ 'PepperStone│ '2987654'│ 'MT4'       │ '❌ Quote'  │ '❌ Failed' │ 'Never'      │ '3:44:15 PM' │ 'Never'     │
└─────────┴────────────────┴─────────────┴──────────┴─────────────┴─────────────┴─────────────┴──────────────┴───────────────┴──────────────┘

🚨 RECENT CRITICAL ERRORS (Last 5):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────┬─────────────┬────────────────┬─────────────┬──────────┬────────────┬──────────────────────────────────────────────────────┐
│ (index) │ Time        │ Account Set    │ Broker      │ Account  │ Error Type │ Error                                                │
├─────────┼─────────────┼────────────────┼─────────────┼──────────┼────────────┼──────────────────────────────────────────────────────┤
│ 0       │ '3:45:25 PM'│ 'Gold Scalp'   │ 'PepperStone│ '2987654'│ 'Token'    │ 'authorization failed - invalid credentials'        │
└─────────┴─────────────┴────────────────┴─────────────┴──────────┴────────────┴──────────────────────────────────────────────────────┘
```

## 🎯 Status Indicators

### Account Status:
- ✅ **Active**: All systems working normally
- ❌ **Quote**: Quote fetching issues
- ❌ **Balance**: Balance/equity fetching issues  
- ❌ **Token**: Authentication/token issues
- ⚠️ **Unknown**: No recent data

### Token Status:
- ✅ **Valid**: Token is active and working
- ❌ **Failed**: Token expired or invalid
- ⚠️ **Unknown**: Token status not checked recently

## 🎛️ Control Commands

### Toggle Verbose Logging:
```bash
# To see all logs (including filtered ones)
curl -X POST http://localhost:3001/api/premium/logging/toggle-verbose

# Or in Node.js console:
logLevelController.toggleVerboseLogging()
```

### Toggle Status Display:
```bash
# To enable/disable the organized status table
curl -X POST http://localhost:3001/api/premium/logging/toggle-status

# Or in Node.js console:
logLevelController.toggleStatusDisplay()
```

### Check Current Settings:
```bash
curl http://localhost:3001/api/premium/logging/settings
```

### View Suppressed Messages:
```bash
# See what logs were filtered out
curl http://localhost:3001/api/premium/logging/suppressed?limit=20

# Or in Node.js console:
logLevelController.getSuppressedMessages(20)
```

## 🔍 Error Types & Troubleshooting

### Common Error Types:

1. **Token**: Authentication issues
   - Check broker credentials
   - Verify server connection
   - May need manual token refresh

2. **Quote**: Price data issues  
   - Symbol may not exist on broker
   - Market may be closed
   - Network connectivity issues

3. **Balance**: Account data issues
   - Account may be restricted
   - Server connection problems
   - Insufficient permissions

4. **Orders**: Order placement/monitoring issues
   - Trading permissions
   - Market conditions
   - Position limits

## 📊 API Endpoints

### Get Broker Status:
```
GET /api/premium/status/brokers
```

### Control Logging:
```
POST /api/premium/logging/toggle-verbose    # Toggle verbose logging
POST /api/premium/logging/toggle-status     # Toggle status display
GET  /api/premium/logging/settings          # Get current settings
GET  /api/premium/logging/suppressed        # Get filtered messages
```

## 🔄 Manual Control

In the Node.js console, you can use:

```javascript
// Toggle verbose logging
const verbose = logLevelController.toggleVerboseLogging();

// Get current status
const settings = logLevelController.getSettings();

// View filtered messages
const suppressed = logLevelController.getSuppressedMessages();

// Get broker status
const status = brokerStatusLogger.getStatusSummary();

// Clear suppressed messages
logLevelController.clearSuppressedMessages();
```

## 🎯 Benefits

1. **Clear Error Identification**: Instantly see which broker/account has issues
2. **Reduced Noise**: Focus on important information, not verbose logs
3. **Historical Tracking**: Keep track of recent errors and patterns
4. **Easy Debugging**: Quickly identify token, quote, or balance issues
5. **Production Ready**: Clean display suitable for production monitoring

## 💡 Tips

- **Red Status**: Immediate attention needed
- **Green Status**: Working normally  
- **Never Timestamps**: Indicates service hasn't tried that operation yet
- **Recent Timestamps**: Shows active monitoring
- **Error Table**: Focus on repeated errors for the same broker/account

The system automatically starts with clean logging. Use verbose mode only when debugging specific issues.