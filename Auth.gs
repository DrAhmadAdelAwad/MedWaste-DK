/**
 * Authentication use cases.
 * Stage 8 adds login abuse throttling, generic password-reset responses,
 * audit events and centralized action authorization.
 */

function register_(p) {
  var validationError = validateRegistrationInput_(p);
  if (validationError) return validationError;

  var email = normalizeEmail_(p.email);
  return withScriptLock_('register_user', function () {
    if (userRepositoryFindByEmail_(email)) {
      safeAuditEvent_({
        params: p, action: API_ACTIONS.REGISTER, event: 'REGISTER_REJECTED',
        result: 'DENIED', targetType: 'user', targetId: email,
        metadata: {code: ERROR_CODES.EMAIL_EXISTS}
      });
      return failure_(ERROR_CODES.EMAIL_EXISTS, 'هذا الإيميل مسجل مسبقاً');
    }

    var role = userRepositoryIsEmpty_() ? ROLES.ADMIN : ROLES.DATA_ENTRY;
    userRepositoryAppend_({
      fullName: clean_(p.fullName),
      jobTitle: clean_(p.jobTitle),
      workplace: clean_(p.workplace),
      mobile: clean_(p.mobile),
      email: email,
      passwordHash: hashPassword_(clean_(p.password)),
      role: role
    });

    safeAuditEvent_({
      params: p,
      action: API_ACTIONS.REGISTER,
      event: 'USER_REGISTERED',
      result: 'SUCCESS',
      actor: {email: email, name: clean_(p.fullName), role: role},
      targetType: 'user',
      targetId: email,
      metadata: {assignedRole: role}
    });

    return success_();
  });
}

function login_(p) {
  var validationError = validateLoginInput_(p);
  if (validationError) return validationError;

  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);

  var blocked = rateLimitCheck_('login', email, LOGIN_MAX_FAILURES, LOGIN_RATE_WINDOW_SECONDS);
  if (blocked) {
    safeAuditEvent_({
      params: p, action: API_ACTIONS.LOGIN, event: 'LOGIN_RATE_LIMITED',
      result: 'DENIED', targetType: 'user', targetId: email,
      metadata: {code: ERROR_CODES.RATE_LIMITED}
    });
    return blocked;
  }

  var found = userRepositoryFindByEmail_(email);
  if (!found || !verifyPassword_(password, clean_(found.row[6]))) {
    rateLimitRecord_('login', email, LOGIN_RATE_WINDOW_SECONDS);
    safeAuditEvent_({
      params: p, action: API_ACTIONS.LOGIN, event: 'LOGIN_FAILED',
      result: 'DENIED', targetType: 'user', targetId: email,
      metadata: {code: ERROR_CODES.INVALID_LOGIN}
    });
    return failure_(ERROR_CODES.INVALID_LOGIN, 'بيانات الدخول غير صحيحة');
  }

  var stored = clean_(found.row[6]);
  if (stored.indexOf('sha256$') !== 0) {
    userRepositoryUpdatePassword_(found.rowNumber, hashPassword_(password));
  }

  rateLimitReset_('login', email);
  var token = createSession_(email);
  var user = found.authUser;
  user.sessionToken = token;

  safeAuditEvent_({
    params: p,
    action: API_ACTIONS.LOGIN,
    event: 'LOGIN_SUCCEEDED',
    result: 'SUCCESS',
    actor: {email: user.email, name: user.fullName, role: user.role},
    targetType: 'session',
    targetId: 'created',
    metadata: {role: user.role}
  });

  return success_({user: user});
}

function logout_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.LOGOUT);
  if (!auth.ok) return auth.error;

  var token = clean_(p.token);
  if (token) sessionRepositoryDeleteByToken_(token);

  safeAuditEvent_({
    params: p, auth: auth, action: API_ACTIONS.LOGOUT,
    event: 'LOGOUT', result: 'SUCCESS', targetType: 'session', targetId: 'current'
  });
  return success_();
}

function forgotPassword_(p) {
  var email = normalizeEmail_(p.email);
  if (!email) return failure_(ERROR_CODES.VALIDATION, 'أدخل الإيميل.');
  if (!isValidEmail_(email)) return failure_(ERROR_CODES.VALIDATION, 'صيغة الإيميل غير صحيحة.');

  var genericSuccess = function () {
    return success_({message: 'إذا كان البريد مسجلاً، سيتم إرسال تعليمات استعادة كلمة المرور إليه.'});
  };

  var limited = consumeRateLimit_('password_reset', email, PASSWORD_RESET_MAX_REQUESTS, PASSWORD_RESET_RATE_WINDOW_SECONDS);
  if (limited) {
    safeAuditEvent_({
      params: p, action: API_ACTIONS.FORGOT_PASSWORD, event: 'PASSWORD_RESET_RATE_LIMITED',
      result: 'DENIED', targetType: 'user', targetId: email,
      metadata: {code: ERROR_CODES.RATE_LIMITED}
    });
    return limited;
  }

  return withScriptLock_('forgot_password', function () {
    var found = userRepositoryFindByEmail_(email);
    if (!found) {
      safeAuditEvent_({
        params: p, action: API_ACTIONS.FORGOT_PASSWORD, event: 'PASSWORD_RESET_REQUESTED',
        result: 'IGNORED', targetType: 'user', targetId: sha256Hex_(email).substring(0, 16),
        metadata: {accountFound: false}
      });
      return genericSuccess();
    }

    var tempPassword = makeTemporaryPassword_();
    var previousPassword = clean_(found.row[6]);
    var temporaryHash = hashPassword_(tempPassword);

    try {
      userRepositoryUpdatePassword_(found.rowNumber, temporaryHash);
    } catch (persistErr) {
      logEvent_('ERROR', 'password_reset_persist_failed', {action: API_ACTIONS.FORGOT_PASSWORD, error: errorSummary_(persistErr)});
      return failure_(ERROR_CODES.SERVER_ERROR, 'تعذر تحديث كلمة المرور مؤقتاً. حاول مرة أخرى.');
    }

    try {
      MailApp.sendEmail(
        email,
        'استعادة كلمة المرور - منظومة النفايات',
        'مرحباً ' + found.user.fullName + '،\n\nتم إنشاء كلمة مرور مؤقتة جديدة لحسابك:\n' + tempPassword +
        '\n\nاستخدمها في تسجيل الدخول. تم إلغاء الجلسات القديمة لحماية الحساب.'
      );
    } catch (mailErr) {
      try { userRepositoryUpdatePassword_(found.rowNumber, previousPassword); } catch (rollbackErr) {
        logEvent_('ERROR', 'password_reset_rollback_failed', {action: API_ACTIONS.FORGOT_PASSWORD, error: errorSummary_(rollbackErr)});
      }
      logEvent_('ERROR', 'password_reset_mail_failed', {action: API_ACTIONS.FORGOT_PASSWORD, error: errorSummary_(mailErr)});
      safeAuditEvent_({
        params: p, action: API_ACTIONS.FORGOT_PASSWORD, event: 'PASSWORD_RESET_FAILED',
        result: 'ERROR', targetType: 'user', targetId: email,
        metadata: {code: ERROR_CODES.MAIL_ERROR}
      });
      return failure_(ERROR_CODES.MAIL_ERROR, 'حدث خطأ أثناء إرسال الإيميل');
    }

    try { invalidateSessionsForEmail_(email); } catch (sessionErr) {
      logEvent_('ERROR', 'password_reset_session_cleanup_failed', {action: API_ACTIONS.FORGOT_PASSWORD, error: errorSummary_(sessionErr)});
    }

    safeAuditEvent_({
      params: p, action: API_ACTIONS.FORGOT_PASSWORD, event: 'PASSWORD_RESET_SUCCEEDED',
      result: 'SUCCESS', targetType: 'user', targetId: email,
      metadata: {sessionsInvalidated: true}
    });
    return genericSuccess();
  });
}

function getMe_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.GET_ME);
  if (!auth.ok) return auth.error;
  return success_({data: auth.user});
}
