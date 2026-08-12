(function (MW) {
  'use strict';

  const { Api, Contracts, UserMapper, Storage, Utils } = MW;

  async function login(email, password) {
    const response = await Api.post(Contracts.Actions.LOGIN, { email, password });
    if (response.user) response.user = UserMapper.toSession(response.user);
    return response;
  }

  function registrationKeyFor(email) {
    const normalized = String(email || '').trim().toLowerCase();
    const oldEmail = Storage.getSessionText(Storage.KEYS.registrationEmail, '');
    const oldKey = Storage.getSessionText(Storage.KEYS.registrationKey, '');
    if (oldKey && oldEmail === normalized) return oldKey;
    const key = Utils.generateId('reg-');
    Storage.setSessionText(Storage.KEYS.registrationEmail, normalized);
    Storage.setSessionText(Storage.KEYS.registrationKey, key);
    return key;
  }
  function clearRegistrationKey() {
    Storage.removeSession(Storage.KEYS.registrationEmail);
    Storage.removeSession(Storage.KEYS.registrationKey);
  }
  function register(payload) { return Api.post(Contracts.Actions.REGISTER, payload); }
  function forgotPassword(email) { return Api.post(Contracts.Actions.FORGOT_PASSWORD, { email }); }
  function logout() { return Api.post(Contracts.Actions.LOGOUT, {}); }
  function logoutDetached() { return Api.postDetached(Contracts.Actions.LOGOUT, {}); }

  MW.AuthRepository = Object.freeze({ login, register, registrationKeyFor, clearRegistrationKey, forgotPassword, logout, logoutDetached });
})(window.MedWaste);
