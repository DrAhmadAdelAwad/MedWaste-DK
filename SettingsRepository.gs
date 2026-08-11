/**
 * Persistence boundary for centralized application settings.
 */

function settingsRepositoryRead_() {
  var cached = cacheGetJson_(SETTINGS_CACHE_KEY);
  if (cached && typeof cached === 'object') return cached;

  var sheet = ensureSettingsSheet_(getSpreadsheet_());
  var obj = readSettingsObject_(sheet);
  cachePutJson_(SETTINGS_CACHE_KEY, obj, SETTINGS_CACHE_SECONDS);
  return obj;
}

function settingsRepositoryWrite_(obj) {
  var sheet = ensureSettingsSheet_(getSpreadsheet_());
  var rows = [SETTINGS_HEADERS];
  for (var i = 0; i < SETTINGS_KEYS.length; i++) {
    var key = SETTINGS_KEYS[i];
    rows.push([key, JSON.stringify(obj[key] != null ? obj[key] : defaultSettingValue_(key)), new Date()]);
  }

  // Write the complete replacement first. Never clear the current settings before
  // the new snapshot is safely written; otherwise a transient Sheets failure could
  // leave the application with an empty settings table.
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Remove only stale tail rows after the successful write.
  var lastRow = sheet.getLastRow();
  if (lastRow > rows.length) {
    sheet.getRange(rows.length + 1, 1, lastRow - rows.length, Math.max(SETTINGS_HEADERS.length, sheet.getLastColumn())).clearContent();
  }

  cachePutJson_(SETTINGS_CACHE_KEY, obj, SETTINGS_CACHE_SECONDS);
}
