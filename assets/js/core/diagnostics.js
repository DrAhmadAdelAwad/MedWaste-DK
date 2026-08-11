(function (MW) {
  'use strict';

  const { Config, Contracts, Session, Api } = MW;

  function snapshot() {
    let apiHost = '';
    try { apiHost = new URL(Config.apiUrl).host; } catch (_) {}
    return Object.freeze({
      appVersion: Config.appVersion,
      contractVersion: Contracts.version,
      environment: Config.environment,
      apiHost,
      loggedIn: Session.isLoggedIn(),
      online: typeof navigator === 'undefined' ? true : navigator.onLine,
      page: typeof window !== 'undefined' && window.location ? window.location.pathname : ''
    });
  }

  async function checkServer() {
    const startedAt = Date.now();
    const health = await Api.health();
    return Object.freeze({
      ok: health.result === 'success',
      latencyMs: Date.now() - startedAt,
      requestId: health.requestId || '',
      client: snapshot(),
      server: {
        appVersion: health.version || health.appVersion || '',
        contractVersion: health.contractVersion || '',
        environment: health.environment || '',
        serverTime: health.serverTime || ''
      }
    });
  }

  MW.Diagnostics = Object.freeze({ snapshot, checkServer });
})(window.MedWaste);
