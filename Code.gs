/**
 * MedWaste DK - Google Apps Script backend
 * Stable API + automatic migration for the legacy spreadsheet structure.
 */

var DATA_SHEET = 'السجلات';
var USERS_SHEET = 'المستخدمين';
var SETTINGS_SHEET = 'الإعدادات';
var SESSIONS_SHEET = '_الجلسات';
var SESSION_DAYS = 7;

var DATA_HEADERS = [
  'التوقيت', 'تاريخ البلاغ', 'وحدة المعالجة', 'السائق', 'رقم السيارة',
  'التصنيف الرئيسي', 'الإدارة الصحية', 'اسم المنشأة / الوحدة', 'طبيعة الزيارة',
  'الوزن', 'الوحدة', 'بواسطة', 'معرف السجل', 'معرف الرحلة'
];

var USER_HEADERS = ['التوقيت', 'الاسم', 'الوظيفة', 'جهة العمل', 'الموبايل', 'الإيميل', 'كلمة السر', 'الصلاحية'];
var SETTINGS_HEADERS = ['المفتاح', 'القيمة JSON', 'آخر تحديث'];
var SESSION_HEADERS = ['الرمز', 'الإيميل', 'تاريخ الانتهاء', 'آخر استخدام'];
var SETTINGS_KEYS = ['healthAdmins', 'cars', 'drivers', 'govFacilities', 'privateFacilities', 'privateCompanies'];

function doPost(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = clean_(params.action);

    switch (action) {
      case 'register':
        return json_(register_(params));
      case 'login':
        return json_(login_(params));
      case 'logout':
        return json_(logout_(params));
      case 'forgot_password':
        return json_(forgotPassword_(params));
      case 'update_role':
        return json_(updateRole_(params));
      case 'save_settings':
        return json_(saveSettings_(params));
      case 'add_record':
        return json_(addRecords_(params, false));
      case 'add_records_batch':
        return json_(addRecords_(params, true));
      case 'delete_trip':
        return json_(deleteTrip_(params));
      default:
        return json_({result: 'error', code: 'UNKNOWN_ACTION', message: 'عملية غير معروفة أو غير مسموح بها.'});
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({result: 'error', code: 'SERVER_ERROR', message: 'حدث خطأ داخلي في الخادم.'});
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = clean_(params.action);

    switch (action) {
      case 'get_records':
        return json_(getRecords_(params));
      case 'get_settings':
        return json_(getSettings_(params));
      case 'get_users':
        return json_(getUsers_(params));
      case 'get_me':
        return json_(getMe_(params));
      case 'health':
        return json_({result: 'success', message: 'OK', version: '2.0'});
      default:
        return json_({result: 'error', code: 'UNKNOWN_ACTION', message: 'حدد action صالحًا.'});
    }
  } catch (err) {
    console.error(err && err.stack ? err.stack : err);
    return json_({result: 'error', code: 'SERVER_ERROR', message: 'حدث خطأ داخلي في الخادم.'});
  }
}

/** Run once manually after pasting the code if you want to migrate immediately. */
function setupSystem() {
  var ss = getSpreadsheet_();
  ensureUsersSheet_(ss);
  ensureSettingsSheet_(ss);
  ensureSessionsSheet_(ss);
  ensureDataSheet_(ss);
  return 'System ready';
}

function register_(p) {
  var ss = getSpreadsheet_();
  var sheet = ensureUsersSheet_(ss);
  var fullName = clean_(p.fullName);
  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);

  if (!fullName || !email || !password) {
    return {result: 'error', code: 'VALIDATION', message: 'الاسم والإيميل وكلمة المرور مطلوبة.'};
  }
  if (password.length < 6) {
    return {result: 'error', code: 'VALIDATION', message: 'كلمة المرور يجب ألا تقل عن 6 أحرف.'};
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][5]) === email) {
      return {result: 'error', code: 'EMAIL_EXISTS', message: 'هذا الإيميل مسجل مسبقاً'};
    }
  }

  var role = data.length <= 1 ? 'مدير' : 'مدخل بيانات';
  sheet.appendRow([
    new Date(), fullName, clean_(p.jobTitle), clean_(p.workplace), clean_(p.mobile),
    email, hashPassword_(password), role
  ]);

  return {result: 'success'};
}

function login_(p) {
  var ss = getSpreadsheet_();
  var sheet = ensureUsersSheet_(ss);
  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);

  if (!email || !password) {
    return {result: 'error', code: 'VALIDATION', message: 'أدخل الإيميل وكلمة المرور.'};
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][5]) !== email) continue;

    var stored = clean_(data[i][6]);
    var ok = verifyPassword_(password, stored);
    if (!ok) {
      return {result: 'error', code: 'INVALID_LOGIN', message: 'بيانات الدخول غير صحيحة'};
    }

    // Automatic migration from legacy plain-text password to salted SHA-256.
    if (stored.indexOf('sha256$') !== 0) {
      sheet.getRange(i + 1, 7).setValue(hashPassword_(password));
    }

    var token = createSession_(ss, email);
    return {
      result: 'success',
      user: {
        fullName: data[i][1],
        email: data[i][5],
        role: data[i][7],
        sessionToken: token
      }
    };
  }

  return {result: 'error', code: 'INVALID_LOGIN', message: 'بيانات الدخول غير صحيحة'};
}

function logout_(p) {
  var ss = getSpreadsheet_();
  var token = clean_(p.token);
  if (!token) return {result: 'success'};
  var sheet = ensureSessionsSheet_(ss);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (clean_(data[i][0]) === token) sheet.deleteRow(i + 1);
  }
  return {result: 'success'};
}

function forgotPassword_(p) {
  var ss = getSpreadsheet_();
  var sheet = ensureUsersSheet_(ss);
  var email = normalizeEmail_(p.email);
  if (!email) return {result: 'error', code: 'VALIDATION', message: 'أدخل الإيميل.'};

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][5]) !== email) continue;

    var tempPassword = makeTemporaryPassword_();

    try {
      MailApp.sendEmail(
        email,
        'استعادة كلمة المرور - منظومة النفايات',
        'مرحباً ' + data[i][1] + '،\n\nتم إنشاء كلمة مرور مؤقتة جديدة لحسابك:\n' + tempPassword +
        '\n\nاستخدمها في تسجيل الدخول. تم إلغاء الجلسات القديمة لحماية الحساب.'
      );
      sheet.getRange(i + 1, 7).setValue(hashPassword_(tempPassword));
      invalidateSessionsForEmail_(ss, email);
      return {result: 'success'};
    } catch (err) {
      console.error(err);
      return {result: 'error', code: 'MAIL_ERROR', message: 'حدث خطأ أثناء إرسال الإيميل'};
    }
  }

  return {result: 'error', code: 'EMAIL_NOT_FOUND', message: 'الإيميل غير مسجل في النظام'};
}

function getMe_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;
  return {result: 'success', data: auth.user};
}

function getUsers_(p) {
  var auth = requireAuth_(p, ['مدير']);
  if (!auth.ok) return auth.error;

  var ss = getSpreadsheet_();
  var sheet = ensureUsersSheet_(ss);
  var data = sheet.getDataRange().getValues();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][5]) continue;
    users.push({
      fullName: data[i][1] || '',
      jobTitle: data[i][2] || '',
      workplace: data[i][3] || '',
      mobile: data[i][4] || '',
      email: data[i][5] || '',
      role: data[i][7] || 'مدخل بيانات'
    });
  }
  return {result: 'success', data: users};
}

function updateRole_(p) {
  var auth = requireAuth_(p, ['مدير']);
  if (!auth.ok) return auth.error;

  var targetEmail = normalizeEmail_(p.targetEmail);
  var newRole = clean_(p.newRole);
  var allowed = ['مدخل بيانات', 'مشرف', 'مدير'];
  if (allowed.indexOf(newRole) === -1) {
    return {result: 'error', code: 'VALIDATION', message: 'الصلاحية غير صالحة.'};
  }

  var ss = getSpreadsheet_();
  var sheet = ensureUsersSheet_(ss);
  var data = sheet.getDataRange().getValues();
  var targetRow = -1;
  var targetOldRole = '';
  var adminCount = 0;

  for (var i = 1; i < data.length; i++) {
    if (clean_(data[i][7]) === 'مدير') adminCount++;
    if (normalizeEmail_(data[i][5]) === targetEmail) {
      targetRow = i + 1;
      targetOldRole = clean_(data[i][7]);
    }
  }

  if (targetRow === -1) return {result: 'error', code: 'NOT_FOUND', message: 'المستخدم غير موجود.'};
  if (targetOldRole === 'مدير' && newRole !== 'مدير' && adminCount <= 1) {
    return {result: 'error', code: 'LAST_ADMIN', message: 'لا يمكن إزالة صلاحية آخر مدير في النظام.'};
  }

  sheet.getRange(targetRow, 8).setValue(newRole);
  return {result: 'success'};
}

function getSettings_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;
  var ss = getSpreadsheet_();
  var sheet = ensureSettingsSheet_(ss);
  return {result: 'success', data: readSettingsObject_(sheet)};
}

function saveSettings_(p) {
  var auth = requireAuth_(p, ['مدير']);
  if (!auth.ok) return auth.error;

  var raw = clean_(p.settingsData);
  if (!raw) return {result: 'error', code: 'VALIDATION', message: 'بيانات الإعدادات فارغة.'};

  var obj;
  try {
    obj = JSON.parse(raw);
  } catch (err) {
    return {result: 'error', code: 'INVALID_JSON', message: 'صيغة الإعدادات غير صحيحة.'};
  }

  var ss = getSpreadsheet_();
  var sheet = ensureSettingsSheet_(ss);
  var rows = [SETTINGS_HEADERS];
  for (var i = 0; i < SETTINGS_KEYS.length; i++) {
    var key = SETTINGS_KEYS[i];
    rows.push([key, JSON.stringify(obj[key] != null ? obj[key] : defaultSettingValue_(key)), new Date()]);
  }

  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  return {result: 'success'};
}

function getRecords_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;

  var ss = getSpreadsheet_();
  var sheet = ensureDataSheet_(ss);
  var data = sheet.getDataRange().getValues();
  var records = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1] && !row[12]) continue;
    records.push({
      timestamp: normalizeTimestamp_(row[0]),
      reportDate: normalizeDate_(row[1]),
      treatmentUnit: row[2] || '',
      driverName: row[3] || '',
      carNumber: row[4] || '',
      facilityMainType: row[5] || '',
      healthAdmin: row[6] || '',
      subFacilityName: row[7] || '',
      facilityName: row[7] || '',
      visitType: row[8] || '',
      wasteWeight: row[9] === '' ? 0 : row[9],
      weightUnit: row[10] || '',
      createdBy: row[11] || 'غير مسجل',
      recordId: clean_(row[12]),
      tripId: clean_(row[13])
    });
  }

  return {result: 'success', data: records};
}

function addRecords_(p, isBatch) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;

  var incoming;
  if (isBatch) {
    try {
      incoming = JSON.parse(clean_(p.recordsData) || '[]');
    } catch (err) {
      return {result: 'error', code: 'INVALID_JSON', message: 'بيانات السجلات غير صحيحة.'};
    }
  } else {
    incoming = [p];
  }

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return {result: 'error', code: 'VALIDATION', message: 'لا توجد سجلات للحفظ.'};
  }
  if (incoming.length > 250) {
    return {result: 'error', code: 'TOO_MANY_RECORDS', message: 'الحد الأقصى 250 سجل في العملية الواحدة.'};
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = getSpreadsheet_();
    var sheet = ensureDataSheet_(ss);
    var lastRow = sheet.getLastRow();
    var existingIds = {};
    if (lastRow > 1) {
      var ids = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
      for (var x = 0; x < ids.length; x++) {
        if (ids[x][0]) existingIds[String(ids[x][0])] = true;
      }
    }

    var rows = [];
    var accepted = [];
    var skipped = 0;

    for (var i = 0; i < incoming.length; i++) {
      var r = incoming[i] || {};
      var recordId = clean_(r.recordId || r.id) || Utilities.getUuid();
      if (existingIds[recordId]) {
        skipped++;
        continue;
      }

      var tripId = clean_(r.tripId) || Utilities.getUuid();
      var reportDate = normalizeDate_(r.reportDate);
      if (!reportDate || !clean_(r.treatmentUnit) || !clean_(r.driverName) || !clean_(r.carNumber)) {
        return {result: 'error', code: 'VALIDATION', message: 'أحد السجلات يفتقد بيانات الرحلة الأساسية.'};
      }

      rows.push([
        normalizeTimestamp_(r.timestamp) || new Date().toISOString(),
        reportDate,
        clean_(r.treatmentUnit),
        clean_(r.driverName),
        clean_(r.carNumber),
        clean_(r.facilityMainType),
        clean_(r.healthAdmin),
        clean_(r.subFacilityName || r.facilityName),
        clean_(r.visitType),
        numberOrZero_(r.wasteWeight),
        clean_(r.weightUnit),
        auth.user.fullName || auth.user.email,
        recordId,
        tripId
      ]);
      accepted.push({recordId: recordId, tripId: tripId});
      existingIds[recordId] = true;
    }

    if (rows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, DATA_HEADERS.length).setValues(rows);
    }

    return {result: 'success', inserted: rows.length, skipped: skipped, records: accepted};
  } finally {
    lock.releaseLock();
  }
}

function deleteTrip_(p) {
  var auth = requireAuth_(p, ['مدير']);
  if (!auth.ok) return auth.error;

  var tripId = clean_(p.tripId);
  if (!tripId) return {result: 'error', code: 'VALIDATION', message: 'معرف الرحلة مطلوب للحذف.'};

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = getSpreadsheet_();
    var sheet = ensureDataSheet_(ss);
    var data = sheet.getDataRange().getValues();
    var deleted = 0;

    for (var i = data.length - 1; i >= 1; i--) {
      if (clean_(data[i][13]) === tripId) {
        sheet.deleteRow(i + 1);
        deleted++;
      }
    }

    if (!deleted) return {result: 'error', code: 'NOT_FOUND', message: 'لم يتم العثور على الرحلة في السحابة.'};
    return {result: 'success', deleted: deleted};
  } finally {
    lock.releaseLock();
  }
}

// -------------------- Spreadsheet migration/helpers --------------------

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This script must be bound to a Google Spreadsheet.');
  return ss;
}

function ensureUsersSheet_(ss) {
  var sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) sheet = ss.insertSheet(USERS_SHEET);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
  return sheet;
}

function ensureDataSheet_(ss) {
  var sheet = ss.getSheetByName(DATA_SHEET);
  if (!sheet) {
    var sheets = ss.getSheets();
    var fallback = null;

    // Prefer the legacy data sheet by recognizing its headers instead of relying on tab order.
    for (var i = 0; i < sheets.length; i++) {
      var n = sheets[i].getName();
      if (n === USERS_SHEET || n === SETTINGS_SHEET || n === SESSIONS_SHEET) continue;
      if (!fallback) fallback = sheets[i];

      if (sheets[i].getLastRow() > 0 && sheets[i].getLastColumn() >= 5) {
        var headers = sheets[i].getRange(1, 1, 1, Math.min(sheets[i].getLastColumn(), 12)).getValues()[0].map(clean_);
        if (headers.indexOf('تاريخ البلاغ') !== -1 && headers.indexOf('وحدة المعالجة') !== -1) {
          sheet = sheets[i];
          break;
        }
      }
    }

    if (!sheet) sheet = fallback;
    if (sheet) sheet.setName(DATA_SHEET);
    else sheet = ss.insertSheet(DATA_SHEET);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DATA_HEADERS.length).setValues([DATA_HEADERS]);
    return sheet;
  }

  // Preserve the original 12 columns and append identifiers in M/N.
  var currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), DATA_HEADERS.length)).getValues()[0];
  for (var h = 0; h < 12; h++) {
    if (!currentHeaders[h]) sheet.getRange(1, h + 1).setValue(DATA_HEADERS[h]);
  }
  if (clean_(currentHeaders[12]) !== DATA_HEADERS[12]) sheet.getRange(1, 13).setValue(DATA_HEADERS[12]);
  if (clean_(currentHeaders[13]) !== DATA_HEADERS[13]) sheet.getRange(1, 14).setValue(DATA_HEADERS[13]);

  migrateRecordIds_(sheet);
  return sheet;
}

function migrateRecordIds_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var baseData = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
  var recordIds = [];
  var tripIds = [];
  var tripMap = {};
  var changed = false;

  // First preserve any IDs already generated by a previous/partial migration.
  for (var i = 0; i < baseData.length; i++) {
    var existingTripId = clean_(baseData[i][13]);
    var key = [normalizeDate_(baseData[i][1]), clean_(baseData[i][2]), clean_(baseData[i][3]), clean_(baseData[i][4])].join('|');
    if (existingTripId && key) tripMap[key] = existingTripId;
  }

  for (var r = 0; r < baseData.length; r++) {
    var row = baseData[r];
    if (!row[1] && !row[7] && !row[12] && !row[13]) {
      recordIds.push([row[12] || '']);
      tripIds.push([row[13] || '']);
      continue;
    }

    var recordId = clean_(row[12]);
    if (!recordId) {
      recordId = Utilities.getUuid();
      changed = true;
    }

    var tripId = clean_(row[13]);
    if (!tripId) {
      var tripKey = [normalizeDate_(row[1]), clean_(row[2]), clean_(row[3]), clean_(row[4])].join('|');
      if (!tripMap[tripKey]) tripMap[tripKey] = Utilities.getUuid();
      tripId = tripMap[tripKey];
      changed = true;
    }

    recordIds.push([recordId]);
    tripIds.push([tripId]);
  }

  // Only write the two new identifier columns; never rewrite legacy data/formulas.
  if (changed) {
    sheet.getRange(2, 13, recordIds.length, 1).setValues(recordIds);
    sheet.getRange(2, 14, tripIds.length, 1).setValues(tripIds);
  }
}

function ensureSettingsSheet_(ss) {
  var sheet = ss.getSheetByName(SETTINGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS_SHEET);
    sheet.getRange(1, 1, 1, SETTINGS_HEADERS.length).setValues([SETTINGS_HEADERS]);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SETTINGS_HEADERS.length).setValues([SETTINGS_HEADERS]);
    return sheet;
  }

  var a1 = sheet.getRange(1, 1).getValue();
  if (clean_(a1) !== SETTINGS_HEADERS[0]) {
    // Legacy format: the entire settings object was stored in A1.
    var legacy = null;
    try { legacy = JSON.parse(String(a1 || '')); } catch (err) { legacy = null; }
    sheet.clearContents();
    var rows = [SETTINGS_HEADERS];
    for (var i = 0; i < SETTINGS_KEYS.length; i++) {
      var key = SETTINGS_KEYS[i];
      rows.push([key, JSON.stringify(legacy && legacy[key] != null ? legacy[key] : defaultSettingValue_(key)), new Date()]);
    }
    sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  }
  return sheet;
}

function readSettingsObject_(sheet) {
  var data = sheet.getDataRange().getValues();
  var obj = {};
  for (var i = 1; i < data.length; i++) {
    var key = clean_(data[i][0]);
    if (!key) continue;
    try { obj[key] = JSON.parse(String(data[i][1] || 'null')); }
    catch (err) { obj[key] = defaultSettingValue_(key); }
  }
  for (var k = 0; k < SETTINGS_KEYS.length; k++) {
    var wanted = SETTINGS_KEYS[k];
    if (obj[wanted] == null) obj[wanted] = defaultSettingValue_(wanted);
  }
  return obj;
}

function defaultSettingValue_(key) {
  return key === 'healthAdmins' ? {} : [];
}

function ensureSessionsSheet_(ss) {
  var sheet = ss.getSheetByName(SESSIONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(SESSIONS_SHEET);
    sheet.getRange(1, 1, 1, SESSION_HEADERS.length).setValues([SESSION_HEADERS]);
    try { sheet.hideSheet(); } catch (err) {}
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, SESSION_HEADERS.length).setValues([SESSION_HEADERS]);
  }
  return sheet;
}

// -------------------- Authentication helpers --------------------

function createSession_(ss, email) {
  var sheet = ensureSessionsSheet_(ss);
  cleanupExpiredSessions_(sheet);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  var expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  sheet.appendRow([token, email, expires, new Date()]);
  return token;
}

function requireAuth_(params, allowedRoles) {
  var token = clean_(params && params.token);
  if (!token) return {ok: false, error: {result: 'error', code: 'AUTH_REQUIRED', message: 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'}};

  var ss = getSpreadsheet_();
  var sessions = ensureSessionsSheet_(ss);
  var data = sessions.getDataRange().getValues();
  var now = new Date();
  var email = '';
  var sessionRow = -1;

  for (var i = 1; i < data.length; i++) {
    if (clean_(data[i][0]) !== token) continue;
    var expires = data[i][2] instanceof Date ? data[i][2] : new Date(data[i][2]);
    if (isNaN(expires.getTime()) || expires <= now) {
      sessions.deleteRow(i + 1);
      return {ok: false, error: {result: 'error', code: 'AUTH_REQUIRED', message: 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.'}};
    }
    email = normalizeEmail_(data[i][1]);
    sessionRow = i + 1;
    break;
  }

  if (!email) return {ok: false, error: {result: 'error', code: 'AUTH_REQUIRED', message: 'جلسة الدخول غير صالحة.'}};

  var user = findUser_(ss, email);
  if (!user) return {ok: false, error: {result: 'error', code: 'AUTH_REQUIRED', message: 'الحساب غير موجود.'}};

  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(user.role) === -1) {
    return {ok: false, error: {result: 'error', code: 'FORBIDDEN', message: 'ليس لديك صلاحية لتنفيذ هذه العملية.'}};
  }

  if (sessionRow > 0) sessions.getRange(sessionRow, 4).setValue(new Date());
  return {ok: true, user: user};
}

function findUser_(ss, email) {
  var sheet = ensureUsersSheet_(ss);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][5]) === email) {
      return {fullName: data[i][1] || '', email: data[i][5] || '', role: data[i][7] || 'مدخل بيانات'};
    }
  }
  return null;
}

function invalidateSessionsForEmail_(ss, email) {
  var sheet = ensureSessionsSheet_(ss);
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (normalizeEmail_(data[i][1]) === email) sheet.deleteRow(i + 1);
  }
}

function cleanupExpiredSessions_(sheet) {
  var data = sheet.getDataRange().getValues();
  var now = new Date();
  for (var i = data.length - 1; i >= 1; i--) {
    var expires = data[i][2] instanceof Date ? data[i][2] : new Date(data[i][2]);
    if (isNaN(expires.getTime()) || expires <= now) sheet.deleteRow(i + 1);
  }
}

// -------------------- Password helpers --------------------

function hashPassword_(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return 'sha256$' + salt + '$' + sha256Hex_(salt + String(password));
}

function verifyPassword_(password, stored) {
  stored = String(stored || '');
  if (stored.indexOf('sha256$') !== 0) return stored === String(password || '');
  var parts = stored.split('$');
  if (parts.length !== 3) return false;
  return sha256Hex_(parts[1] + String(password || '')) === parts[2];
}

function sha256Hex_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    hex += ('0' + v.toString(16)).slice(-2);
  }
  return hex;
}

function makeTemporaryPassword_() {
  return 'Mw-' + Utilities.getUuid().replace(/-/g, '').substring(0, 10);
}

// -------------------- Generic helpers --------------------

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v) {
  return v == null ? '' : String(v).trim();
}

function normalizeEmail_(v) {
  return clean_(v).toLowerCase();
}

function numberOrZero_(v) {
  var n = Number(v);
  return isFinite(n) ? n : 0;
}

function normalizeDate_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || 'Africa/Cairo', 'yyyy-MM-dd');
  }
  var s = clean_(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Africa/Cairo', 'yyyy-MM-dd');
  return s;
}

function normalizeTimestamp_(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  var s = clean_(value);
  var d = new Date(s);
  return !isNaN(d.getTime()) ? d.toISOString() : s;
}

function authorizeEmail() {
  var myEmail = Session.getActiveUser().getEmail();
  MailApp.sendEmail(myEmail, 'تفعيل إرسال الإيميلات', 'تم تفعيل خاصية إرسال الإيميلات بنجاح في المنظومة.');
}
