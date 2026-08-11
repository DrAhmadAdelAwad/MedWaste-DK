(function (MW) {
  'use strict';

  const { Storage } = MW;

  function getUser() {
    return Storage.getJson(Storage.KEYS.currentUser, null);
  }

  function setUser(user) {
    Storage.setJson(Storage.KEYS.currentUser, user);
  }

  function clearUser() {
    Storage.remove(Storage.KEYS.currentUser);
  }

  function getToken() {
    const user = getUser();
    return user && user.sessionToken ? user.sessionToken : '';
  }

  function isLoggedIn() {
    return Boolean(getUser());
  }

  function hasRole(role) {
    const user = getUser();
    return Boolean(user && user.role === role);
  }

  MW.Session = Object.freeze({
    getUser,
    setUser,
    clearUser,
    getToken,
    isLoggedIn,
    hasRole
  });
})(window.MedWaste);
