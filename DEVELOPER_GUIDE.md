# FluxNetwork Developer Guide

## 🎯 Quick Start for New Features

### Before You Code - Check These First!

1. **Need symbols?** → Use `client/src/services/symbolsCache.js`
2. **Need quotes/prices?** → Use database-first pattern with 5-second tolerance
3. **Need real-time data?** → Use WebSocket + database hybrid approach
4. **Building UI components?** → Follow existing patterns in Dashboard/TradeExecution

---

## 🔧 Common Development Tasks

### Adding Symbol Selection to a New Component

```javascript
// ✅ CORRECT APPROACH
import symbolsCache from '../services/symbolsCache';

function MyNewComponent({ accountSet }) {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSymbols = async () => {
      setLoading(true);
      try {
        // Use existing optimized system
        const result = await symbolsCache.getSymbolsForAccountSet(accountSet);
        if (result.success) {
          setSymbols(result.broker1Symbols); // or broker2Symbols
        }
      } catch (error) {
        console.error('Symbol loading failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (accountSet) loadSymbols();
  }, [accountSet]);

  return (
    <select>
      {symbols.map(symbol => (
        <option key={symbol} value={symbol}>{symbol}</option>
      ))}
    </select>
  );
}
```

### Adding Price/Quote Display

```javascript
// ✅ CORRECT APPROACH - Database first, then API fallback
import { fetchQuote, fetchMultipleQuotes } from '../services/api';

function PriceDisplay({ symbol, terminal, brokerId }) {
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const loadQuote = async () => {
      try {
        // This automatically uses database-first approach
        const response = await fetchQuote(symbol, terminal, brokerId);
        setQuote(response.data.data);
      } catch (error) {
        console.error('Quote loading failed:', error);
      }
    };

    loadQuote();
    const interval = setInterval(loadQuote, 5000); // 5 second refresh
    return () => clearInterval(interval);
  }, [symbol, terminal, brokerId]);

  return (
    <div>
      <span>Bid: {quote?.bid}</span>
      <span>Ask: {quote?.ask}</span>
    </div>
  );
}
```

### Adding Real-time Premium Calculation

```javascript
// ✅ CORRECT APPROACH - WebSocket + Database hybrid
import { connectWS, subscribeToQuotes } from '../services/wsService';

function PremiumCalculator({ accountSet, futureSymbol, spotSymbol }) {
  const [futureQuote, setFutureQuote] = useState(null);
  const [spotQuote, setSpotQuote] = useState(null);
  const [premium, setPremium] = useState({ buy: 0, sell: 0 });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!accountSet._id || !futureSymbol || !spotSymbol) return;

    const handleQuoteUpdate = (data) => {
      if (data.futureSymbol === futureSymbol && data.futureQuote) {
        setFutureQuote(data.futureQuote);
      }
      if (data.spotSymbol === spotSymbol && data.spotQuote) {
        setSpotQuote(data.spotQuote);
      }
    };

    connectWS(accountSet._id);
    const unsubscribe = subscribeToQuotes(
      accountSet._id, 
      futureSymbol, 
      spotSymbol, 
      handleQuoteUpdate
    );

    return unsubscribe;
  }, [accountSet._id, futureSymbol, spotSymbol]);

  // Premium calculation
  useEffect(() => {
    if (futureQuote && spotQuote) {
      const buyPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
      const sellPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
      setPremium({ buy: buyPremium, sell: sellPremium });
    }
  }, [futureQuote, spotQuote]);

  return (
    <div>
      <div>Buy Premium: {premium.buy.toFixed(5)}</div>
      <div>Sell Premium: {premium.sell.toFixed(5)}</div>
    </div>
  );
}
```

---

## 🏗️ Architecture Patterns to Follow

### 1. Database-First Pattern
Always check database cache before making API calls:

```javascript
// Backend pattern
const quote = await databaseQuoteService.getQuoteFromDatabase(brokerName, symbol);
if (!databaseQuoteService.isQuoteFresh(quote, 5000)) {
  // Only then call API
  const freshQuote = await callBrokerAPI();
  // Update database cache
}
```

### 2. Frontend Caching Pattern
Cache data for reasonable periods to reduce server load:

```javascript
class MyService {
  constructor() {
    this.cache = new Map();
  }

  async getData(key) {
    // Check cache first
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.data;
      }
    }

    // Fetch fresh data
    const data = await this.fetchFromServer(key);
    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }
}
```

### 3. Error Handling with Fallbacks
Always provide graceful degradation:

```javascript
try {
  // Try primary approach
  const result = await primaryMethod();
  return result;
} catch (primaryError) {
  try {
    // Fallback approach
    const fallback = await fallbackMethod();
    return fallback;
  } catch (fallbackError) {
    // Final fallback or user-friendly error
    console.error('Both methods failed:', { primaryError, fallbackError });
    return { success: false, error: 'Service temporarily unavailable' };
  }
}
```

---

## 📊 Performance Guidelines

### Response Time Targets
- **Symbol Loading:** < 500ms (cache hit < 100ms)
- **Quote Fetching:** < 200ms (database) or < 1s (API fallback)  
- **Premium Calculations:** < 10ms (from cached data)
- **UI Updates:** < 50ms (use React optimizations)

### Optimization Techniques
1. **Batch API calls** when possible
2. **Use database caching** with appropriate TTL
3. **Implement frontend caching** for frequently accessed data
4. **Use WebSockets** for real-time data instead of polling
5. **Debounce user inputs** to reduce API calls

---

## 🧪 Testing Your Implementation

### Manual Testing Checklist
- [ ] Symbols load quickly from cache
- [ ] Symbol search triggers auto-refresh when needed
- [ ] Quotes show database age/source in console logs
- [ ] Real-time updates work via WebSocket
- [ ] Fallbacks work when services are down
- [ ] Performance meets target response times

### Console Log Verification
Look for these patterns in browser console:
```
🎯 Using cached symbols for account set 123: Broker1=45, Broker2=38
✅ Database-first quote hit for EURUSD (age: 1200ms)
🔄 Cache empty, falling back to trading API for GOLD
📡 WebSocket connected for real-time quotes
```

---

## 🚨 Common Pitfalls & Solutions

### ❌ Pitfall: Making Direct API Calls
```javascript
// ❌ DON'T DO THIS
const symbols = await fetch('/api/trading/symbols');
```
**✅ Solution:** Use existing optimized services
```javascript
const result = await symbolsCache.getSymbolsForAccountSet(accountSet);
```

### ❌ Pitfall: Not Using Account Set Filtering  
```javascript
// ❌ DON'T DO THIS - loads all symbols for all brokers
const allSymbols = await getAllSymbols();
```
**✅ Solution:** Always filter by account set
```javascript
const result = await symbolsCache.getSymbolsForAccountSet(currentAccountSet);
```

### ❌ Pitfall: Frequent API Polling
```javascript
// ❌ DON'T DO THIS
setInterval(fetchQuotes, 1000); // Too frequent!
```
**✅ Solution:** Use WebSocket + database with reasonable intervals
```javascript
connectWS(accountSetId);
subscribeToQuotes(accountSetId, symbol1, symbol2, handleUpdate);
```

---

## 📝 Code Review Checklist

Before submitting code, verify:

### Data Fetching
- [ ] Using existing symbol cache system (`symbolsCache.js`)?
- [ ] Following database-first pattern for quotes?
- [ ] Implementing proper error handling with fallbacks?
- [ ] Using batch APIs when fetching multiple items?

### Performance  
- [ ] Frontend caching with reasonable TTL?
- [ ] Not making unnecessary API calls?
- [ ] Using WebSocket for real-time data?
- [ ] Debouncing user inputs appropriately?

### User Experience
- [ ] Loading states for async operations?
- [ ] Error messages are user-friendly?
- [ ] Data updates don't cause UI flickering?
- [ ] Responsive to user interactions?

### Code Quality
- [ ] Following existing code patterns?
- [ ] Console logging for debugging/monitoring?
- [ ] Proper cleanup in useEffect hooks?
- [ ] TypeScript/PropTypes for type safety?

---

## 🆘 Troubleshooting Guide

### Symbols Not Loading
1. Check console for cache hit/miss logs
2. Verify `broker_symbols_cache` table has data  
3. Test `/api/symbols/account-set/:id` endpoint directly
4. Check account set has proper broker configuration

### Quotes/Prices Not Updating
1. Check database quote freshness (< 5 seconds)
2. Verify WebSocket connection status
3. Test quote endpoints directly
4. Check broker token validity

### Performance Issues
1. Monitor cache hit rates in console
2. Check database query performance
3. Verify frontend caching is working
4. Look for unnecessary re-renders in React

---

## 🔗 Key Resources

- **CLAUDE.md** - AI assistant memory and patterns
- **Dashboard.jsx** - Reference implementation for symbol loading
- **TradeExecution.jsx** - Reference implementation for real-time quotes
- **symbolsCache.js** - Symbol caching service
- **wsService.js** - WebSocket service
- **brokerSymbolsCache.js** - Backend cache manager

---

*Keep this guide updated as new optimized patterns are implemented!*