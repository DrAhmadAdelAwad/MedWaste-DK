(function(MW){
  'use strict';
  const {Api,Contracts,Storage}=MW;
  const DEFAULT_TTL_MS=300000;
  function cached(){const data=Storage.getJson(Storage.KEYS.entitiesDirectory,null);return data&&typeof data==='object'?data:null;}
  function isFresh(maxAgeMs=DEFAULT_TTL_MS){const at=Number(Storage.getText(Storage.KEYS.entitiesFetchedAt,'0'))||0;return !!cached()&&at>0&&(Date.now()-at)<Math.max(0,Number(maxAgeMs)||0);}
  function saveCache(data){Storage.setJson(Storage.KEYS.entitiesDirectory,data||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]});Storage.setText(Storage.KEYS.entitiesFetchedAt,Date.now());return data;}
  function invalidate(){Storage.remove(Storage.KEYS.entitiesDirectory);Storage.remove(Storage.KEYS.entitiesFetchedAt);}
  async function registrationOptions(){const r=await Api.post(Contracts.Actions.GET_REGISTRATION_OPTIONS);return r.data||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]};}
  async function list(options={}){const maxAgeMs=options.force?0:(Number(options.maxAgeMs)||DEFAULT_TTL_MS);if(!options.force&&isFresh(maxAgeMs))return cached();try{const r=await Api.read(Contracts.Actions.GET_ENTITIES);return saveCache(r.data||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]});}catch(error){const local=cached();if(local)return local;throw error;}}
  function prime(data){return saveCache(data||{facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]});}
  MW.EntitiesRepository=Object.freeze({registrationOptions,list,cached,isFresh,invalidate,prime});
})(window.MedWaste);
