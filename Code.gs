/**
 * MedWaste DK - Google Apps Script entry points.
 * Business logic lives in dedicated backend modules.
 * Stage 8: secure bootstrap + backend installation verification.
 */

function safeJsonResponse_(obj) {
  if (typeof json_ === 'function') return json_(obj);
  return ContentService
    .createTextOutput(JSON.stringify(obj || {}))
    .setMimeType(ContentService.MimeType.JSON);
}

function fallbackRequestContext_(method, params) {
  params = params || {};
  var requestId = params.requestId ? String(params.requestId).trim() : '';
  if (!requestId) requestId = 'srv-' + Utilities.getUuid();
  return {
    requestId: requestId.substring(0, 100),
    method: method ? String(method).toUpperCase() : 'UNKNOWN',
    action: params.action ? String(params.action).trim() : 'unknown',
    startedAtMs: Date.now()
  };
}

function fallbackFailure_(err, context) {
  var code = (typeof ERROR_CODES !== 'undefined' && ERROR_CODES.SERVER_ERROR)
    ? ERROR_CODES.SERVER_ERROR
    : 'SERVER_ERROR';

  var payload = {
    result: 'error',
    code: code,
    message: 'حدث خطأ داخلي في الخادم.',
    requestId: context && context.requestId ? context.requestId : '',
    serverTime: new Date().toISOString()
  };

  // This diagnostic is intentionally limited to the exception summary and
  // contains no request payload, password, or session token.
  if (err) payload.diagnostic = String(err.message || err).substring(0, 500);

  if (typeof APP_VERSION !== 'undefined') payload.appVersion = APP_VERSION;
  if (typeof API_CONTRACT_VERSION !== 'undefined') payload.contractVersion = API_CONTRACT_VERSION;
  if (typeof APP_ENVIRONMENT !== 'undefined') payload.environment = APP_ENVIRONMENT;

  return payload;
}

function handleHttpRequest_(method, e, router) {
  var params = (e && e.parameter) ? e.parameter : {};
  var context = fallbackRequestContext_(method, params);

  try {
    if (typeof createRequestContext_ === 'function') {
      context = createRequestContext_(method, params);
    }

    if (typeof logRequestStarted_ === 'function') logRequestStarted_(context);
    if (typeof router !== 'function') throw new Error('Backend router is not available. Check Router.gs.');

    var result = router(params);
    if (typeof logRequestFinished_ === 'function') logRequestFinished_(context, result);

    if (typeof attachResponseMeta_ === 'function') {
      result = attachResponseMeta_(result, context);
    }

    return safeJsonResponse_(result);
  } catch (err) {
    try {
      if (typeof logRequestException_ === 'function') logRequestException_(context, err);
    } catch (logErr) {
      // Never allow logging failure to hide the original exception.
    }

    var payload;
    try {
      var serverErrorCode = (typeof ERROR_CODES !== 'undefined' && ERROR_CODES.SERVER_ERROR)
        ? ERROR_CODES.SERVER_ERROR
        : 'SERVER_ERROR';
      payload = (typeof failure_ === 'function')
        ? failure_(serverErrorCode, 'حدث خطأ داخلي في الخادم.')
        : fallbackFailure_(err, context);

      if (typeof attachResponseMeta_ === 'function') {
        payload = attachResponseMeta_(payload, context);
      } else if (!payload.diagnostic) {
        payload.diagnostic = String(err.message || err).substring(0, 500);
      }
    } catch (fallbackErr) {
      payload = fallbackFailure_(err, context);
    }

    return safeJsonResponse_(payload);
  }
}

function doPost(e) {
  return handleHttpRequest_('POST', e, (typeof routePost_ === 'function') ? routePost_ : null);
}

function doGet(e) {
  return handleHttpRequest_('GET', e, (typeof routeGet_ === 'function') ? routeGet_ : null);
}

/**
 * Run this manually before setupSystem() after copying backend files.
 * It does not read or write Google Sheets.
 */
function verifyBackendInstallation() {
  var checks = [
    ['Config.gs', 'APP_VERSION', typeof APP_VERSION !== 'undefined'],
    ['Contracts.gs', 'API_ACTIONS', typeof API_ACTIONS !== 'undefined'],
    ['Contracts.gs', 'ACTION_ROLES', typeof ACTION_ROLES !== 'undefined'],
    ['Utils.gs', 'json_', typeof json_ === 'function'],
    ['Utils.gs', 'clean_', typeof clean_ === 'function'],
    ['Utils.gs', 'success_', typeof success_ === 'function'],
    ['Utils.gs', 'failure_', typeof failure_ === 'function'],
    ['Logging.gs', 'createRequestContext_', typeof createRequestContext_ === 'function'],
    ['Logging.gs', 'attachResponseMeta_', typeof attachResponseMeta_ === 'function'],
    ['Logging.gs', 'sanitizeLogMeta_', typeof sanitizeLogMeta_ === 'function'],
    ['Concurrency.gs', 'withScriptLock_', typeof withScriptLock_ === 'function'],
    ['Cache.gs', 'cacheGetJson_', typeof cacheGetJson_ === 'function'],
    ['RateLimit.gs', 'rateLimitCheck_', typeof rateLimitCheck_ === 'function'],
    ['AccessControl.gs', 'authorizeAction_', typeof authorizeAction_ === 'function'],
    ['Audit.gs', 'safeAuditEvent_', typeof safeAuditEvent_ === 'function'],
    ['AuditRepository.gs', 'auditRepositoryAppend_', typeof auditRepositoryAppend_ === 'function'],
    ['Idempotency.gs', 'executeIdempotentMutation_', typeof executeIdempotentMutation_ === 'function'],
    ['IdempotencyRepository.gs', 'idempotencyRepositoryFind_', typeof idempotencyRepositoryFind_ === 'function'],
    ['Router.gs', 'routeGet_', typeof routeGet_ === 'function'],
    ['Router.gs', 'routePost_', typeof routePost_ === 'function'],
    ['Sheets.gs', 'getSpreadsheet_', typeof getSpreadsheet_ === 'function'],
    ['Sheets.gs', 'ensureAuditSheet_', typeof ensureAuditSheet_ === 'function'],
    ['Security.gs', 'hashPassword_', typeof hashPassword_ === 'function'],
    ['Security.gs', 'sessionTokenHash_', typeof sessionTokenHash_ === 'function'],
    ['Validators.gs', 'validateRecordInput_', typeof validateRecordInput_ === 'function'],
    ['RecordMapper.gs', 'recordFromRow_', typeof recordFromRow_ === 'function'],
    ['RecordRepository.gs', 'recordRepositoryFindAll_', typeof recordRepositoryFindAll_ === 'function'],
    ['UserMapper.gs', 'userFromRow_', typeof userFromRow_ === 'function'],
    ['UserRepository.gs', 'userRepositoryList_', typeof userRepositoryList_ === 'function'],
    ['SettingsRepository.gs', 'settingsRepositoryRead_', typeof settingsRepositoryRead_ === 'function'],
    ['SessionRepository.gs', 'sessionRepositoryFindByToken_', typeof sessionRepositoryFindByToken_ === 'function'],
    ['SessionRepository.gs', 'sessionRepositoryMigrateLegacyTokens_', typeof sessionRepositoryMigrateLegacyTokens_ === 'function'],
    ['IdempotencyRepository.gs', 'idempotencyRepositoryCleanupExpired_', typeof idempotencyRepositoryCleanupExpired_ === 'function'],
    ['Sessions.gs', 'requireAuth_', typeof requireAuth_ === 'function'],
    ['Auth.gs', 'login_', typeof login_ === 'function'],
    ['Records.gs', 'getRecords_', typeof getRecords_ === 'function'],
    ['Settings.gs', 'getSettings_', typeof getSettings_ === 'function'],
    ['Users.gs', 'getUsers_', typeof getUsers_ === 'function'],
    ['Audit.gs', 'getAuditLog_', typeof getAuditLog_ === 'function'],
    ['SelfTests.gs', 'runSelfTests', typeof runSelfTests === 'function']
  ];

  var missing = [];
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i][2]) missing.push({file: checks[i][0], symbol: checks[i][1]});
  }

  return {
    result: missing.length ? 'error' : 'success',
    message: missing.length ? 'Backend installation is incomplete.' : 'Backend installation is complete.',
    checked: checks.length,
    missing: missing
  };
}

/** Run once manually after adding/updating all backend files. */
function setupSystem() {
  var verification = verifyBackendInstallation();
  if (verification.result !== 'success') {
    throw new Error('Backend files are incomplete: ' + JSON.stringify(verification.missing));
  }

  var ss = getSpreadsheet_();
  ensureUsersSheet_(ss);
  ensureSettingsSheet_(ss);
  ensureSessionsSheet_(ss);
  try { sessionRepositoryMigrateLegacyTokens_(); } catch (err) {}
  ensureIdempotencySheet_(ss);
  ensureAuditSheet_(ss);
  ensureDataSheet_(ss);
  try { idempotencyRepositoryCleanupExpired_(new Date()); } catch (err) {}
  try { auditRepositoryCleanupOld_(new Date()); } catch (err) {}
  return 'System ready - v' + APP_VERSION;
}
