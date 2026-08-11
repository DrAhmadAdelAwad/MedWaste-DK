/**
 * Application settings use cases.
 * Stage 8 uses centralized authorization and records administrative changes.
 */

function getSettings_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.GET_SETTINGS);
  if (!auth.ok) return auth.error;
  return success_({data: settingsRepositoryRead_()});
}

function saveSettings_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.SAVE_SETTINGS);
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
    safeAuditEvent_({
      params: p, auth: auth, action: API_ACTIONS.SAVE_SETTINGS,
      event: 'SETTINGS_UPDATED', result: 'SUCCESS',
      targetType: 'settings', targetId: 'central',
      metadata: {keys: SETTINGS_KEYS.slice()}
    });
    return success_();
  });
}
