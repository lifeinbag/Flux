// server/services/quotes/restQuotes.js
// Minimal placeholder: keep legacy REST flow unchanged.
// We expose start/stop for symmetry with wsQuotes.

const logger = require('../../utils/logger');

let started = false;

async function start() {
  if (started) return;
  started = true;
  logger.info('RestQuotes: using existing REST/polling paths (service idle).');
}

async function stop() {
  if (!started) return;
  started = false;
  logger.info('RestQuotes: stopped.');
}

module.exports = { start, stop };
