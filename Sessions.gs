/**
 * Session lifecycle and authorization use cases.
 * Stage 8 adds idle expiry, hashed-at-rest tokens and cached authorization context.
 */

function createSession_(email) {
  sessionRepositoryCleanupExpired_(new Date());
  var expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return sessionRepositoryCreate_(email, expires);
}

function requireAuth_(params, allowedRoles) {
  if (params && params.__authContext && params.__authContext.ok) {
    var cached = params.__authContext;
    if (!allowedRoles || !allowedRoles.length || allowedRoles.indexOf(cached.user.role) !== -1) return cached;
    return {ok: false, user: cached.user, error: failure_(ERROR_CODES.FORBIDDEN, 'ليس لديك صلاحية لتنفيذ هذه العملية.'), denialReason: 'ROLE'};
  }

  var token = clean_(params && params.token);
  if (!token) return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'), denialReason: 'MISSING_TOKEN'};

  var session = sessionRepositoryFindByToken_(token);
  if (!session) return {ok: false, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'جلسة الدخول غير صالحة.'), denialReason: 'INVALID_TOKEN'};

  var expires = session.expires instanceof Date ? session.expires : new Date(session.expires);
  if (isNaN(expires.getTime()) || expires <= new Date()) {
    sessionRepositoryDeleteByToken_(token);
    return {ok: false, sessionEmail: session.email, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'), denialReason: 'ABSOLUTE_EXPIRED'};
  }

  var lastUsed = session.lastUsed instanceof Date ? session.lastUsed : new Date(session.lastUsed);
  if (!isNaN(lastUsed.getTime()) && (Date.now() - lastUsed.getTime()) > SESSION_IDLE_MINUTES * 60 * 1000) {
    sessionRepositoryDeleteByToken_(token);
    return {ok: false, sessionEmail: session.email, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'انتهت الجلسة بسبب عدم النشاط. سجل الدخول مرة أخرى.'), denialReason: 'IDLE_EXPIRED'};
  }

  var found = userRepositoryFindByEmail_(session.email);
  if (!found) {
    sessionRepositoryDeleteByToken_(token);
    return {ok: false, sessionEmail: session.email, error: failure_(ERROR_CODES.AUTH_REQUIRED, 'الحساب غير موجود.'), denialReason: 'USER_NOT_FOUND'};
  }
  var user = found.authUser;

  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(user.role) === -1) {
    return {ok: false, user: user, sessionEmail: session.email, error: failure_(ERROR_CODES.FORBIDDEN, 'ليس لديك صلاحية لتنفيذ هذه العملية.'), denialReason: 'ROLE'};
  }

  var shouldTouch = isNaN(lastUsed.getTime()) || (Date.now() - lastUsed.getTime()) >= SESSION_TOUCH_INTERVAL_MINUTES * 60 * 1000;
  if (shouldTouch) sessionRepositoryTouch_(token);

  var auth = {ok: true, user: user, sessionEmail: session.email};
  if (params && typeof params === 'object') params.__authContext = auth;
  return auth;
}

function invalidateSessionsForEmail_(email) {
  return sessionRepositoryInvalidateEmail_(email);
}
