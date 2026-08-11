/**
 * Idempotency coordinator for retry-safe mutating API actions.
 */

function isIdempotentMutationAction_(action) {
  return [
    API_ACTIONS.UPDATE_ROLE,
    API_ACTIONS.SAVE_SETTINGS,
    API_ACTIONS.ADD_RECORD,
    API_ACTIONS.ADD_RECORDS_BATCH,
    API_ACTIONS.DELETE_TRIP
  ].indexOf(clean_(action)) !== -1;
}

function idempotencyKey_(action, requestId) {
  var a = clean_(action);
  var rawRequestId = clean_(requestId);
  if (!a || !rawRequestId) return '';
  var r = normalizeRequestId_(rawRequestId);
  return a + ':' + r;
}

function parseIdempotentResponse_(raw) {
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

function isProcessingStale_(entry, now) {
  if (!entry || !entry.createdAt) return true;
  var created = entry.createdAt instanceof Date ? entry.createdAt : new Date(entry.createdAt);
  if (isNaN(created.getTime())) return true;
  return now.getTime() - created.getTime() > IDEMPOTENCY_PROCESSING_STALE_MINUTES * 60 * 1000;
}

function shouldPersistIdempotentResponse_(response) {
  if (!response || typeof response !== 'object') return false;
  if (response.result === 'success') return true;
  return [ERROR_CODES.BUSY, ERROR_CODES.SERVER_ERROR].indexOf(clean_(response.code)) === -1;
}

function beginIdempotentRequest_(action, requestId) {
  var key = idempotencyKey_(action, requestId);
  if (!key) return {state: 'BYPASS'};

  return withScriptLock_('idempotency_claim', function () {
    var now = new Date();
    if (typeof idempotencyRepositoryCount_ === 'function' && idempotencyRepositoryCount_() > 2000) {
      idempotencyRepositoryCleanupExpired_(now);
    }
    var existing = idempotencyRepositoryFind_(key);

    if (existing && existing.status === 'COMPLETED') {
      var replay = parseIdempotentResponse_(existing.responseJson);
      if (replay) return {state: 'REPLAY', response: replay};
    }

    if (existing && existing.status === 'PROCESSING' && !isProcessingStale_(existing, now)) {
      return {state: 'BUSY'};
    }

    var expires = new Date(now.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
    if (existing) {
      idempotencyRepositoryResetProcessing_(existing.rowNumber, now, expires);
      return {state: 'CLAIMED', key: key};
    }

    idempotencyRepositoryCreate_({
      key: key,
      requestId: requestId,
      action: action,
      createdAt: now,
      expiresAt: expires
    });
    var created = idempotencyRepositoryFind_(key);
    return {state: 'CLAIMED', key: key};
  });
}

function finishIdempotentRequest_(key, response) {
  if (!key) return;
  withScriptLock_('idempotency_complete', function () {
    var current = idempotencyRepositoryFind_(key);
    if (!current) return true;
    if (shouldPersistIdempotentResponse_(response)) {
      idempotencyRepositoryComplete_(current.rowNumber, response);
    } else {
      idempotencyRepositoryDelete_(current.rowNumber);
    }
    return true;
  });
}

function abandonIdempotentRequest_(key) {
  if (!key) return;
  withScriptLock_('idempotency_abandon', function () {
    var current = idempotencyRepositoryFind_(key);
    if (current) idempotencyRepositoryDelete_(current.rowNumber);
    return true;
  });
}

function executeIdempotentMutation_(action, params, work) {
  if (!isIdempotentMutationAction_(action)) return work();

  var started = beginIdempotentRequest_(action, params && params.requestId);
  if (started && started.result === 'error') return started;
  if (!started || started.state === 'BYPASS') return work();
  if (started.state === 'REPLAY') {
    var replay = started.response;
    replay.idempotentReplay = true;
    return replay;
  }
  if (started.state === 'BUSY') {
    return failure_(ERROR_CODES.BUSY, 'نفس الطلب ما زال قيد التنفيذ. سيتم إعادة المحاولة تلقائياً.', {retryAfterMs: 1000});
  }

  try {
    var response = work();
    finishIdempotentRequest_(started.key, response);
    return response;
  } catch (err) {
    abandonIdempotentRequest_(started.key);
    throw err;
  }
}
