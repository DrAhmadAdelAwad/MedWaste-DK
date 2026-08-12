(function(MW){
  'use strict';
  const {Api,Contracts,UserMapper}=MW;
  async function listBundle(){
    const r=await Api.read(Contracts.Actions.GET_USERS);
    return {users:(r.data||[]).map(UserMapper.fromApi),entities:r.entities||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]}};
  }
  async function list(){return (await listBundle()).users;}
  function updateRole(email,newRole,entityId=''){return Api.post(Contracts.Actions.UPDATE_ROLE,{targetEmail:email,newRole,entityId});}
  function deleteUser(email){return Api.post(Contracts.Actions.DELETE_USER,{targetEmail:email});}
  MW.UsersRepository=Object.freeze({list,listBundle,updateRole,deleteUser});
})(window.MedWaste);