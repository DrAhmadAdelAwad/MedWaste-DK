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
    HEALTH: 'health'
  });

  const Roles = Object.freeze({
    DATA_ENTRY: 'مدخل بيانات',
    SUPERVISOR: 'مشرف',
    ADMIN: 'مدير'
  });

  const RoleList = Object.freeze([Roles.DATA_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]);

  const ErrorCodes = Object.freeze({
    VALIDATION: 'VALIDATION',
    INVALID_JSON: 'INVALID_JSON',
    INVALID_LOGIN: 'INVALID_LOGIN',
    EMAIL_EXISTS: 'EMAIL_EXISTS',
    EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
    MAIL_ERROR: 'MAIL_ERROR',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    FORBIDDEN: 'FORBIDDEN',
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
    PASSWORD_MIN_LENGTH: 6,
    RECORDS_PER_BATCH: 250,
    RECORDS_PAGE_SIZE_DEFAULT: 500,
    RECORDS_PAGE_SIZE_MAX: 1000,
    NAME_MAX_LENGTH: 160,
    EMAIL_MAX_LENGTH: 254,
    PHONE_MAX_LENGTH: 40,
    GENERIC_TEXT_MAX_LENGTH: 500,
    SETTINGS_JSON_MAX_LENGTH: 500000
  });

  MW.Contracts = Object.freeze({
    version: '1.2',
    Actions,
    Roles,
    RoleList,
    ErrorCodes,
    Limits
  });
})(window.MedWaste);
