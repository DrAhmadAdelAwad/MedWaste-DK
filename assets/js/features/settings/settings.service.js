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

  async function refreshFromCloud() {
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
    refreshFromCloud,
    save,
    replaceLocalSettings,
    exportBackupSettings
  });
})(window.MedWaste);
