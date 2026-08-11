/**
 * Application settings use cases.
 * Persistence is delegated to SettingsRepository.gs.
 */

function getSettings_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;
  return success_({data: settingsRepositoryRead_()});
}

function saveSettings_(p) {
  var auth = requireAuth_(p, [ROLES.ADMIN]);
  if (!auth.ok) return auth.error;

  var raw = clean_(p.settingsData);
  if (!raw) return failure_(ERROR_CODES.VALIDATION, 'بيانات الإعدادات فارغة.');
  if (raw.length > API_LIMITS.SETTINGS_JSON_MAX_LENGTH) return failure_(ERROR_CODES.VALIDATION, 'حجم بيانات الإعدادات أكبر من الحد المسموح.');

  var obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    return failure_(ERROR_CODES.INVALID_JSON, 'صيغة الإعدادات غير صحيحة.');
  }

  var validationError = validateSettingsObject_(obj);
  if (validationError) return validationError;

  return withScriptLock_('save_settings', function () {
    settingsRepositoryWrite_(obj);
    return success_();
  });
}
