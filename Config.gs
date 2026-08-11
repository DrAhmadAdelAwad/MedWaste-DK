/**
 * MedWaste DK - Backend configuration and spreadsheet schema.
 * Stage 8: security hardening, centralized authorization and audit trail.
 */

var DATA_SHEET = 'السجلات';
var USERS_SHEET = 'المستخدمين';
var SETTINGS_SHEET = 'الإعدادات';
var SESSIONS_SHEET = '_الجلسات';
var IDEMPOTENCY_SHEET = '_الطلبات';
var AUDIT_SHEET = '_سجل_التدقيق';

var SESSION_DAYS = 7;
var SESSION_IDLE_MINUTES = 720;
var SESSION_TOUCH_INTERVAL_MINUTES = 5;
var SESSION_MAX_ACTIVE_PER_USER = 5;

var LOGIN_MAX_FAILURES = 5;
var LOGIN_RATE_WINDOW_SECONDS = 900;
var PASSWORD_RESET_MAX_REQUESTS = 3;
var PASSWORD_RESET_RATE_WINDOW_SECONDS = 3600;

var AUDIT_RETENTION_DAYS = 365;
var AUDIT_MAX_ROWS = 20000;
var AUDIT_METADATA_MAX_LENGTH = 2500;

var APP_VERSION = '8.0';
var APP_ENVIRONMENT = 'production';
var APP_LOG_LEVEL = 'INFO';

var LOCK_WAIT_MS = 10000;
var IDEMPOTENCY_TTL_HOURS = 24;
var IDEMPOTENCY_PROCESSING_STALE_MINUTES = 5;
var SETTINGS_CACHE_SECONDS = 300;
var SETTINGS_CACHE_KEY = 'medwaste:settings:v1';
var DATA_MIGRATION_PROPERTY = 'MEDWASTE_RECORD_IDS_MIGRATION';
var DATA_MIGRATION_VERSION = '1';

var DATA_HEADERS = [
  'التوقيت', 'تاريخ البلاغ', 'وحدة المعالجة', 'السائق', 'رقم السيارة',
  'التصنيف الرئيسي', 'الإدارة الصحية', 'اسم المنشأة / الوحدة', 'طبيعة الزيارة',
  'الوزن', 'الوحدة', 'بواسطة', 'معرف السجل', 'معرف الرحلة'
];

var USER_HEADERS = ['التوقيت', 'الاسم', 'الوظيفة', 'جهة العمل', 'الموبايل', 'الإيميل', 'كلمة السر', 'الصلاحية'];
var SETTINGS_HEADERS = ['المفتاح', 'القيمة JSON', 'آخر تحديث'];
var SESSION_HEADERS = ['الرمز', 'الإيميل', 'تاريخ الانتهاء', 'آخر استخدام'];
var IDEMPOTENCY_HEADERS = ['المفتاح', 'معرف الطلب', 'العملية', 'الحالة', 'الاستجابة JSON', 'تاريخ الإنشاء', 'تاريخ الانتهاء'];
var AUDIT_HEADERS = [
  'معرف التدقيق', 'التوقيت', 'معرف الطلب', 'العملية', 'الحدث', 'النتيجة',
  'إيميل المنفذ', 'اسم المنفذ', 'صلاحية المنفذ', 'نوع الهدف', 'معرف الهدف', 'بيانات إضافية JSON'
];
var SETTINGS_KEYS = ['healthAdmins', 'cars', 'drivers', 'govFacilities', 'privateFacilities', 'privateCompanies'];
