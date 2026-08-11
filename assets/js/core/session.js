(function (MW) {
  'use strict';

  const { Storage } = MW;

  function migrateLegacyToken_(user) {
    if (!user || !user.sessionToken) return user;
    if (!Storage.getSessionText(Storage.KEYS.sessionToken, '')) {
      Storage.setSessionText(Storage.KEYS.sessionToken, user.sessionToken);
    }
    const cleanUser = Object.assign({}, user);
    delete cleanUser.sessionToken;
    Storage.setJson(Storage.KEYS.currentUser, cleanUser);
    return cleanUser;
  }

  function getUser() {
    const user = Storage.getJson(Storage.KEYS.currentUser, null);
    return migrateLegacyToken_(user);
  }

  function setUser(user) {
    if (!user || typeof user !== 'object') {
      clearUser();
      return;
    }
    const copy = Object.assign({}, user);
    const token = copy.sessionToken ? String(copy.sessionToken) : '';
    delete copy.sessionToken;
    Storage.setJson(Storage.KEYS.currentUser, copy);
    if (token) Storage.setSessionText(Storage.KEYS.sessionToken, token);
  }

  function clearUser() {
    Storage.remove(Storage.KEYS.currentUser);
    Storage.removeSession(Storage.KEYS.sessionToken);
  }

  function getToken() {
    getUser(); // Performs one-time migration from Stage 7 persisted user data.
    return Storage.getSessionText(Storage.KEYS.sessionToken, '');
  }

  function isLoggedIn() { return Boolean(getUser() && getToken()); }

  function hasRole(role) {
    const user = getUser();
    return Boolean(user && user.role === role && getToken());
  }

  MW.Session = Object.freeze({ getUser, setUser, clearUser, getToken, isLoggedIn, hasRole });
})(window.MedWaste);
