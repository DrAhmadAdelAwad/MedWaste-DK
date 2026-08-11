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
    treatmentUnits: 'sys_treatment_units',
    pendingSettings: 'sys_settings_pending'
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
