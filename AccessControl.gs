/**
 * Centralized RBAC authorization.
 * Feature modules call requireActionAuth_ for defense in depth.
 */

function actionRoles_(action) {
  var key = clean_(action);
  return Object.prototype.hasOwnProperty.call(ACTION_ROLES, key) ? ACTION_ROLES[key] : null;
}

function isKnownAction_(action) {
  return actionRoles_(action) !== null;
}

function isPublicAction_(action) {
  var roles = actionRoles_(action);
  return Array.isArray(roles) && roles.length === 0;
}

function requireActionAuth_(params, action) {
  var roles = actionRoles_(action);
  if (roles === null) return {ok: false, error: failure_(ERROR_CODES.UNKNOWN_ACTION, 'عملية غير معروفة أو غير مسموح بها.')};
  if (!roles.length) return {ok: true, public: true};
  return requireAuth_(params, roles);
}

function authorizeAction_(params, action) {
  var auth = requireActionAuth_(params, action);
  if (!auth.ok) {
    safeAuditEvent_({
      params: params,
      auth: auth,
      action: action,
      event: 'ACCESS_DENIED',
      result: 'DENIED',
      targetType: 'action',
      targetId: clean_(action),
      metadata: {code: auth.error && auth.error.code ? auth.error.code : ERROR_CODES.FORBIDDEN}
    });
    return auth;
  }

  if (!auth.public && params && typeof params === 'object') params.__authContext = auth;
  return auth;
}
