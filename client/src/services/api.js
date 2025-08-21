import axios from 'axios';

// ——— Local API instance (for your backend) —————————————
// Auto-detect backend URL based on current hostname
function getBackendURL() {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Handle devtunnels and other tunnel services
  if (window.location.hostname.includes('devtunnels.ms')) {
    const backendHost = window.location.hostname.replace('-3000', '-5000');
    return `${window.location.protocol}//${backendHost}/api`;
  }
  
  // Default for localhost
  return 'http://localhost:5000/api';
}

const API = axios.create({
  baseURL: getBackendURL(),
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage to all outgoing requests (if present)
API.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

export default API;

// ——— Auth & User Endpoints ——————————————————————————
/**
 * Get current logged-in user profile
 */
export function fetchCurrentUser() {
  return API.get('/users/me');
}

// ——— Referral Network Endpoints ————————————————————
/**
 * Get your 2-tier referral network (level1 & level2 lists and current share settings)
 */
export function fetchNetwork() {
  return API.get('/users/network');
}

/**
 * Save updated Level-1 & Level-2 commission shares
 */
export function saveNetworkShares(level1, level2) {
  return API.post('/users/network/shares', { level1, level2 });
}

// ——— UNIFIED TRADING FUNCTIONS (USE THESE EVERYWHERE) ——————————
/**
 * Fetch the MT4/MT5 opened positions for a given broker.
 */
export function fetchPositions(terminal, brokerId) {
  return API.get('/trading/positions', {
    params: { terminal, id: brokerId },
  });
}

/**
 * Fetch the MT4/MT5 account summary (balance & profit) for a broker.
 */
export function fetchBalance(terminal, brokerId) {
  return API.get('/trading/balance', {
    params: { terminal, id: brokerId },
  });
}

/**
 * Fetch the list of available symbols for a broker.
 */
export function fetchSymbols(terminal, brokerId) {
  return API.get('/trading/symbols', {
    params: { terminal, id: brokerId },
  });
}

/**
 * ✅ OPTIMIZED: Fetch a single quote by symbol for a broker (uses database-first approach)
 */
export function fetchQuote(symbol, terminal, brokerId) {
  return API.get(`/trading/quote/${encodeURIComponent(symbol)}`, {
    params: { terminal, id: brokerId },
  });
}

/**
 * ✅ NEW: Get premium data from database-first service
 */
export function fetchPremiumData(companyName, accountSetId, limit = 100) {
  return API.get(`/premium-data/${companyName}/${accountSetId}`, {
    params: { limit }
  });
}

/**
 * ✅ NEW: Get multiple quotes efficiently using database cache
 */
export function fetchMultipleQuotes(requests) {
  return API.post('/trading/quotes/batch', { requests });
}

/**
 * ✅ NEW: Fetch symbols for multiple brokers efficiently using cache
 */
export function fetchMultipleSymbols(requests) {
  return API.post('/trading/symbols/batch', { requests });
}

// ——— DEPRECATED FUNCTIONS (DO NOT USE) ——————————————————————
// These are kept for backward compatibility but should not be used
export function fetchMt5Symbols(id) {
  console.warn('DEPRECATED: Use fetchSymbols("MT5", brokerId) instead');
  return fetchSymbols('MT5', id);
}

export function fetchMt4Symbols(id) {
  console.warn('DEPRECATED: Use fetchSymbols("MT4", brokerId) instead'); 
  return fetchSymbols('MT4', id);
}

// ——— Trading Account Management —————————————————————
export function saveTradingAccount(terminal, token) {
  return API.post('/users/account', { terminal, token });
}

// ——— NEW: Broker Symbols Cache Endpoint —————————————————————
/**
 * Fetch symbols directly from broker_symbols_cache (fast + resilient).
 * 
 * Example:
 *   fetchSymbolsCache({ broker1: "icmarkets", broker2: "exness", terminal: "MT4" })
 */
export async function fetchSymbolsCache({ broker1, broker2, terminal }) {
  const params = new URLSearchParams();
  if (broker1) params.set('broker1', broker1);
  if (broker2) params.set('broker2', broker2);
  if (terminal) params.set('terminal', terminal);

  const res = await fetch(`/api/symbols/cache?${params.toString()}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error('symbols_fetch_failed');
  return res.json();
}
