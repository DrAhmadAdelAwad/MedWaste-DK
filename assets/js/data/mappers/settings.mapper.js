(function (MW) {
  'use strict';

  const { SettingsEntity, Utils } = MW;

  function fromApi(input, defaults) {
    const parsed = Utils.parseMaybeJson(input) || {};
    return SettingsEntity.normalize(parsed, defaults);
  }

  MW.SettingsMapper = Object.freeze({ fromApi });
})(window.MedWaste);
