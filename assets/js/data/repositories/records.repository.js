(function (MW) {
  'use strict'; const {Storage,Api,Contracts,RecordEntity,RecordMapper}=MW;
  function storageKey(source){return source===Contracts.EntrySources.FACILITY?Storage.KEYS.facilityRecords:Storage.KEYS.treatmentRecords;}
  function migrateLegacyTreatment(){if(!Storage.has(Storage.KEYS.treatmentRecords)&&Storage.has(Storage.KEYS.records)){const old=Storage.getJson(Storage.KEYS.records,[]);Storage.setJson(Storage.KEYS.treatmentRecords,Array.isArray(old)?old.map(r=>Object.assign({},r,{entrySource:r.entrySource||Contracts.EntrySources.TREATMENT})):[]);}}
  function getLocal(source=Contracts.EntrySources.TREATMENT){migrateLegacyTreatment();const arr=Storage.getJson(storageKey(source),[]);return Array.isArray(arr)?arr.map(RecordMapper.fromStorage):[];}
  function saveLocal(source,records){Storage.setJson(storageKey(source),Array.isArray(records)?records:[]);}
  function mergeCloudWithLocal(cloudRecords,localRecords){const cloud=Array.isArray(cloudRecords)?cloudRecords:[],local=Array.isArray(localRecords)?localRecords:[],merged=cloud.map(r=>{const c=Object.assign({},r);delete c._syncStatus;return c;}),ids=new Set(),sigs=new Set();merged.forEach(r=>{if(r.recordId)ids.add(String(r.recordId));sigs.add(RecordEntity.signature(r));});local.forEach(r=>{const id=r.recordId?String(r.recordId):'';if(id&&ids.has(id))return;const sig=RecordEntity.signature(r);if(!id&&sigs.has(sig))return;if(RecordEntity.isPending(r)||!id){merged.push(r);if(id)ids.add(id);sigs.add(sig);}});return merged;}
  async function fetchCloudPaged(source=Contracts.EntrySources.TREATMENT){const all=[],pageSize=Contracts.Limits.RECORDS_PAGE_SIZE_DEFAULT||500;let page=1;for(let guard=0;guard<500;guard+=1){const response=await Api.read(Contracts.Actions.GET_RECORDS,{page,pageSize,source});all.push(...(response.data||[]).map(RecordMapper.fromApi));const p=response.pagination;if(!p||!p.hasMore)break;page=Number(p.page||page)+1;}return all;}
  async function fetchMerged(source=Contracts.EntrySources.TREATMENT){const local=getLocal(source).slice(),cloud=await fetchCloudPaged(source),merged=mergeCloudWithLocal(cloud,local);saveLocal(source,merged);return merged;}
  async function saveBatch(source,records){const payload=(records||[]).map(RecordMapper.toApi);return Api.post(Contracts.Actions.ADD_RECORDS_BATCH,{source,recordsData:JSON.stringify(payload)});}
  async function deleteTripCloud(source,tripId){return Api.post(Contracts.Actions.DELETE_TRIP,{source,tripId:String(tripId||'').trim()});}
  function markSynced(source,ids){const wanted=new Set((ids||[]).map(String)),records=getLocal(source);records.forEach(r=>{if(r.recordId&&wanted.has(String(r.recordId)))delete r._syncStatus;});saveLocal(source,records);return records;}
  function appendLocal(source,records){const current=getLocal(source);current.push(...records);saveLocal(source,current);return current;}
  function removeByIds(source,ids){const wanted=new Set((ids||[]).map(String));const records=getLocal(source).filter(r=>!r.recordId||!wanted.has(String(r.recordId)));saveLocal(source,records);return records;}
  function removeTripLocal(source,tripId){const id=String(tripId||'').trim(),records=getLocal(source).filter(r=>String(r.tripId||'').trim()!==id);saveLocal(source,records);return records;}
  function clearLocal(source){Storage.remove(storageKey(source));}
  MW.RecordsRepository=Object.freeze({getLocal,saveLocal,mergeCloudWithLocal,fetchCloudPaged,fetchMerged,saveBatch,deleteTripCloud,markSynced,appendLocal,removeByIds,removeTripLocal,clearLocal});
})(window.MedWaste);
