'use strict';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const current = process.env.NODE_ENV === 'production' ? 'info' : 'debug';

// FR : Journalise un message horodaté au niveau donné.
// EN : Log a timestamped message at the given level.
function log(level, ...args) {
  if (levels[level] > levels[current]) return;
  const ts = new Date().toISOString();
  const line = `[${ts}] ${level.toUpperCase()}`;
  if (level === 'error') console.error(line, ...args);
  else if (level === 'warn') console.warn(line, ...args);
  else console.log(line, ...args);
}

module.exports = {
  error: (...a) => log('error', ...a),
  warn: (...a) => log('warn', ...a),
  info: (...a) => log('info', ...a),
  debug: (...a) => log('debug', ...a),
};
