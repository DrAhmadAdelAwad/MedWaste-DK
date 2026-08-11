(function (MW) {
  'use strict';

  function normalize(input = {}) {
    return {
      fullName: String(input.fullName || '').trim(),
      jobTitle: String(input.jobTitle || '').trim(),
      workplace: String(input.workplace || '').trim(),
      mobile: String(input.mobile || '').trim(),
      email: String(input.email || '').trim().toLowerCase(),
      role: String(input.role || '').trim(),
      sessionToken: input.sessionToken ? String(input.sessionToken) : ''
    };
  }

  MW.UserEntity = Object.freeze({ normalize });
})(window.MedWaste);
