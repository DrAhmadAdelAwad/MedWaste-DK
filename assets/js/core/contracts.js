(function (MW) {
  'use strict';
  const Actions = Object.freeze({
    REGISTER:'register', LOGIN:'login', LOGOUT:'logout', FORGOT_PASSWORD:'forgot_password', UPDATE_ROLE:'update_role',
    SAVE_SETTINGS:'save_settings', ADD_RECORD:'add_record', ADD_RECORDS_BATCH:'add_records_batch', DELETE_TRIP:'delete_trip',
    GET_RECORDS:'get_records', GET_SETTINGS:'get_settings', GET_USERS:'get_users', GET_ME:'get_me', GET_AUDIT_LOG:'get_audit_log',
    GET_REGISTRATION_OPTIONS:'get_registration_options', GET_ENTITIES:'get_entities', GET_RECONCILIATION:'get_reconciliation', GET_HEALTH_ADMIN_RECONCILIATION:'get_health_admin_reconciliation', AUTHORIZE_CLAIM:'authorize_claim', HEALTH:'health'
  });
  const Roles = Object.freeze({FACILITY_ENTRY:'مدخل منشأة', TREATMENT_ENTRY:'مدخل وحدة المعالجة', SUPERVISOR:'مشرف', ADMIN:'مدير', LEGACY_DATA_ENTRY:'مدخل بيانات'});
  const RoleList = Object.freeze([Roles.FACILITY_ENTRY, Roles.TREATMENT_ENTRY, Roles.SUPERVISOR, Roles.ADMIN]);
  const AuthenticatedRoles = Object.freeze([Roles.FACILITY_ENTRY, Roles.TREATMENT_ENTRY, Roles.SUPERVISOR, Roles.ADMIN, Roles.LEGACY_DATA_ENTRY]);
  const EntrySources = Object.freeze({FACILITY:'facility', TREATMENT:'treatment'});
  const EntityTypes = Object.freeze({FACILITY:'facility', TREATMENT_UNIT:'treatment_unit', HEALTH_ADMIN:'health_admin'});
  const ReconciliationStatus = Object.freeze({MATCHED:'MATCHED', WEIGHT_MISMATCH:'WEIGHT_MISMATCH', FACILITY_ONLY:'FACILITY_ONLY', TREATMENT_ONLY:'TREATMENT_ONLY', PARTIAL:'PARTIAL'});
  const ActionRoles = Object.freeze({
    register:[], login:[], forgot_password:[], health:[], get_registration_options:[],
    logout:AuthenticatedRoles, get_me:AuthenticatedRoles, get_settings:AuthenticatedRoles, get_entities:AuthenticatedRoles,
    add_record:[Roles.FACILITY_ENTRY,Roles.TREATMENT_ENTRY], add_records_batch:[Roles.FACILITY_ENTRY,Roles.TREATMENT_ENTRY],
    get_records:AuthenticatedRoles, get_reconciliation:[Roles.SUPERVISOR,Roles.ADMIN], get_health_admin_reconciliation:[Roles.SUPERVISOR,Roles.ADMIN], authorize_claim:[Roles.SUPERVISOR,Roles.ADMIN],
    delete_trip:[Roles.ADMIN], save_settings:[Roles.ADMIN], get_users:[Roles.ADMIN], update_role:[Roles.ADMIN], get_audit_log:[Roles.ADMIN]
  });
  const ErrorCodes = Object.freeze({
    VALIDATION:'VALIDATION',INVALID_JSON:'INVALID_JSON',INVALID_LOGIN:'INVALID_LOGIN',EMAIL_EXISTS:'EMAIL_EXISTS',EMAIL_NOT_FOUND:'EMAIL_NOT_FOUND',MAIL_ERROR:'MAIL_ERROR',AUTH_REQUIRED:'AUTH_REQUIRED',FORBIDDEN:'FORBIDDEN',RATE_LIMITED:'RATE_LIMITED',METHOD_NOT_ALLOWED:'METHOD_NOT_ALLOWED',NOT_FOUND:'NOT_FOUND',LAST_ADMIN:'LAST_ADMIN',TOO_MANY_RECORDS:'TOO_MANY_RECORDS',BUSY:'BUSY',RECONCILIATION_REQUIRED:'RECONCILIATION_REQUIRED',ASSIGNMENT_REQUIRED:'ASSIGNMENT_REQUIRED',ASSIGNMENT_CONFLICT:'ASSIGNMENT_CONFLICT',UNKNOWN_ACTION:'UNKNOWN_ACTION',SERVER_ERROR:'SERVER_ERROR',NETWORK_ERROR:'NETWORK_ERROR',REQUEST_TIMEOUT:'REQUEST_TIMEOUT',INVALID_RESPONSE:'INVALID_RESPONSE'
  });
  const Limits = Object.freeze({PASSWORD_MIN_LENGTH:8,RECORDS_PER_BATCH:250,RECORDS_PAGE_SIZE_DEFAULT:500,RECORDS_PAGE_SIZE_MAX:1000,AUDIT_PAGE_SIZE_DEFAULT:100,AUDIT_PAGE_SIZE_MAX:500,RECONCILIATION_DAYS_MAX:366,NAME_MAX_LENGTH:160,EMAIL_MAX_LENGTH:254,PHONE_MAX_LENGTH:40,GENERIC_TEXT_MAX_LENGTH:500,SETTINGS_JSON_MAX_LENGTH:500000});
  function rolesFor(action){const roles=ActionRoles[String(action||'').trim()];return Array.isArray(roles)?roles:null;}
  function isPublic(action){const roles=rolesFor(action);return Array.isArray(roles)&&roles.length===0;}
  function canRole(role,action){const roles=rolesFor(action);return Array.isArray(roles)&&roles.length>0&&roles.includes(String(role||'').trim());}
  MW.Contracts=Object.freeze({version:'1.10',Actions,Roles,RoleList,AuthenticatedRoles,EntrySources,EntityTypes,ReconciliationStatus,ActionRoles,ErrorCodes,Limits,rolesFor,isPublic,canRole});
})(window.MedWaste);
