(function(MW){
  'use strict';
  const {Session,Utils,Contracts,Validators,Errors,RecordsRepository,TripEntity}=MW;
  const Logger=MW.Logger||{warn(){}};
  function isPrivileged(){const role=Session.getUser()?.role;return role===Contracts.Roles.SUPERVISOR||role===Contracts.Roles.ADMIN;}
  function sourceForUser(sourceOverride){
    const role=Session.getUser()?.role;if(isPrivileged()&&sourceOverride)return sourceOverride===Contracts.EntrySources.FACILITY?Contracts.EntrySources.FACILITY:Contracts.EntrySources.TREATMENT;
    return role===Contracts.Roles.FACILITY_ENTRY?Contracts.EntrySources.FACILITY:Contracts.EntrySources.TREATMENT;
  }
  function makeReference(date,source){const side=source===Contracts.EntrySources.FACILITY?'F':'T';return `MW-${side}-${String(date||'').replace(/-/g,'')}-${Utils.generateId('').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase()}`;}
  function validateForSource(source,batch){
    if(source===Contracts.EntrySources.FACILITY){if(!Array.isArray(batch)||batch.length!==1)throw Errors.validation('إدخال جهة المنشأة يسجل منشأة أو وحدة واحدة في كل عملية.');const u=Session.getUser()||{},autoAssigned=u.role===Contracts.Roles.FACILITY_ENTRY&&u.entityType===Contracts.EntityTypes.FACILITY;Validators.assertFacility(batch[0],!autoAssigned);return;}
    Validators.assertBatch(batch);
  }
  function createRecords(route,batch,sourceOverride){
    const user=Session.getUser(),source=sourceForUser(sourceOverride),effectiveRoute=Object.assign({},route);
    const preparedBatch=(batch||[]).map(item=>Object.assign({},item,{tripReference:String(item?.tripReference||'').trim()||makeReference(route.reportDate,source)}));
    return TripEntity.createRecords(effectiveRoute,preparedBatch,{generateId:Utils.generateId,createdBy:user?user.fullName:'',timestamp:new Date().toISOString(),entrySource:source});
  }
  async function save(route,batch,sourceOverride){Validators.assertRoute(route);const source=sourceForUser(sourceOverride);validateForSource(source,batch);const records=createRecords(route,batch,source);RecordsRepository.appendLocal(source,records);let cloudSaved=false,response=null;try{response=await RecordsRepository.saveBatch(source,records);if(response.result==='success'){RecordsRepository.markSynced(source,records.map(r=>r.recordId));cloudSaved=true;}}catch(error){if(!Errors.isRetryable(error)){RecordsRepository.removeByIds(source,records.map(r=>r.recordId));throw error;}Logger.warn('trip_cloud_save_deferred',{error,pendingRecords:records.length,source});}return{records,cloudSaved,response,source};}
  function saveResponsive(route,batch,sourceOverride){Validators.assertRoute(route);const source=sourceForUser(sourceOverride);validateForSource(source,batch);const records=createRecords(route,batch,source);RecordsRepository.appendLocal(source,records);const cloudPromise=RecordsRepository.saveBatch(source,records).then(response=>{if(response.result==='success'){RecordsRepository.markSynced(source,records.map(r=>r.recordId));return{cloudSaved:true,response};}return{cloudSaved:false,response};}).catch(error=>{if(!Errors.isRetryable(error))RecordsRepository.removeByIds(source,records.map(r=>r.recordId));Logger.warn('trip_background_sync_deferred',{error,pendingRecords:records.length,source});return{cloudSaved:false,error};});return{records,source,cloudPromise,cloudSaved:false};}
  async function syncPending(sourceOverride){
    const sources=isPrivileged()&&!sourceOverride?[Contracts.EntrySources.FACILITY,Contracts.EntrySources.TREATMENT]:[sourceForUser(sourceOverride)];let synced=0;
    for(const source of sources){const pending=RecordsRepository.getLocal(source).filter(r=>r&&r._syncStatus==='pending'&&r.recordId&&r.tripId);if(!pending.length||!Session.getToken())continue;const response=await RecordsRepository.saveBatch(source,pending,{dedupeCheck:true});if(response.result==='success'){RecordsRepository.markSynced(source,pending.map(r=>r.recordId));synced+=pending.length;}}
    return{synced};
  }
  const group=records=>TripEntity.group(records);
  async function deleteTrip(tripId,source=Contracts.EntrySources.TREATMENT){const response=await RecordsRepository.deleteTripCloud(source,tripId);if(response.result!=='success')throw new Error(response.message||'فشل الحذف');return RecordsRepository.removeTripLocal(source,tripId);}
  MW.Trips=Object.freeze({sourceForUser,makeReference,createRecords,save,saveResponsive,syncPending,group,deleteTrip});
})(window.MedWaste);
