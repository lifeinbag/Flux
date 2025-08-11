# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a trading platform with React frontend and Node.js backend that manages MT4/MT5 broker connections for premium data collection and real-time quote monitoring. The system collects bid/ask quotes from multiple brokers and calculates premium differences between future and spot symbols.

## Development Commands

### Client (React)
```bash
cd client
npm start        # Start development server on port 3000
npm run build    # Build for production
npm test         # Run Jest tests
```

### Server (Node.js)
```bash
cd server
npm run dev      # Start with nodemon (auto-restart)
npm start        # Start production server on port 5000
```

The client is configured with a proxy to `http://localhost:5000` for API requests.

## Architecture

### Client-Server Structure
- **Frontend**: React 18 SPA with React Router
- **Backend**: Express.js API with WebSocket support
- **Database**: PostgreSQL with Sequelize ORM
- **Real-time**: WebSocket for live premium data broadcasting

### Key Service Dependencies
- **TokenManager** (`server/token-manager.js`): Manages MT4/MT5 session tokens with caching and database persistence
- **DataCollectionService** (`server/services/persistentDataCollection.js`): Handles automated quote collection from brokers
- **WebSocket Services**: Real-time data broadcasting via `ws/subscriptionManager.js`

### Database Schema
- **Users**: JWT authentication with referral system
- **AccountSets**: Trading configurations linking future/spot symbols
- **Brokers**: MT4/MT5 connection credentials with token storage
- **Dynamic Tables**: Auto-created bid/ask and premium calculation tables

### Critical File Relationships
- `server/index.js` → Entry point, initializes all services and routes
- `server/models/index.js` → Database associations and sync
- `server/token-manager.js` → Used by trading routes and data collection
- `server/routes/trading.js` → Broker operations and symbol fetching
- `client/services/api.js` → Axios client with JWT auth used by all components

## Coding Standards

Follow the existing patterns in `CODING_GUIDELINES.md` and `Project guidlines.md`:
- Keep code concise and minimal
- No verbose comments unless necessary
- Prefer editing existing files over creating new ones
- Use consistent error handling: `logger.error("[context]", error.message)`
- Remove unused imports, console.logs, and dead code

## Token Management
Tokens are cached in-memory with 23-hour TTL and persisted to the `brokers` table. The system checks database tokens first before making new API requests to MT4/MT5 services.

## Database Table Patterns
- Bid/Ask tables: `bid_ask_{normalized_broker_name}`
- Premium tables: `premium_{broker1}_{broker2}_{future}_vs_{spot}`
- All financial data uses DECIMAL(15,8) precision
- Proper indexing on symbol and timestamp columns