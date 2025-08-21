# FluxNetwork Quick Reference Card

## 🚀 Most Common Tasks

### Need Symbols? Use This:
```javascript
import symbolsCache from '../services/symbolsCache';

// For account set (fastest)
const result = await symbolsCache.getSymbolsForAccountSet(accountSet);
const symbols = result.broker1Symbols; // or broker2Symbols

// For individual broker  
const symbols = await symbolsCache.getSymbolsForBroker(broker);

// Smart search with auto-refresh
const result = await symbolsCache.searchAndUpdateSymbol('EURUSD', currentSymbols, broker);
```

### Need Quotes/Prices? Use This:
```javascript
import { fetchQuote, fetchMultipleQuotes } from '../services/api';

// Single quote (database-first)
const response = await fetchQuote(symbol, terminal, brokerId);
const quote = response.data.data;

// Multiple quotes (batch, efficient)
const batchResponse = await fetchMultipleQuotes([
  { symbol: 'EURUSD', terminal: 'MT5', brokerId: broker1Id },
  { symbol: 'GOLD', terminal: 'MT4', brokerId: broker2Id }
]);
```

### Need Real-time Updates? Use This:
```javascript
import { connectWS, subscribeToQuotes } from '../services/wsService';

// Connect and subscribe
connectWS(accountSetId);
const unsubscribe = subscribeToQuotes(accountSetId, symbol1, symbol2, (data) => {
  setFutureQuote(data.futureQuote);
  setSpotQuote(data.spotQuote);
});

// Cleanup
return unsubscribe;
```

### Calculate Premium? Use This:
```javascript
// Standard premium calculation
const buyPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
const sellPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
```

---

## 📂 Key Files to Remember

| Task | File | Purpose |
|------|------|---------|
| Symbol Loading | `client/src/services/symbolsCache.js` | Optimized symbol caching |
| Real-time Data | `client/src/services/wsService.js` | WebSocket connections |
| API Calls | `client/src/services/api.js` | HTTP requests with batching |
| Backend Cache | `server/utils/brokerSymbolsCache.js` | Database symbol management |
| Quote Service | `server/services/databaseQuoteService.js` | Database-first quotes |

---

## 🗃️ Key Database Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `broker_symbols_cache` | Symbol data | `normalized_broker_name`, `terminal`, `symbols_data` |
| Quote tables | Bid/ask prices | `broker_name`, `symbol`, `bid`, `ask`, `timestamp` |
| Account sets | User configurations | `id`, `name`, `brokers`, `symbolsLocked` |

---

## 🔍 Quick Debug Commands

### Check Symbol Cache:
```javascript
// In browser console
symbolsCache.cache.size // Frontend cache entries
```

### Check Quote Freshness:
```javascript
// Look for these console logs:
"🎯 Database-first quote hit for EURUSD (age: 1200ms)"
"🔄 Cache empty, falling back to trading API"
```

### Check WebSocket:
```javascript
// Look for these console logs:
"📡 WebSocket connected for real-time quotes"
"✅ Quote update received via WebSocket"
```

---

## ⚡ Performance Targets

- **Symbol Loading:** < 500ms (< 100ms from cache)
- **Quote Fetching:** < 200ms (database) or < 1s (API)
- **Premium Calc:** < 10ms (from cached data)
- **Real-time Updates:** < 50ms via WebSocket

---

## 🚨 Red Flags to Avoid

❌ Direct API calls: `fetch('/api/trading/symbols')`  
❌ New caching logic: `const cache = new Map()`  
❌ Frequent polling: `setInterval(fetchQuote, 1000)`  
❌ Not filtering by account set  

✅ Use existing optimized services  
✅ Follow database-first patterns  
✅ Use WebSocket for real-time data  
✅ Always filter by account set  

---

## 📞 Quick Help

1. **Symbols not loading?** → Check `symbolsCache.js` and console logs
2. **Quotes not fresh?** → Check database quote service and 5-second tolerance  
3. **Real-time not working?** → Check WebSocket connection and subscriptions
4. **Performance slow?** → Check cache hit rates and database queries

---

*Keep this card handy for quick development reference!*