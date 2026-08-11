/**
 * Shared backend utility functions.
 */

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

function success_(data) {
  var out = {result: 'success'};
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
    }
  }
  return out;
}

function failure_(code, message, details) {
  var out = {result: 'error', code: code || ERROR_CODES.SERVER_ERROR, message: message || 'حدث خطأ غير متوقع.'};
  if (details != null) out.details = details;
  return out;
}
