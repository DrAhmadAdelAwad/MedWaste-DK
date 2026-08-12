(function (MW) {
  'use strict';

  const { Storage, Api, Contracts, SettingsEntity, SettingsMapper } = MW;

  const STORAGE_BY_DOMAIN_KEY = Object.freeze({
    healthAdmins: Storage.KEYS.healthAdmins,
    cars: Storage.KEYS.cars,
    drivers: Storage.KEYS.drivers,
    govFacilities: Storage.KEYS.govFacilities,
    privateFacilities: Storage.KEYS.privateFacilities,
    privateCompanies: Storage.KEYS.privateCompanies,
    treatmentUnits: Storage.KEYS.treatmentUnits
  });

  function hasLocal(key) { return Storage.has(STORAGE_BY_DOMAIN_KEY[key]); }
  function readLocal(key, fallback) { return Storage.getJson(STORAGE_BY_DOMAIN_KEY[key], fallback); }
  function writeLocal(key, value) { Storage.setJson(STORAGE_BY_DOMAIN_KEY[key], value); }

  function loadLocal(defaults) {
    const raw = {};
    SettingsEntity.KEYS.forEach(key => { raw[key] = readLocal(key, defaults[key]); });
    return SettingsEntity.normalize(raw, defaults);
  }

  function ensureDefaults(defaults) {
    SettingsEntity.KEYS.forEach(key => {
      if (!hasLocal(key)) writeLocal(key, defaults[key]);
    });
  }

  function saveLocal(data) {
    const normalized = SettingsEntity.normalize(data);
    SettingsEntity.KEYS.forEach(key => writeLocal(key, normalized[key]));
  }

  function isCloudFresh(maxAgeMs = 300000) {
    const at = Number(Storage.getText(Storage.KEYS.settingsFetchedAt, '0')) || 0;
    return at > 0 && (Date.now() - at) < Math.max(0, Number(maxAgeMs) || 0);
  }

  async function fetchCloud(defaults) {
    const response = await Api.read(Contracts.Actions.GET_SETTINGS);
    if (response.result !== 'success' || !response.data) return null;
    Storage.setText(Storage.KEYS.settingsFetchedAt, Date.now());
    return SettingsMapper.fromApi(response.data, defaults);
  }

  async function saveCloud(data) {
    const serialized = JSON.stringify(SettingsEntity.normalize(data));
    Storage.setText(Storage.KEYS.pendingSettings, serialized);
    const response = await Api.post(Contracts.Actions.SAVE_SETTINGS, { settingsData: serialized });
    Storage.remove(Storage.KEYS.pendingSettings);
    Storage.setText(Storage.KEYS.settingsFetchedAt, Date.now());
    Storage.remove(Storage.KEYS.entitiesDirectory);
    Storage.remove(Storage.KEYS.entitiesFetchedAt);
    return response;
  }

  async function retryPending() {
    const pending = Storage.getText(Storage.KEYS.pendingSettings, '');
    if (!pending) return false;
    await Api.post(Contracts.Actions.SAVE_SETTINGS, { settingsData: pending });
    Storage.remove(Storage.KEYS.pendingSettings);
    return true;
  }

  function exportLegacyBundle(data) {
    const normalized = SettingsEntity.normalize(data);
    return {
      sys_health_admins: normalized.healthAdmins,
      sys_cars: normalized.cars,
      sys_drivers: normalized.drivers,
      sys_gov_facilities: normalized.govFacilities,
      sys_priv_facilities: normalized.privateFacilities,
      sys_priv_companies: normalized.privateCompanies,
      sys_treatment_units: normalized.treatmentUnits
    };
  }

  function fromLegacyBundle(bundle, defaults) {
    return SettingsEntity.normalize({
      healthAdmins: bundle.sys_health_admins,
      cars: bundle.sys_cars,
      drivers: bundle.sys_drivers,
      govFacilities: bundle.sys_gov_facilities,
      privateFacilities: bundle.sys_priv_facilities,
      privateCompanies: bundle.sys_priv_companies,
      treatmentUnits: bundle.sys_treatment_units
    }, defaults);
  }

  function prime(data) { saveLocal(data); Storage.setText(Storage.KEYS.settingsFetchedAt, Date.now()); return data; }

  MW.SettingsRepository = Object.freeze({
    loadLocal, ensureDefaults, saveLocal, prime, isCloudFresh, fetchCloud, saveCloud, retryPending,
    exportLegacyBundle, fromLegacyBundle
  });
})(window.MedWaste);
