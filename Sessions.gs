/**
 * Session lifecycle and authorization use cases.
 * Session persistence is delegated to SessionRepository.gs.
 */

function createSession_(email) {
  sessionRepositoryCleanupExpired_(new Date());
  var expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return sessionRepositoryCreate_(email, expires);
}

function requireAuth_(params, allowedRoles) {
  var token = clean_(params && params.token);
  if (!token) return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.')};

  var session = sessionRepositoryFindByToken_(token);
  if (!session) return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'جلسة الدخول غير صالحة.')};

  var expires = session.expires instanceof Date ? session.expires : new Date(session.expires);
  if (isNaN(expires.getTime()) || expires <= new Date()) {
    sessionRepositoryDeleteByToken_(token);
    return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.')};
  }

  var found = userRepositoryFindByEmail_(session.email);
  if (!found) return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'الحساب غير موجود.')};
  var user = found.authUser;

  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(user.role) === -1) {
    return {ok: false, error: failure_(ERROR_CODES.FORBIDDEN, 'ليس لديك صلاحية لتنفيذ هذه العملية.')};
  }

  var lastUsed = session.lastUsed instanceof Date ? session.lastUsed : new Date(session.lastUsed);
  var shouldTouch = isNaN(lastUsed.getTime()) || (Date.now() - lastUsed.getTime()) >= SESSION_TOUCH_INTERVAL_MINUTES * 60 * 1000;
  if (shouldTouch) sessionRepositoryTouch_(token);
  return {ok: true, user: user};
}

function invalidateSessionsForEmail_(email) {
  sessionRepositoryInvalidateEmail_(email);
}
