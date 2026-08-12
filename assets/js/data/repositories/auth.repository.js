(function (MW) {
  'use strict';

  const { Api, Contracts, UserMapper } = MW;

  async function login(email, password) {
    const response = await Api.post(Contracts.Actions.LOGIN, { email, password });
    if (response.user) response.user = UserMapper.toSession(response.user);
    return response;
  }

  function register(payload) { return Api.post(Contracts.Actions.REGISTER, payload); }
  function forgotPassword(email) { return Api.post(Contracts.Actions.FORGOT_PASSWORD, { email }); }
  function logout() { return Api.post(Contracts.Actions.LOGOUT, {}); }
  function logoutDetached() { return Api.postDetached(Contracts.Actions.LOGOUT, {}); }

  MW.AuthRepository = Object.freeze({ login, register, forgotPassword, logout, logoutDetached });
})(window.MedWaste);
