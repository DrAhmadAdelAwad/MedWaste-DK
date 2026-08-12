(function (MW) {
  'use strict';

  const { AuthRepository, Session, Validators, SettingsRepository, EntitiesRepository } = MW;

  async function login(email, password) {
    Validators.assertLogin(email, password);
    const result = await AuthRepository.login(email, password);
    if (result.result === 'success' && result.user) {
      Session.setUser(result.user);
      if (result.bootstrap?.settings && SettingsRepository?.prime) SettingsRepository.prime(result.bootstrap.settings);
      if (result.bootstrap?.entities && EntitiesRepository?.prime) EntitiesRepository.prime(result.bootstrap.entities);
    }
    return result;
  }

  function registrationKeyFor(email) { return AuthRepository.registrationKeyFor(email); }
  function clearRegistrationKey() { return AuthRepository.clearRegistrationKey(); }
  function register(payload) {
    Validators.assertRegistration(payload);
    return AuthRepository.register(payload);
  }

  function forgotPassword(email) {
    Validators.assertEmail(email);
    return AuthRepository.forgotPassword(email);
  }

  function logout() {
    try { AuthRepository.logoutDetached(); } catch (_) {}
    Session.clearUser();
    window.location.href = 'login.html';
  }

  MW.Auth = Object.freeze({ login, register, registrationKeyFor, clearRegistrationKey, forgotPassword, logout });
})(window.MedWaste);
