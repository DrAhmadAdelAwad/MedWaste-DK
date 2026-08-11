(function (MW) {
  'use strict';

  const Config = MW.Config || {};
  const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40, silent: 100 });
  const REDACTED = '[REDACTED]';
  const SENSITIVE_KEY = /(password|token|secret|authorization|credential)/i;

  function configuredLevel() {
    const value = String(Config.logLevel || 'warn').toLowerCase();
    return Object.prototype.hasOwnProperty.call(LEVELS, value) ? value : 'warn';
  }

  function shouldLog(level) {
    return (LEVELS[level] || LEVELS.info) >= LEVELS[configuredLevel()];
  }

  function sanitize(value, depth = 0, seen = new WeakSet()) {
    if (value == null) return value;
    if (depth > 4) return '[MaxDepth]';
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        code: value.code,
        requestId: value.requestId
      };
    }
    if (typeof value !== 'object') return value;
    if (seen.has(value)) return '[Circular]';
    seen.add(value);

    if (Array.isArray(value)) return value.slice(0, 50).map(item => sanitize(item, depth + 1, seen));

    const clean = {};
    Object.keys(value).slice(0, 80).forEach(key => {
      clean[key] = SENSITIVE_KEY.test(key) ? REDACTED : sanitize(value[key], depth + 1, seen);
    });
    return clean;
  }

  function write(level, event, meta) {
    if (!shouldLog(level)) return;
    const payload = {
      time: new Date().toISOString(),
      level: level.toUpperCase(),
      event: String(event || 'event'),
      appVersion: Config.appVersion || '',
      environment: Config.environment || '',
      page: typeof window !== 'undefined' && window.location ? window.location.pathname : '',
      meta: sanitize(meta || {})
    };
    const method = console[level] ? level : 'log';
    console[method]('[MedWaste]', payload);
  }

  function debug(event, meta) { write('debug', event, meta); }
  function info(event, meta) { write('info', event, meta); }
  function warn(event, meta) { write('warn', event, meta); }
  function error(event, meta) { write('error', event, meta); }

  function installGlobalHandlers() {
    if (typeof window === 'undefined' || window.__medWasteLoggerInstalled) return;
    window.__medWasteLoggerInstalled = true;

    window.addEventListener('error', event => {
      error('window_error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        error: event.error
      });
    });

    window.addEventListener('unhandledrejection', event => {
      error('unhandled_rejection', { error: event.reason });
    });
  }

  MW.Logger = Object.freeze({ debug, info, warn, error, sanitize, installGlobalHandlers });
  installGlobalHandlers();
})(window.MedWaste);
