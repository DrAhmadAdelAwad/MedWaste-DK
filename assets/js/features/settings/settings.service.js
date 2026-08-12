(function (MW) {
  'use strict';

  const { SettingsDefaults, SettingsEntity, SettingsRepository, Session, Contracts, Validators } = MW;
  let state = null;

  function ensureLocalDefaults() {
    SettingsRepository.ensureDefaults(SettingsDefaults);
  }

  function reloadFromLocal() {
    ensureLocalDefaults();
    state = SettingsRepository.loadLocal(SettingsDefaults);
    return state;
  }

  function getData() {
    if (!state) reloadFromLocal();
    return state;
  }

  function persistLocal(data = getData()) {
    state = SettingsEntity.normalize(data, SettingsDefaults);
    SettingsRepository.saveLocal(state);
  }

  async function retryPending() {
    const user = Session.getUser();
    if (!user || !Contracts.canRole(user.role, Contracts.Actions.SAVE_SETTINGS)) return false;
    return SettingsRepository.retryPending();
  }

  function primeFromReference(directory) {
    if (!directory || typeof directory !== 'object') return getData();
    const healthAdmins = {};
    (directory.healthAdmins || []).forEach(a => { if (a?.name) healthAdmins[a.name] = []; });
    (directory.facilities || []).forEach(f => {
      if (f?.mainType === 'إدارات صحية' && f.healthAdmin) {
        if (!healthAdmins[f.healthAdmin]) healthAdmins[f.healthAdmin] = [];
        healthAdmins[f.healthAdmin].push(f.name);
      }
    });
    const next = {
      healthAdmins,
      cars: Array.isArray(directory.cars) ? directory.cars : getData().cars,
      drivers: Array.isArray(directory.drivers) ? directory.drivers : getData().drivers,
      govFacilities: (directory.facilities || []).filter(f => f.mainType === 'منشأت حكومية').map(f => f.name),
      privateFacilities: (directory.facilities || []).filter(f => f.mainType === 'منشأت خاصة').map(f => f.name),
      privateCompanies: (directory.facilities || []).filter(f => f.mainType === 'شركات خاصة').map(f => f.name),
      treatmentUnits: (directory.treatmentUnits || []).map(t => t.name)
    };
    state = SettingsEntity.normalize(next, SettingsDefaults);
    persistLocal(state);
    SettingsRepository.prime(state);
    return state;
  }

  async function refreshFromCloud(options = {}) {
    const repo = MW.EntitiesRepository;
    if (repo?.list) {
      const directory = await repo.list({force:!!options.force,maxAgeMs:Number(options.maxAgeMs)||300000});
      return primeFromReference(directory);
    }
    const maxAgeMs = options.force ? 0 : (Number(options.maxAgeMs) || 300000);
    if (!options.force && SettingsRepository.isCloudFresh(maxAgeMs)) return getData();
    const cloudData = await SettingsRepository.fetchCloud(SettingsDefaults);
    if (!cloudData) return getData();
    state = SettingsEntity.normalize(Object.assign({}, getData(), cloudData), SettingsDefaults);
    persistLocal(state);
    return state;
  }

  async function save() {
    const data = getData();
    Validators.assertSettings(data);
    persistLocal(data);
    return SettingsRepository.saveCloud(data);
  }

  function replaceLocalSettings(data) {
    if (!data || typeof data !== 'object') return getData();
    state = SettingsRepository.fromLegacyBundle(data, SettingsDefaults);
    persistLocal(state);
    return state;
  }

  function exportBackupSettings() {
    return SettingsRepository.exportLegacyBundle(getData());
  }

  MW.SettingsService = Object.freeze({
    ensureLocalDefaults,
    reloadFromLocal,
    getData,
    persistLocal,
    retryPending,
    refreshFromCloud, primeFromReference,
    save,
    replaceLocalSettings,
    exportBackupSettings
  });
})(window.MedWaste);
