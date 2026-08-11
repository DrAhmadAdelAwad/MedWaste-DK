/**
 * Backend input validation and normalization.
 * Business modules should validate external input before touching Sheets.
 */

function isValidEmail_(email) {
  email = normalizeEmail_(email);
  if (!email || email.length > API_LIMITS.EMAIL_MAX_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidIsoDate_(value) {
  var s = clean_(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var parts = s.split('-');
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  var d = Number(parts[2]);
  var date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isTextWithin_(value, maxLength) {
  return clean_(value).length <= maxLength;
}

function validateLoginInput_(p) {
  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);
  if (!email || !password) return failure_(ERROR_CODES.VALIDATION, 'أدخل الإيميل وكلمة المرور.');
  if (!isValidEmail_(email)) return failure_(ERROR_CODES.VALIDATION, 'صيغة الإيميل غير صحيحة.');
  return null;
}

function validateRegistrationInput_(p) {
  var fullName = clean_(p.fullName);
  var email = normalizeEmail_(p.email);
  var password = clean_(p.password);

  if (!fullName || !email || !password) {
    return failure_(ERROR_CODES.VALIDATION, 'الاسم والإيميل وكلمة المرور مطلوبة.');
  }
  if (!isValidEmail_(email)) return failure_(ERROR_CODES.VALIDATION, 'صيغة الإيميل غير صحيحة.');
  if (password.length < API_LIMITS.PASSWORD_MIN_LENGTH) {
    return failure_(ERROR_CODES.VALIDATION, 'كلمة المرور يجب ألا تقل عن ' + API_LIMITS.PASSWORD_MIN_LENGTH + ' أحرف.');
  }
  if (!isTextWithin_(fullName, API_LIMITS.NAME_MAX_LENGTH)) {
    return failure_(ERROR_CODES.VALIDATION, 'الاسم أطول من الحد المسموح.');
  }
  if (!isTextWithin_(p.jobTitle, API_LIMITS.GENERIC_TEXT_MAX_LENGTH) ||
      !isTextWithin_(p.workplace, API_LIMITS.GENERIC_TEXT_MAX_LENGTH) ||
      !isTextWithin_(p.mobile, API_LIMITS.PHONE_MAX_LENGTH)) {
    return failure_(ERROR_CODES.VALIDATION, 'إحدى بيانات التسجيل أطول من الحد المسموح.');
  }
  return null;
}

function validateRoleUpdateInput_(p) {
  var targetEmail = normalizeEmail_(p.targetEmail);
  var newRole = clean_(p.newRole);
  if (!isValidEmail_(targetEmail)) return failure_(ERROR_CODES.VALIDATION, 'الإيميل المستهدف غير صالح.');
  if (ALLOWED_ROLES.indexOf(newRole) === -1) {
    return failure_(ERROR_CODES.VALIDATION, 'الصلاحية غير صالحة.');
  }
  return null;
}

function validateRecordInput_(record) {
  var r = record || {};
  var reportDate = normalizeDate_(r.reportDate);
  if (!reportDate || !isValidIsoDate_(reportDate)) {
    return failure_(ERROR_CODES.VALIDATION, 'تاريخ الرحلة غير صالح.');
  }

  var required = [
    ['وحدة المعالجة', r.treatmentUnit],
    ['السائق', r.driverName],
    ['رقم السيارة', r.carNumber],
    ['التصنيف الرئيسي', r.facilityMainType],
    ['اسم المنشأة / الوحدة', r.subFacilityName || r.facilityName],
    ['طبيعة الزيارة', r.visitType]
  ];
  for (var i = 0; i < required.length; i++) {
    if (!clean_(required[i][1])) {
      return failure_(ERROR_CODES.VALIDATION, 'السجل يفتقد الحقل المطلوب: ' + required[i][0] + '.');
    }
  }

  for (var j = 0; j < required.length; j++) {
    if (!isTextWithin_(required[j][1], API_LIMITS.GENERIC_TEXT_MAX_LENGTH)) {
      return failure_(ERROR_CODES.VALIDATION, 'إحدى قيم السجل أطول من الحد المسموح.');
    }
  }

  var visitType = clean_(r.visitType);
  var weight = Number(r.wasteWeight);
  if (visitType === 'نقل نفايات') {
    if (!isFinite(weight) || weight <= 0) {
      return failure_(ERROR_CODES.VALIDATION, 'وزن النفايات يجب أن يكون أكبر من صفر عند النقل.');
    }
    if (!clean_(r.weightUnit)) {
      return failure_(ERROR_CODES.VALIDATION, 'وحدة الوزن مطلوبة عند نقل النفايات.');
    }
  }
  return null;
}

function validateSettingsObject_(obj) {
  if (!obj || Object.prototype.toString.call(obj) !== '[object Object]') {
    return failure_(ERROR_CODES.VALIDATION, 'بيانات الإعدادات يجب أن تكون كائناً صالحاً.');
  }

  if (obj.healthAdmins != null && Object.prototype.toString.call(obj.healthAdmins) !== '[object Object]') {
    return failure_(ERROR_CODES.VALIDATION, 'قائمة الإدارات الصحية غير صحيحة.');
  }
  if (obj.healthAdmins) {
    for (var adminName in obj.healthAdmins) {
      if (!Object.prototype.hasOwnProperty.call(obj.healthAdmins, adminName)) continue;
      if (!Array.isArray(obj.healthAdmins[adminName])) {
        return failure_(ERROR_CODES.VALIDATION, 'وحدات إحدى الإدارات الصحية ليست في صيغة قائمة صحيحة.');
      }
    }
  }

  var arrayKeys = ['cars', 'drivers', 'govFacilities', 'privateFacilities', 'privateCompanies'];
  for (var i = 0; i < arrayKeys.length; i++) {
    var key = arrayKeys[i];
    if (obj[key] != null && !Array.isArray(obj[key])) {
      return failure_(ERROR_CODES.VALIDATION, 'صيغة إعدادات ' + key + ' غير صحيحة.');
    }
  }
  return null;
}
