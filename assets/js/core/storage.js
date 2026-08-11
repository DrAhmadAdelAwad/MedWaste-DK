(function (MW) {
  'use strict';

  const Logger = MW.Logger || { warn() {} };

  const KEYS = Object.freeze({
    currentUser: 'currentUser',
    records: 'dakahlia_waste_records',
    healthAdmins: 'sys_health_admins',
    cars: 'sys_cars',
    drivers: 'sys_drivers',
    govFacilities: 'sys_gov_facilities',
    privateFacilities: 'sys_priv_facilities',
    privateCompanies: 'sys_priv_companies',
    pendingSettings: 'sys_settings_pending'
  });

  function getText(key, fallback = '') {
    const value = localStorage.getItem(key);
    return value == null ? fallback : value;
  }

  function setText(key, value) {
    localStorage.setItem(key, String(value));
  }

  function getJson(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    try {
      return JSON.parse(raw);
    } catch (error) {
      Logger.warn('storage_json_parse_failed', { key, error });
      return fallback;
    }
  }

  function setJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function remove(key) {
    localStorage.removeItem(key);
  }

  function has(key) {
    return localStorage.getItem(key) != null;
  }

  MW.Storage = Object.freeze({
    KEYS,
    getText,
    setText,
    getJson,
    setJson,
    remove,
    has
  });
})(window.MedWaste);
