(function (MW) {
  'use strict';
  const { UserEntity } = MW;
  MW.UserMapper = Object.freeze({ fromApi: UserEntity.normalize, toSession: UserEntity.normalize });
})(window.MedWaste);
