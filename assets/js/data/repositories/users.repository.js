(function(MW){
  'use strict';
  const {Api,Contracts,UserMapper,Storage}=MW;const TTL=300000;
  function cachedBundle(){const b=Storage.getJson(Storage.KEYS.usersBundle,null);return b&&Array.isArray(b.users)?b:null;}
  function isFresh(){const at=Number(Storage.getText(Storage.KEYS.usersFetchedAt,'0'))||0;return !!cachedBundle()&&Date.now()-at<TTL;}
  function saveBundle(bundle){Storage.setJson(Storage.KEYS.usersBundle,bundle);Storage.setText(Storage.KEYS.usersFetchedAt,Date.now());return bundle;}
  function invalidate(){Storage.remove(Storage.KEYS.usersFetchedAt);}
  async function listBundle(options={}){const local=cachedBundle();if(!options.force&&isFresh())return local;try{const r=await Api.read(Contracts.Actions.GET_USERS),rawEntities=r.entities||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]},entities=MW.EntitiesRepository?.normalizeDirectory?MW.EntitiesRepository.normalizeDirectory(rawEntities):rawEntities,bundle={users:(r.data||[]).map(UserMapper.fromApi),entities};return saveBundle(bundle);}catch(e){if(local)return local;throw e;}}
  async function list(){return (await listBundle()).users;}
  async function updateRole(email,newRole,entityId=''){const r=await Api.post(Contracts.Actions.UPDATE_ROLE,{targetEmail:email,newRole,entityId});invalidate();return r;}
  async function deleteUser(email){const r=await Api.post(Contracts.Actions.DELETE_USER,{targetEmail:email});invalidate();return r;}
  MW.UsersRepository=Object.freeze({list,listBundle,cachedBundle,isFresh,invalidate,updateRole,deleteUser});
})(window.MedWaste);