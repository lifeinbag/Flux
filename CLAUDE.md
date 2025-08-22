# FluxNetwork Project Memory & Guidelines

## 🧠 AI Assistant Instructions
**This file serves as persistent memory for Claude and other AI assistants working on this project.**

---

## 📋 CRITICAL: Always Check These Systems First

### 1. 🚀 SYMBOL FETCHING - **USE EXISTING OPTIMIZED SYSTEM**
**Location:** `client/src/services/symbolsCache.js`

**❌ NEVER:** Create new symbol fetching logic or make direct API calls
**✅ ALWAYS:** Use the existing optimized symbols cache system

```javascript
// ✅ CORRECT: Use existing symbol cache system
import symbolsCache from '../services/symbolsCache';

// For account sets (fastest)
const result = await symbolsCache.getSymbolsForAccountSet(accountSet);

// For individual brokers
const symbols = await symbolsCache.getSymbolsForBroker(broker);

// For smart search with auto-update
const result = await symbolsCache.searchAndUpdateSymbol(searchTerm, currentSymbols, broker);
```

**Backend Endpoints:**
- `GET /api/symbols/account-set/:accountSetId` - Account set specific symbols (fastest)
- `GET /api/symbols/cache?broker1=X&broker2=Y&terminal=MT4` - General cache lookup
- `POST /trading/refresh-symbols` - Force refresh database cache

**Database Table:** `broker_symbols_cache` (JSONB structure)

---

### 2. 💹 BID/ASK & PREMIUM CALCULATION - **USE DATABASE-FIRST APPROACH**

**❌ NEVER:** Make fresh API calls for quotes unless absolutely necessary
**✅ ALWAYS:** Use database-first quote fetching with 5-second cache tolerance

**Existing Optimized Endpoints:**
```javascript
// ✅ CORRECT: Database-first quote fetching
GET /api/trading/quote/:symbol?terminal=MT5&id=brokerId
GET /api/trading/quotes/batch  // For multiple quotes efficiently

// Service: databaseQuoteService (server-side)
const quote = await databaseQuoteService.getQuoteFromDatabase(brokerName, symbol);
const isFresh = databaseQuoteService.isQuoteFresh(quote, 5000); // 5 second tolerance
```

**Premium Calculation Pattern:**
```javascript
// ✅ CORRECT: Use cached quotes for premium calculation
const buyPremium = (futureQuote.ask || 0) - (spotQuote.bid || 0);
const sellPremium = (futureQuote.bid || 0) - (spotQuote.ask || 0);
```

---

### 3. 🎯 REAL-TIME DATA - **USE WEBSOCKET + DATABASE HYBRID**

**Location:** `client/src/services/wsService.js`

**❌ NEVER:** Create polling mechanisms or frequent API calls
**✅ ALWAYS:** Use WebSocket for real-time updates + database cache for fallback

```javascript
// ✅ CORRECT: WebSocket + Database hybrid approach
import { connectWS, subscribeToQuotes } from '../services/wsService';

connectWS(accountSetId);
subscribeToQuotes(accountSetId, symbol1, symbol2, handleQuoteUpdate);
```

---

## 🏗️ PROJECT ARCHITECTURE PATTERNS

### Database-First Pattern
```
1. Check database cache first (< 5 seconds = fresh)
2. If stale/missing → Fetch from API
3. Update database cache
4. Return data to frontend
5. Frontend caches for 5 minutes
```

### Symbol Loading Flow
```
1. Check frontend cache (5 min TTL)
2. Check broker_symbols_cache table  
3. If empty → Auto-refresh from API
4. Update database + frontend cache
5. Return symbols to UI
```

### Quote Fetching Flow
```
1. Check database quotes table (5 sec tolerance)
2. If fresh → Return immediately
3. If stale → Parallel fetch from API + return stale data
4. Update database in background
```

---

## 📁 KEY FILES & SERVICES

### Frontend Services
- `client/src/services/symbolsCache.js` - **Symbol caching system**
- `client/src/services/wsService.js` - **WebSocket real-time data**
- `client/src/services/api.js` - **API client with batch methods**

### Backend Services  
- `server/utils/brokerSymbolsCache.js` - **Database symbol cache manager**
- `server/services/databaseQuoteService.js` - **Database-first quote service**
- `server/utils/intelligentBrokerNormalizer.js` - **Broker name normalization**

### Database Tables
- `broker_symbols_cache` - Symbol data with JSONB structure
- Quote tables - Bid/ask data with timestamps
- Account sets & brokers - Configuration data

---

## 🚨 COMMON MISTAKES TO AVOID

### ❌ Don't Do This:
```javascript
// ❌ Making direct API calls for symbols
const response = await API.get('/trading/symbols');

// ❌ Creating new caching logic
const myCache = new Map();

// ❌ Frequent quote API calls
setInterval(() => fetchQuote(), 1000);

// ❌ Not using account set filtering
const allSymbols = await fetchAllSymbols();
```

### ✅ Do This Instead:
```javascript
// ✅ Use existing optimized systems
const result = await symbolsCache.getSymbolsForAccountSet(accountSet);
const quotes = await fetchMultipleQuotes(requests);
connectWS(accountSetId);
```

---

## 🔧 DEVELOPMENT GUIDELINES

### Before Adding New Features:
1. **Check CLAUDE.md first** - Look for existing solutions
2. **Search for similar patterns** in codebase  
3. **Use existing services** when possible
4. **Follow database-first approach**
5. **Implement proper caching**

### When Working with Data:
1. **Symbols** → Use `symbolsCache.js`
2. **Quotes/Prices** → Use database-first pattern
3. **Real-time Updates** → Use WebSocket + database
4. **Account Filtering** → Always filter by account set
5. **Performance** → Cache first, API second

### Code Review Checklist:
- [ ] Using existing symbol cache system?
- [ ] Database-first for quotes/prices?  
- [ ] Proper error handling with fallbacks?
- [ ] Account set filtering implemented?
- [ ] Frontend caching with reasonable TTL?
- [ ] WebSocket for real-time where applicable?

---

## 📈 PERFORMANCE TARGETS

### Symbol Loading:
- **First Load:** < 500ms (from cache)
- **Cache Hit:** < 100ms  
- **Cache Miss:** < 2 seconds (with API fallback)

### Quote Fetching:
- **Fresh Cache:** < 50ms
- **Stale Cache:** < 200ms (return stale + background refresh)
- **API Fallback:** < 1 second

### Premium Calculations:
- **Real-time:** < 10ms (from cached quotes)
- **Update Frequency:** Via WebSocket (real-time) + 5s cache tolerance

---

## 🔍 DEBUGGING & MONITORING

### Console Logging Patterns:
```javascript
console.log('🎯 Using cached symbols:', symbolCount);
console.log('🔄 Refreshing cache for broker:', brokerName);
console.log('✅ Database-first quote hit:', symbol);
console.log('⚠️ Falling back to API for:', reason);
```

### Key Metrics to Monitor:
- Symbol cache hit rate
- Quote freshness percentage  
- API fallback frequency
- WebSocket connection health
- Database query performance

---

## 💾 BACKUP & RECOVERY

### Critical Data:
- `broker_symbols_cache` table - Symbol data
- Quote history tables - Price data
- Account set configurations - User setups

### Recovery Process:
1. Symbol cache can be rebuilt from API
2. Quotes can be backfilled from broker APIs
3. Account configurations should be backed up regularly

---

## 📞 SUPPORT CONTACTS

### When Issues Arise:
1. **Symbol Loading Issues** → Check `symbolsCache.js` and `broker_symbols_cache` table
2. **Quote/Premium Issues** → Check `databaseQuoteService.js` and quote tables  
3. **Real-time Issues** → Check `wsService.js` and WebSocket connections
4. **Performance Issues** → Check cache hit rates and database query performance

---

## 🆕 ADDING NEW FEATURES

### Template for New Components:
```javascript
import symbolsCache from '../services/symbolsCache';
import { connectWS, subscribeToQuotes } from '../services/wsService';
import API from '../services/api';

// Always use existing optimized services
const symbols = await symbolsCache.getSymbolsForAccountSet(accountSet);
const quotes = await API.post('/trading/quotes/batch', { requests });
```

### Integration Checklist:
- [ ] Does it need symbols? → Use `symbolsCache.js`
- [ ] Does it need quotes? → Use database-first pattern
- [ ] Does it need real-time data? → Use WebSocket
- [ ] Does it filter by account? → Use account set filtering
- [ ] Is it performance critical? → Implement caching

---

## 🚨 CRITICAL: ANALYSIS-FIRST APPROACH

### Before Adding ANY New Feature or Service:

**STEP 1: UNDERSTAND EXISTING SYSTEMS**
1. **Read CLAUDE.md thoroughly** - Look for similar patterns
2. **Search codebase** for existing implementations
3. **Ask: "What system already does this?"**
4. **Check persistent services** - `persistentDataCollection.js`, monitoring services
5. **Look for existing data flows** - Database queries, API calls, caches

**STEP 2: IDENTIFY EXISTING DATA FLOWS**
- **Quote/Price Data** → `persistentDataCollection.js` + database-first pattern
- **Broker Status** → Log existing operations, DON'T create new API calls
- **Real-time Data** → WebSocket + database hybrid
- **Monitoring** → Enhance existing services, DON'T duplicate

**STEP 3: ENHANCE, DON'T DUPLICATE**
- ✅ **ADD logging** to existing successful operations
- ✅ **EXTEND current services** with additional features
- ✅ **USE database-first** approach for all data
- ❌ **DON'T create new external API calls** when data already flows
- ❌ **DON'T build parallel systems** that do the same thing

### Example: Broker Status Monitoring
**❌ WRONG APPROACH:**
- Create new health monitor service
- Make additional external API calls
- Build separate monitoring system

**✅ CORRECT APPROACH:**
- Add logging to existing `persistentDataCollection.js`
- Log successful operations in existing API endpoints
- Use current token/data flows

### Analysis Questions to Ask:
1. **Does this data already exist** in the database?
2. **Is there already a service** doing similar work?
3. **Are we already making** these API calls somewhere?
4. **Can we enhance existing** code instead of creating new?
5. **What would be the simplest** way to achieve this?

---

**Remember: Always check existing optimized systems before implementing new solutions!**

**NEVER create new services without first analyzing existing data flows and systems.**

*This file should be updated whenever new optimized systems are implemented.*