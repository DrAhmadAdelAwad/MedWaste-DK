(function (MW) {
  'use strict';

  const ENVIRONMENT = 'production';

  const PROFILES = Object.freeze({
    production: Object.freeze({
      apiUrl: 'https://script.google.com/macros/s/AKfycby3fbtG-5YHmHkPF6O-zq9sHE1X20iM8jmwEF_z-aAy0dYFTfDoUoNypms7Luk4NJDuIw/exec',
      requestTimeoutMs: 18000,
      logLevel: 'warn',
      retry: Object.freeze({maxAttempts: 2, baseDelayMs: 500, maxDelayMs: 4000})
    }),
    development: Object.freeze({
      apiUrl: 'https://script.google.com/macros/s/AKfycby3fbtG-5YHmHkPF6O-zq9sHE1X20iM8jmwEF_z-aAy0dYFTfDoUoNypms7Luk4NJDuIw/exec',
      requestTimeoutMs: 30000,
      logLevel: 'debug',
      retry: Object.freeze({maxAttempts: 2, baseDelayMs: 250, maxDelayMs: 2000})
    })
  });

  const active = PROFILES[ENVIRONMENT] || PROFILES.production;

  MW.Config = Object.freeze({
    appVersion: '8.5.2',
    environment: ENVIRONMENT,
    apiUrl: active.apiUrl,
    requestTimeoutMs: active.requestTimeoutMs,
    logLevel: active.logLevel,
    retry: active.retry
  });
})(window.MedWaste);
