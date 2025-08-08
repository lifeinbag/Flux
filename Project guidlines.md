# Project Coding Guidelines

Follow project guidelines - keep it minimal and concise

## CRITICAL: Always Follow These Rules

### 1. Code Simplicity & Brevity
- **Keep code concise and minimal** - no unnecessary lines
- **Avoid over-engineering** - use the simplest solution that works
- **No verbose comments** unless absolutely necessary
- **Remove any unused code, imports, or variables**
- **Prefer short, direct solutions over complex abstractions**
- **No Hard Coded Values/text should be used in entire Project**

### 2. File Size Management
- **Keep component files under 300 lines** only if possible
- **Break large files into smaller, focused components**
- **Avoid adding features that significantly increase file size**
- **Remove dead code and unused functions immediately**

### 3. Code Style
- **Use concise variable names** (e.g., `i`, `j`, `e`, `el`)
- **Keep functions short and focused** (under 20 lines only if possible)
- **Avoid nested ternary operators**
- **Use early returns to reduce nesting**
- **Minimize inline styles** - prefer CSS classes

### 4. Change Philosophy
- **Fix, don't rewrite** - make minimal changes to existing code
- **Single responsibility** - one fix/feature per change
- **Preserve existing structure** unless absolutely necessary to change
- **Test the minimal change first** before adding complexity

### 5. When Making Changes
- **Identify the exact problem** before coding
- **Make the smallest possible fix**
- **Don't refactor unrelated code**
- **Keep the same coding patterns** as the existing file
- **Remove any code you add that isn't essential**

## Example: Good vs Bad

### ❌ BAD (Verbose)
```javascript
// This function handles the user click event and processes the data
const handleUserClickEventForDataProcessing = (event) => {
  // Check if the event exists and has a target
  if (event && event.target) {
    // Get the value from the target element
    const targetElementValue = event.target.value;
    // Check if the value is not empty or null
    if (targetElementValue && targetElementValue !== '') {
      // Process the value and update state
      setUserInputValue(targetElementValue);
    }
  }
};
```

### ✅ GOOD (Concise)
```javascript
const handleClick = (e) => {
  if (e.target.value) setUserInput(e.target.value);
};
```

## Quick Checklist Before Submitting Code
- [ ] Is this the minimal change needed?
- [ ] Did I remove any unnecessary lines?
- [ ] Are variable names concise but clear?
- [ ] Is the file size reasonable?
- [ ] Did I avoid adding complexity?

## Magic Phrase for AI
**"Keep it simple, minimal, and concise - no unnecessary code or long lines."**

# Complete Project Analysis: File Structure, Dependencies, Database Schema & Token Management

## 🏗️ Project Overview

This is a **trading platform** with a React frontend and Node.js backend that manages MT4/MT5 broker connections for premium data collection and real-time quote monitoring.

---

## 📁 Client-Side (React App) Structure

### Core Files & Dependencies

```
client/
├── public/
│   ├── index.html (Includes lightweight-charts CDN)
│   └── manifest.json
├── src/
│   ├── index.js (React 18 entry point)
│   ├── App.js (Main routing & authentication)
│   ├── services/
│   │   └── api.js (Axios HTTP client with JWT auth)
│   ├── components/
│   │   ├── NavBar.js
│   │   └── TradeExecution.js
│   └── pages/
│       ├── Signup.js
│       ├── Login.js
│       ├── Dashboard.js
│       ├── Network.js
│       ├── Admin.js
│       ├── ForgotPassword.js
│       ├── ResetPassword.js
│       └── LinkAccount.js
├── package.json
└── package-lock.json
```

### Key Client Dependencies
- **React 18.2.0** - Main UI framework
- **react-router-dom 7.6.2** - Client-side routing
- **axios 1.10.0** - HTTP requests to backend
- **lightweight-charts 4.1.0** - Trading charts
- **lucide-react 0.525.0** - Icons

### File Interconnections (Client)

1. **App.js** → Central hub that imports:
   - All page components (Login, Dashboard, etc.)
   - API service for authentication
   - React Router for navigation

2. **api.js** → Core service used by ALL components:
   - Automatically attaches JWT tokens from localStorage
   - Provides endpoints for auth, trading, accounts
   - Used by every page that needs backend data

3. **TradeExecution.js** → Complex component that:
   - Depends on API.js for account-sets endpoint
   - Used within App.js routing
   - Handles broker trading operations

---

## 🖥️ Server-Side (Node.js) Structure

### Core Server Files & Dependencies

```
server/
├── index.js (Main server entry point)
├── package.json
├── models/
│   ├── index.js (Sequelize setup & associations)
│   ├── User.js (User model with referrals)
│   ├── AccountSet.js (AccountSet & Broker models)
│   └── Otp.js (OTP verification model)
├── routes/
│   ├── auth.js (JWT authentication)
│   ├── user.js (User management)
│   ├── admin.js (Admin operations)
│   ├── accountSets.js (Account management)
│   ├── trading.js (MT4/MT5 operations)
│   ├── premiumData.js (Premium recording)
│   ├── premiumCandles.js (Chart data)
│   └── status.js (System status)
├── middleware/
│   └── auth.js (JWT verification middleware)
├── services/
│   └── persistentDataCollection.js (Data collection service)
├── utils/
│   ├── dataCollectionManager.js (Table management)
│   ├── logger.js (Logging utility)
│   └── intelligentBrokerNormalizer.js (Broker naming)
├── ws/
│   ├── subscriptionManager.js (WebSocket subscriptions)
│   └── broadcastService.js (Real-time broadcasts)
├── config/
│   └── database.js (PostgreSQL connection)
└── token-manager.js (MT4/MT5 token management)
```

### Key Server Dependencies
- **express 5.1.0** - Web framework
- **sequelize 6.37.7** - PostgreSQL ORM
- **pg 8.16.3** - PostgreSQL driver
- **jsonwebtoken 9.0.2** - JWT authentication
- **ws 8.18.2** - WebSocket support
- **axios 1.10.0** - External API calls
- **bcryptjs 3.0.2** - Password hashing

### Critical File Interconnections (Server)

#### 1. **index.js** (Main Entry Point)
**Dependencies:**
- Routes: All route files from `/routes/`
- Models: `./models/index.js` for database sync
- Services: `persistentDataCollectionService`
- WebSocket: `subscriptionManager`, `broadcastService`
- Token Manager: `./token-manager.js`

**What it does:**
- Sets up Express server with CORS
- Mounts all API routes
- Establishes WebSocket server for real-time data
- Initializes persistent data collection
- Starts cleanup scheduler for expired data

#### 2. **models/index.js** (Database Central Hub)
**Dependencies:**
- `./User.js`
- `./AccountSet.js` (exports AccountSet & Broker)
- `./Otp.js`
- `../config/database.js`

**Associations defined:**
```javascript
// User ↔ AccountSet (1:Many)
User.hasMany(AccountSet, { foreignKey: 'userId' })
AccountSet.belongsTo(User, { foreignKey: 'userId' })

// AccountSet ↔ Broker (1:Many)  
AccountSet.hasMany(Broker, { foreignKey: 'accountSetId' })
Broker.belongsTo(AccountSet, { foreignKey: 'accountSetId' })

// User ↔ User (Referral system)
User.belongsTo(User, { as: 'sponsor', foreignKey: 'sponsorId' })
User.hasMany(User, { as: 'referrals', foreignKey: 'sponsorId' })
```

#### 3. **token-manager.js** (Critical Trading Component)
**Used by:**
- `routes/trading.js` - For MT4/MT5 API calls
- `services/persistentDataCollection.js` - For data collection
- `utils/dataCollectionManager.js` - For broker tokens

**What it does:**
- Manages MT4/MT5 session tokens with caching
- Implements position-based cache keys to prevent broker mix-ups
- Provides token validation and refresh logic
- Critical for all trading operations

#### 4. **routes/trading.js** (Trading Operations)
**Dependencies:**
- `../models/AccountSet` (Broker lookup)
- `../token-manager.js` (Token management)
- `../middleware/auth.js` (JWT verification)

**Critical functions:**
- Broker token retrieval with database optimization
- Symbol fetching from MT4/MT5 APIs
- Quote retrieval for trading pairs

#### 5. **services/persistentDataCollection.js** (Data Collection Engine)
**Dependencies:**
- `../models/AccountSet` (Account lookup)
- `../token-manager.js` (Broker tokens)
- `../utils/intelligentBrokerNormalizer.js` (Table naming)

**What it does:**
- Restores data collection on server startup
- Manages premium data collection intervals
- Creates dynamic PostgreSQL tables
- Broadcasts real-time data via WebSocket

---

## 🗄️ PostgreSQL Database Schema Analysis

### ✅ **Consistent Table Format Confirmed**

**Base Tables (Sequelize managed):**
```sql
-- Users table (Referral system with sponsor hierarchy)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE NOT NULL,
  password VARCHAR NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  sponsorId UUID REFERENCES users(id),
  referralCode VARCHAR UNIQUE,
  level1Share DECIMAL(5,2),
  level2Share DECIMAL(5,2),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Account Sets (Trading configurations)
CREATE TABLE account_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id),
  name VARCHAR NOT NULL DEFAULT 'New Set',
  futureSymbol VARCHAR,
  spotSymbol VARCHAR,
  symbolsLocked BOOLEAN DEFAULT false,
  companyMappings JSON,
  premiumTableName VARCHAR,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- Brokers (MT4/MT5 connections)
CREATE TABLE brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountSetId UUID NOT NULL REFERENCES account_sets(id),
  brokerName VARCHAR NOT NULL,
  terminal ENUM('MT4', 'MT5') NOT NULL,
  accountNumber VARCHAR NOT NULL,
  password VARCHAR NOT NULL,
  server VARCHAR NOT NULL,
  token VARCHAR, -- ✅ TOKENS ARE SAVED IN DATABASE
  tokenExpiresAt TIMESTAMP, -- ✅ EXPIRATION TRACKING
  companyName VARCHAR,
  position INTEGER NOT NULL DEFAULT 1, -- ✅ CRITICAL: Position-based ordering
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
);

-- OTP verification
CREATE TABLE otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR NOT NULL,
  code VARCHAR NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  createdAt TIMESTAMP
);
```

### 🎯 **Dynamic Tables (Consistent Format)**

**Pattern 1: Bid/Ask Tables**
```sql
-- Format: bid_ask_{normalized_broker_name}
CREATE TABLE "bid_ask_exness" (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(50) NOT NULL,
  bid DECIMAL(15, 8),
  ask DECIMAL(15, 8),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bid_ask_exness_symbol_timestamp (symbol, timestamp)
);
```

**Pattern 2: Premium Tables**
```sql
-- Format: premium_{broker1}_{broker2}_{future_symbol}_vs_{spot_symbol}
CREATE TABLE "premium_exness_alpari_btcusd_vs_btcusd" (
  id SERIAL PRIMARY KEY,
  account_set_id VARCHAR(255),
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  future_bid DECIMAL(15, 8),
  future_ask DECIMAL(15, 8),
  spot_bid DECIMAL(15, 8),
  spot_ask DECIMAL(15, 8),
  buy_premium DECIMAL(15, 8),
  sell_premium DECIMAL(15, 8),
  INDEX idx_premium_account_timestamp (account_set_id, timestamp)
);
```

### ✅ **Table Format Consistency: CONFIRMED**

**Evidence of consistent format:**
1. **All tables use standardized column naming** (snake_case)
2. **Consistent decimal precision** (15,8) for financial data
3. **Standardized timestamp handling** (TIMESTAMPTZ)
4. **Proper indexing strategy** for query optimization
5. **Table validation logic** in `dataCollectionManager.js`

---

## 🔐 Token Management Analysis

### ✅ **Save Tokens: CONFIRMED IMPLEMENTATION**

**Evidence of token saving:**

1. **Database Storage:**
```javascript
// In Broker model (AccountSet.js)
token: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: 'Trading session token from broker connection'
},
tokenExpiresAt: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: 'Token expiration timestamp'
}
```

2. **Token Persistence Logic:**
```javascript
// From token-manager.js
async getToken(isMT5, serverName, account, password, brokerId) {
  // Database-first approach
  const tokenValid = broker.token && 
                    broker.tokenExpiresAt && 
                    new Date(broker.tokenExpiresAt).getTime() > now;
  
  if (tokenValid) {
    console.log(`✅ Reusing valid database token`);
    return broker.token;
  }
  
  // Only fetch new token if expired
  const token = await this._fetchToken(client, serverName, account, password);
  broker.token = token;
  broker.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours
  await broker.save(); // ✅ SAVES TO DATABASE
}
```

3. **Optimization Strategy:**
```javascript
// From trading.js & dataCollectionManager.js
async function getValidToken(broker) {
  // ✅ CHECK DATABASE TOKEN FIRST - MAJOR OPTIMIZATION
  const tokenValid = broker.token && 
                    broker.tokenExpiresAt && 
                    new Date(broker.tokenExpiresAt).getTime() > now;
  
  if (tokenValid) {
    return broker.token; // Reuse existing token
  }
  
  // ❌ ONLY FETCH NEW TOKEN IF EXPIRED/MISSING
  const token = await TokenManager.getToken(/*...*/);
  broker.token = token;
  broker.tokenExpiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
  await broker.save(); // Save to database
}
```

### 🔑 **Token Management Features:**

1. **In-Memory Caching** - TokenManager maintains cache with TTL
2. **Database Persistence** - Tokens saved to `brokers` table
3. **Expiration Tracking** - 23-hour expiration with automatic refresh
4. **Position-Based Keys** - Prevents broker token mix-ups
5. **Validation Logic** - Checks token validity before API calls
6. **Automatic Refresh** - Fetches new tokens when expired

---

## 🔗 Critical Dependencies & Interconnections

### **High-Priority Dependency Chain:**

1. **Database Models** (`models/index.js`) 
   ↓ Used by ALL routes and services
   
2. **Token Manager** (`token-manager.js`)
   ↓ Required by trading operations and data collection
   
3. **Authentication Middleware** (`middleware/auth.js`)
   ↓ Protects ALL protected routes
   
4. **Data Collection Service** (`services/persistentDataCollection.js`)
   ↓ Manages real-time premium data collection

### **Cross-File Dependencies:**

```
index.js
├── models/index.js (database sync)
├── routes/* (API endpoints)
├── services/persistentDataCollection.js (data collection)
├── token-manager.js (trading tokens)
└── ws/* (WebSocket handling)

routes/trading.js
├── models/AccountSet.js (broker lookup)
├── token-manager.js (MT4/MT5 tokens)
├── middleware/auth.js (JWT verification)
└── utils/brokerSymbolsCache.js (symbol caching)

services/persistentDataCollection.js
├── models/AccountSet.js (account lookup)
├── token-manager.js (broker authentication)
├── utils/dataCollectionManager.js (table creation)
├── utils/intelligentBrokerNormalizer.js (naming)
└── ws/subscriptionManager.js (real-time broadcasting)
```

---

## 🚨 Critical System Requirements

### **For Token Management:**
- PostgreSQL must be running (tokens stored in database)
- MT4/MT5 API endpoints must be accessible
- Environment variables: `MT4_API_URL`, `MT5_API_URL`, `JWT_SECRET`

### **For Data Collection:**
- At least 2 brokers per account set (future + spot)
- Valid broker tokens for API access
- WebSocket server for real-time broadcasting

### **For Database:**
- PostgreSQL 12+ with UUID extension
- Proper indexing for time-series data
- Regular cleanup of expired data

---

## 📋 Summary

### ✅ **Confirmed Implementations:**

1. **Unique Table Format** - All tables follow consistent naming and structure
2. **Token Saving** - Tokens are persisted in database with expiration tracking
3. **Position-Based Architecture** - Brokers ordered by position to prevent mix-ups
4. **Real-Time Data Collection** - WebSocket-based premium data broadcasting
5. **Comprehensive Authentication** - JWT-based auth with middleware protection

### 🎯 **Key Architecture Strengths:**

- **Modular Design** - Clear separation of concerns
- **Database Optimization** - Token reuse prevents unnecessary API calls  
- **Scalable WebSocket** - Real-time data broadcasting
- **Consistent Schema** - Standardized table formats across dynamic tables
- **Error Handling** - Comprehensive token validation and error recovery

The project successfully implements a sophisticated trading platform with proper token management, consistent database schema, and real-time data collection capabilities.