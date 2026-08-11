(function (MW) {
  'use strict';

  const { AuthRepository, Session, Validators } = MW;

  async function login(email, password) {
    Validators.assertLogin(email, password);
    const result = await AuthRepository.login(email, password);
    if (result.result === 'success' && result.user) Session.setUser(result.user);
    return result;
  }

  function register(payload) {
    Validators.assertRegistration(payload);
    return AuthRepository.register(payload);
  }

  function forgotPassword(email) {
    Validators.assertEmail(email);
    return AuthRepository.forgotPassword(email);
  }

  async function logout() {
    try { await AuthRepository.logout(); } catch (_) {}
    Session.clearUser();
    window.location.href = 'login.html';
  }

  MW.Auth = Object.freeze({ login, register, forgotPassword, logout });
})(window.MedWaste);
