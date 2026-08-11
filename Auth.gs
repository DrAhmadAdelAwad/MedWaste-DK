/**
 * Authentication use cases: registration, login, logout, password recovery and current user.
 * User persistence is delegated to UserRepository.gs.
 */

function register_(p) {
  var validationError = validateRegistrationInput_(p);
  if (validationError) return validationError;

  var email = normalizeEmail_(p.email);
  return withScriptLock_('register_user', function () {
    if (userRepositoryFindByEmail_(email)) {
      return failure_(ERROR_CODES.EMAIL_EXISTS, 'هذا الإيميل مسجل مسبقاً');
    }

    userRepositoryAppend_({
      fullName: clean_(p.fullName),
      jobTitle: clean_(p.jobTitle),
      workplace: clean_(p.workplace),
      mobile: clean_(p.mobile),
      email: email,
      passwordHash: hashPassword_(clean_(p.password)),
      role: userRepositoryIsEmpty_() ? ROLES.ADMIN : ROLES.DATA_ENTRY
    });

    return success_();
  });
}

function login_(p) {
  var validationError = validateLoginInput_(p);
  if (validationError) return validationError;

  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);
  var found = userRepositoryFindByEmail_(email);
  if (!found) return failure_(ERROR_CODES.INVALID_LOGIN, 'بيانات الدخول غير صحيحة');

  var stored = clean_(found.row[6]);
  if (!verifyPassword_(password, stored)) {
    return failure_(ERROR_CODES.INVALID_LOGIN, 'بيانات الدخول غير صحيحة');
  }

  // Automatic migration from legacy plain-text password to salted SHA-256.
  if (stored.indexOf('sha256$') !== 0) {
    userRepositoryUpdatePassword_(found.rowNumber, hashPassword_(password));
  }

  var token = createSession_(email);
  var user = found.authUser;
  user.sessionToken = token;
  return success_({user: user});
}

function logout_(p) {
  var token = clean_(p.token);
  if (token) sessionRepositoryDeleteByToken_(token);
  return success_();
}

function forgotPassword_(p) {
  var email = normalizeEmail_(p.email);
  if (!email) return failure_(ERROR_CODES.VALIDATION, 'أدخل الإيميل.');
  if (!isValidEmail_(email)) return failure_(ERROR_CODES.VALIDATION, 'صيغة الإيميل غير صحيحة.');

  return withScriptLock_('forgot_password', function () {
    var found = userRepositoryFindByEmail_(email);
    if (!found) return failure_(ERROR_CODES.EMAIL_NOT_FOUND, 'الإيميل غير مسجل في النظام');

    var tempPassword = makeTemporaryPassword_();
    var previousPassword = clean_(found.row[6]);
    var temporaryHash = hashPassword_(tempPassword);

    // Persist the temporary credential before notifying the user. If email
    // delivery fails, restore the previous credential so the account remains usable.
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
      return failure_(ERROR_CODES.MAIL_ERROR, 'حدث خطأ أثناء إرسال الإيميل');
    }

    try { invalidateSessionsForEmail_(email); } catch (sessionErr) {
      // Password reset itself succeeded. Do not invalidate the emailed password
      // because session cleanup had a secondary failure; log it for diagnosis.
      logEvent_('ERROR', 'password_reset_session_cleanup_failed', {action: API_ACTIONS.FORGOT_PASSWORD, error: errorSummary_(sessionErr)});
    }
    return success_();
  });
}

function getMe_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;
  return success_({data: auth.user});
}
