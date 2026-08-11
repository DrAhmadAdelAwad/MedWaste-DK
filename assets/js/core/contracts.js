(function (MW) {
  'use strict';

  const Actions = Object.freeze({
    REGISTER: 'register',
    LOGIN: 'login',
    LOGOUT: 'logout',
    FORGOT_PASSWORD: 'forgot_password',
    UPDATE_ROLE: 'update_role',
    SAVE_SETTINGS: 'save_settings',
    ADD_RECORD: 'add_record',
    ADD_RECORDS_BATCH: 'add_records_batch',
    DELETE_TRIP: 'delete_trip',
    GET_RECORDS: 'get_records',
    GET_SETTINGS: 'get_settings',
    GET_USERS: 'get_users',
    GET_ME: 'get_me',
    GET_AUDIT_LOG: 'get_audit_log',
    HEALTH: 'health'
  });

  const Roles = Object.freeze({
    DATA_ENTRY: 'مدخل بيانات',
    SUPERVISOR: 'مشرف',
    ADMIN: 'مدير'
  });

  const RoleList = Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]);

  const ActionRoles = Object.freeze({
    register: Object.freeze([]),
    login: Object.freeze([]),
    forgot_password: Object.freeze([]),
    health: Object.freeze([]),
    logout: Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]),
    get_me: Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]),
    get_settings: Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]),
    add_record: Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]),
    add_records_batch: Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]),
    get_records: Object.freeze([Roles.SUPERVISOR, Roles.ADMIN]),
    delete_trip: Object.freeze([Roles.ADMIN]),
    save_settings: Object.freeze([Roles.ADMIN]),
    get_users: Object.freeze([Roles.ADMIN]),
    update_role: Object.freeze([Roles.ADMIN]),
    get_audit_log: Object.freeze([Roles.ADMIN])
  });

  const ErrorCodes = Object.freeze({
    VALIDATION: 'VALIDATION',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_LOGIN: 'INVALID_LOGIN',
    EMAIL_EXISTS: 'EMAIL_EXISTS',
    EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
    MAIL_ERROR: 'MAIL_ERROR',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMITED: 'RATE_LIMITED',
    METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
    NOT_FOUND: 'NOT_FOUND',
    LAST_ADMIN: 'LAST_ADMIN',
    TOO_MANY_RECORDS: 'TOO_MANY_RECORDS',
    BUSY: 'BUSY',
    UNKNOWN_ACTION: 'UNKNOWN_ACTION',
    SERVER_ERROR: 'SERVER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
    INVALID_RESPONSE: 'INVALID_RESPONSE'
  });

  const Limits = Object.freeze({
    PASSWORD_MIN_LENGTH: 8,
    RECORDS_PER_BATCH: 250,
    RECORDS_PAGE_SIZE_DEFAULT: 500,
    RECORDS_PAGE_SIZE_MAX: 1000,
    AUDIT_PAGE_SIZE_DEFAULT: 100,
    AUDIT_PAGE_SIZE_MAX: 500,
    NAME_MAX_LENGTH: 160,
    EMAIL_MAX_LENGTH: 254,
    PHONE_MAX_LENGTH: 40,
    GENERIC_TEXT_MAX_LENGTH: 500,
    SETTINGS_JSON_MAX_LENGTH: 500000
  });

  function rolesFor(action) {
    const roles = ActionRoles[String(action || '').trim()];
    return Array.isArray(roles) ? roles : null;
  }

  function isPublic(action) {
    const roles = rolesFor(action);
    return Array.isArray(roles) && roles.length === 0;
  }

  function canRole(role, action) {
    const roles = rolesFor(action);
    return Array.isArray(roles) && roles.length > 0 && roles.includes(String(role || '').trim());
  }

  MW.Contracts = Object.freeze({
    version: '1.3',
    Actions,
    Roles,
    RoleList,
    ActionRoles,
    ErrorCodes,
    Limits,
    rolesFor,
    isPublic,
    canRole
  });
})(window.MedWaste);
