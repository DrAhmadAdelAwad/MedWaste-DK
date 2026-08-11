/**
 * Structured request logging and correlation IDs.
 * Never logs request payloads, passwords, session tokens, or record contents.
 */

function normalizeRequestId_(value) {
  var id = clean_(value).replace(/[^A-Za-z0-9._:-]/g, '');
  if (!id) id = 'srv-' + Utilities.getUuid();
  return id.substring(0, 100);
}

function createRequestContext_(method, params) {
  params = params || {};
  return {
    requestId: normalizeRequestId_(params.requestId),
    method: clean_(method).toUpperCase() || 'UNKNOWN',
    action: clean_(params.action) || 'unknown',
    clientVersion: clean_(params.clientVersion),
    clientContractVersion: clean_(params.contractVersion),
    clientEnvironment: clean_(params.environment),
    startedAtMs: Date.now()
  };
}

function attachResponseMeta_(payload, context) {
  var out = payload && typeof payload === 'object' ? payload : failure_(ERROR_CODES.SERVER_ERROR, 'استجابة داخلية غير صالحة.');
  out.requestId = context.requestId;
  out.serverTime = new Date().toISOString();
  out.appVersion = APP_VERSION;
  out.contractVersion = API_CONTRACT_VERSION;
  out.environment = APP_ENVIRONMENT;
  return out;
}

function logLevelValue_(level) {
  var levels = {DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SILENT: 100};
  return levels[clean_(level).toUpperCase()] || 20;
}

function shouldLog_(level) {
  return logLevelValue_(level) >= logLevelValue_(APP_LOG_LEVEL);
}

function errorSummary_(err) {
  if (!err) return '';
  return clean_(err.message || err.toString()).substring(0, 500);
}

function logEvent_(level, eventName, meta) {
  level = clean_(level).toUpperCase() || 'INFO';
  if (!shouldLog_(level)) return;

  var entry = {
    time: new Date().toISOString(),
    level: level,
    event: clean_(eventName) || 'event',
    appVersion: APP_VERSION,
    environment: APP_ENVIRONMENT,
    meta: meta || {}
  };

  var line = JSON.stringify(entry);
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

function logRequestStarted_(context) {
  logEvent_('DEBUG', 'request_started', {
    requestId: context.requestId,
    method: context.method,
    action: context.action,
    clientVersion: context.clientVersion,
    clientContractVersion: context.clientContractVersion,
    clientEnvironment: context.clientEnvironment
  });
}

function logRequestFinished_(context, result) {
  var level = result && result.result === 'error' ? 'WARN' : 'INFO';
  logEvent_(level, 'request_finished', {
    requestId: context.requestId,
    method: context.method,
    action: context.action,
    result: result && result.result ? result.result : 'unknown',
    code: result && result.code ? result.code : '',
    durationMs: Date.now() - context.startedAtMs,
    clientContractVersion: context.clientContractVersion,
    serverContractVersion: API_CONTRACT_VERSION
  });
}

function logRequestException_(context, err) {
  logEvent_('ERROR', 'request_exception', {
    requestId: context.requestId,
    method: context.method,
    action: context.action,
    durationMs: Date.now() - context.startedAtMs,
    error: errorSummary_(err)
  });
}
