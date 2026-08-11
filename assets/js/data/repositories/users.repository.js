(function (MW) {
  'use strict';

  const { Api, Contracts, UserMapper } = MW;

  async function list() {
    const response = await Api.read(Contracts.Actions.GET_USERS);
    return (response.data || []).map(UserMapper.fromApi);
  }

  function updateRole(email, newRole) {
    return Api.post(Contracts.Actions.UPDATE_ROLE, { targetEmail: email, newRole });
  }

  MW.UsersRepository = Object.freeze({ list, updateRole });
})(window.MedWaste);
