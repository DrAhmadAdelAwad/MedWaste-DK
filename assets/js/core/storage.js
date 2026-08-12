(function (MW) {
  'use strict';

  const Logger = MW.Logger || { warn() {} };

  const KEYS = Object.freeze({
    currentUser: 'currentUser',
    sessionToken: 'medwaste_session_token',
    records: 'dakahlia_waste_records',
    facilityRecords: 'dakahlia_facility_entry_records',
    treatmentRecords: 'dakahlia_treatment_entry_records',
    healthAdmins: 'sys_health_admins',
    cars: 'sys_cars',
    drivers: 'sys_drivers',
    govFacilities: 'sys_gov_facilities',
    privateFacilities: 'sys_priv_facilities',
    privateCompanies: 'sys_priv_companies',
    treatmentUnits: 'sys_treatment_units_v3',
    pendingSettings: 'sys_settings_pending',
    settingsFetchedAt: 'medwaste_settings_fetched_at_v3',
    entitiesDirectory: 'medwaste_entities_directory_v3',
    entitiesFetchedAt: 'medwaste_entities_fetched_at_v3',
    facilityRecordsFetchedAt: 'medwaste_facility_records_fetched_at',
    treatmentRecordsFetchedAt: 'medwaste_treatment_records_fetched_at',
    registrationKey: 'medwaste_registration_key',
    registrationEmail: 'medwaste_registration_email',
    registrationOptions: 'medwaste_registration_options_v3',
    registrationOptionsFetchedAt: 'medwaste_registration_options_fetched_at_v3',
    usersBundle: 'medwaste_users_bundle_v3',
    usersFetchedAt: 'medwaste_users_fetched_at_v3'
  });

  function getText(key, fallback = '') {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  }

  function setText(key, value) { localStorage.setItem(key, String(value)); }

  function getJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try { return JSON.parse(raw); }
    catch (error) {
      Logger.warn('storage_json_parse_failed', { key, error });
      return fallback;
    }
  }

  function setJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function remove(key) { localStorage.removeItem(key); }
  function has(key) { return localStorage.getItem(key) != null; }

  function getSessionText(key, fallback = '') {
    try {
      const value = sessionStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (_) { return fallback; }
  }

  function setSessionText(key, value) {
    try { sessionStorage.setItem(key, String(value)); } catch (_) {}
  }

  function removeSession(key) {
    try { sessionStorage.removeItem(key); } catch (_) {}
  }

  MW.Storage = Object.freeze({
    KEYS, getText, setText, getJson, setJson, remove, has,
    getSessionText, setSessionText, removeSession
  });
})(window.MedWaste);
