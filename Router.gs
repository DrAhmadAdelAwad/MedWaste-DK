/**
 * HTTP action router.
 * Stage 8 centralizes authorization before dispatch and prevents protected GET URLs.
 */

function routePost_(params) {
  var action = clean_(params.action);
  if (!isKnownAction_(action)) return failure_(ERROR_CODES.UNKNOWN_ACTION, 'عملية غير معروفة أو غير مسموح بها.');

  var authorization = authorizeAction_(params, action);
  if (!authorization.ok) return authorization.error;

  switch (action) {
    case API_ACTIONS.REGISTER:
      return register_(params);
    case API_ACTIONS.LOGIN:
      return login_(params);
    case API_ACTIONS.LOGOUT:
      return logout_(params);
    case API_ACTIONS.FORGOT_PASSWORD:
      return forgotPassword_(params);
    case API_ACTIONS.UPDATE_ROLE:
      return executeIdempotentMutation_(action, params, function () { return updateRole_(params); });
    case API_ACTIONS.SAVE_SETTINGS:
      return executeIdempotentMutation_(action, params, function () { return saveSettings_(params); });
    case API_ACTIONS.ADD_RECORD:
      return executeIdempotentMutation_(action, params, function () { return addRecords_(params, false); });
    case API_ACTIONS.ADD_RECORDS_BATCH:
      return executeIdempotentMutation_(action, params, function () { return addRecords_(params, true); });
    case API_ACTIONS.DELETE_TRIP:
      return executeIdempotentMutation_(action, params, function () { return deleteTrip_(params); });
    case API_ACTIONS.GET_RECORDS:
      return getRecords_(params);
    case API_ACTIONS.GET_SETTINGS:
      return getSettings_(params);
    case API_ACTIONS.GET_USERS:
      return getUsers_(params);
    case API_ACTIONS.GET_ME:
      return getMe_(params);
    case API_ACTIONS.GET_AUDIT_LOG:
      return getAuditLog_(params);
    case API_ACTIONS.HEALTH:
      return success_({
        message: 'OK',
        version: APP_VERSION,
        contractVersion: API_CONTRACT_VERSION,
        environment: APP_ENVIRONMENT
      });
    default:
      return failure_(ERROR_CODES.UNKNOWN_ACTION, 'عملية غير معروفة أو غير مسموح بها.');
  }
}

function routeGet_(params) {
  var action = clean_(params.action);

  if (action === API_ACTIONS.HEALTH) {
    return success_({
      message: 'OK',
      version: APP_VERSION,
      contractVersion: API_CONTRACT_VERSION,
      environment: APP_ENVIRONMENT
    });
  }

  if (isKnownAction_(action)) {
    return failure_(
      ERROR_CODES.METHOD_NOT_ALLOWED,
      'هذه العملية المحمية يجب تنفيذها عبر القناة الآمنة المخصصة لها.'
    );
  }

  return failure_(ERROR_CODES.UNKNOWN_ACTION, 'عملية غير معروفة أو غير مسموح بها.');
}
