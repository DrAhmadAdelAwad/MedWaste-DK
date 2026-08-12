(function (MW) {
  'use strict';

  const { Config, Session, Contracts, Errors, Utils } = MW;
  const Logger = MW.Logger || { debug() {}, info() {}, warn() {}, error() {} };
  const RESERVED_KEYS = new Set(['action', 'requestId', 'clientVersion', 'contractVersion', 'environment', 'token']);
  const inFlightReads = new Map();
  const RETRYABLE_POST_ACTIONS = new Set([
    Contracts.Actions.LOGOUT,
    Contracts.Actions.UPDATE_ROLE,
    Contracts.Actions.SAVE_SETTINGS,
    Contracts.Actions.ADD_RECORD,
    Contracts.Actions.ADD_RECORDS_BATCH,
    Contracts.Actions.DELETE_TRIP
  ]);

  function warnOnContractMismatch(data, requestId) {
    if (!data?.contractVersion || data.contractVersion === Contracts.version) return;
    Logger.warn('api_contract_mismatch', {
      requestId,
      clientContractVersion: Contracts.version,
      serverContractVersion: data.contractVersion
    });
  }

  async function parseResponse(response, requestId) {
    if (!response.ok) {
      throw new Errors.AppError(`HTTP ${response.status}`, Contracts.ErrorCodes.NETWORK_ERROR, null, null, requestId);
    }

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) {
      throw new Errors.AppError('استجابة غير صالحة من الخادم.', Contracts.ErrorCodes.INVALID_RESPONSE, null, null, requestId);
    }

    if (!data || typeof data !== 'object' || !data.result) {
      throw new Errors.AppError('صيغة الاستجابة من الخادم غير متوقعة.', Contracts.ErrorCodes.INVALID_RESPONSE, null, null, requestId);
    }

    warnOnContractMismatch(data, requestId);

    if (data.result === 'error') {
      if (data.code === Contracts.ErrorCodes.AUTH_REQUIRED) {
        Session.clearUser();
        if (!/login\.html$/i.test(window.location.pathname)) {
          alert(data.message || 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.');
          window.location.href = 'login.html';
        }
      }
      throw Errors.fromApi(data);
    }
    return data;
  }

  function sleep(ms) { return new Promise(resolve => window.setTimeout(resolve, ms)); }

  function retryDelayMs(attempt, error) {
    const retry = Config.retry || {};
    const base = Math.max(0, Number(retry.baseDelayMs) || 500);
    const max = Math.max(base, Number(retry.maxDelayMs) || 4000);
    const exponential = Math.min(max, base * Math.pow(2, Math.max(0, attempt - 1)));
    const jitter = Math.floor(exponential * 0.25 * Math.random());
    const clientDelay = Math.min(max, exponential + jitter);
    const hinted = Number(error?.details?.retryAfterMs);
    if (Number.isFinite(hinted) && hinted > 0) return Math.min(max, Math.max(clientDelay, hinted));
    return clientDelay;
  }

  function maxAttemptsFor(meta) {
    if (!meta.retryable) return 1;
    const configured = Number(Config.retry?.maxAttempts) || 3;
    return Math.max(1, Math.min(5, configured));
  }

  async function request(url, options, meta) {
    const requestId = meta.requestId;
    const startedAt = Date.now();
    const maxAttempts = maxAttemptsFor(meta);
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), Config.requestTimeoutMs || 20000) : null;

      Logger.debug('api_request_started', {requestId, action: meta.action, method: options.method, attempt, maxAttempts});

      try {
        const response = await fetch(url, Object.assign({}, options, controller ? {signal: controller.signal} : {}));
        const data = await parseResponse(response, requestId);
        Logger.debug('api_request_succeeded', {
          requestId: data.requestId || requestId, action: meta.action, method: options.method,
          attempt, durationMs: Date.now() - startedAt
        });
        return data;
      } catch (error) {
        const normalized = Errors.fromNetwork(error, requestId);
        lastError = normalized;
        const canRetry = attempt < maxAttempts && meta.retryable && Errors.isRetryable(normalized);
        Logger[canRetry ? 'warn' : 'error']('api_request_failed', {
          requestId: normalized.requestId || requestId, action: meta.action, method: options.method,
          attempt, maxAttempts, retrying: canRetry, durationMs: Date.now() - startedAt, error: normalized
        });
        if (!canRetry) throw normalized;
        await sleep(retryDelayMs(attempt, normalized));
      } finally {
        if (timeoutId) window.clearTimeout(timeoutId);
      }
    }
    throw lastError || new Errors.AppError('فشلت العملية.', Contracts.ErrorCodes.SERVER_ERROR, null, null, requestId);
  }

  function appendDiagnostics(target) {
    target('clientVersion', Config.appVersion || '');
    target('contractVersion', Contracts.version || '');
    target('environment', Config.environment || '');
  }

  function createPostBody(action, payload, requestId, includeToken) {
    const formData = new FormData();
    formData.append('action', action);
    formData.append('requestId', requestId);
    appendDiagnostics((key, value) => formData.append(key, value));
    if (includeToken) {
      const token = Session.getToken();
      if (token) formData.append('token', token);
    }
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (!RESERVED_KEYS.has(key) && value != null) formData.append(key, value);
    });
    return formData;
  }

  async function get(action, params = {}) {
    const requestId = Utils.generateId('req-');
    const url = new URL(Config.apiUrl);
    url.searchParams.set('action', action);
    url.searchParams.set('requestId', requestId);
    appendDiagnostics((key, value) => url.searchParams.set(key, value));
    Object.entries(params).forEach(([key, value]) => {
      if (!RESERVED_KEYS.has(key) && value != null) url.searchParams.set(key, value);
    });
    // Security rule: authenticated tokens are never placed in URLs.
    return request(url.toString(), {method: 'GET', cache: 'no-store'}, {requestId, action, retryable: true});
  }

  async function read(action, params = {}) {
    /* Deduplicate identical protected reads fired by multiple widgets during the same page load. */
    const stable = Object.keys(params || {}).sort().map(key => `${key}=${String(params[key] ?? '')}`).join('&');
    const key = `${action}|${stable}`;
    if (inFlightReads.has(key)) return inFlightReads.get(key);
    const requestId = Utils.generateId('req-');
    const formData = createPostBody(action, params, requestId, true);
    const promise = request(Config.apiUrl, {method: 'POST', body: formData}, {requestId, action, retryable: true})
      .finally(() => inFlightReads.delete(key));
    inFlightReads.set(key, promise);
    return promise;
  }

  async function post(action, payload = {}) {
    const requestId = Utils.generateId('req-');
    const includeToken = !Contracts.isPublic(action);
    const formData = createPostBody(action, payload, requestId, includeToken);
    return request(
      Config.apiUrl,
      {method: 'POST', body: formData},
      {requestId, action, retryable: RETRYABLE_POST_ACTIONS.has(action)}
    );
  }


  function postDetached(action, payload = {}) {
    const requestId = Utils.generateId('req-');
    const includeToken = !Contracts.isPublic(action);
    const formData = createPostBody(action, payload, requestId, includeToken);
    try {
      if (navigator && typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(Config.apiUrl, formData)) return true;
    } catch (_) {}
    try { fetch(Config.apiUrl, {method:'POST', body:formData, keepalive:true}).catch(()=>{}); return true; } catch (_) { return false; }
  }

  async function health() { return get(Contracts.Actions.HEALTH); }

  MW.Api = Object.freeze({get, read, post, postDetached, health});
})(window.MedWaste);
