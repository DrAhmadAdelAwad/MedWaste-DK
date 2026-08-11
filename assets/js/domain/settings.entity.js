(function (MW) {
  'use strict';

  const { Utils } = MW;
  const KEYS = Object.freeze(['healthAdmins', 'cars', 'drivers', 'govFacilities', 'privateFacilities', 'privateCompanies', 'treatmentUnits']);

  function normalize(input = {}, defaults = {}) {
    const result = {};
    KEYS.forEach(key => {
      const fallback = defaults[key] != null ? defaults[key] : (key === 'healthAdmins' ? {} : []);
      result[key] = Utils.clone(input[key] != null ? input[key] : fallback);
    });
    return result;
  }

  MW.SettingsEntity = Object.freeze({ KEYS, normalize });
})(window.MedWaste);
