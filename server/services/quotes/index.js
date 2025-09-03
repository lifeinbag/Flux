// server/services/quotes/index.js
// Feature flag switcher for quotes source.

const logger = require('../../utils/logger');
const wsQuotes = require('./wsQuotes');
const restQuotes = require('./restQuotes');

function source() {
  const s = String(process.env.QUOTES_SOURCE || 'rest').toLowerCase();
  return s === 'ws' ? 'ws' : 'rest';
}

async function start() {
  const which = source();
  logger.info(`QuotesService: selecting "${which}" source`);
  if (which === 'ws') return wsQuotes.start();
  return restQuotes.start();
}

async function stop() {
  const which = source();
  if (which === 'ws') return wsQuotes.stop();
  return restQuotes.stop();
}

module.exports = { start, stop };
