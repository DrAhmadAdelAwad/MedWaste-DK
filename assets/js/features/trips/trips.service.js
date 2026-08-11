(function(MW){
  'use strict';
  const {Session,Utils,Contracts,Validators,Errors,RecordsRepository,TripEntity}=MW;
  const Logger=MW.Logger||{warn(){}};

  function sourceForUser(){
    const role=Session.getUser()?.role;
    return role===Contracts.Roles.FACILITY_ENTRY?Contracts.EntrySources.FACILITY:Contracts.EntrySources.TREATMENT;
  }
  function makeReference(date){return `MW-${String(date||'').replace(/-/g,'')}-${Utils.generateId('').replace(/[^a-zA-Z0-9]/g,'').slice(0,8).toUpperCase()}`;}
  function validateForSource(source,batch){
    if(source===Contracts.EntrySources.FACILITY){
      if(!Array.isArray(batch)||batch.length!==1)throw Errors.validation('مدخل المنشأة يسجل منشأته فقط في كل عملية.');
      Validators.assertFacility(batch[0],false);
      return;
    }
    Validators.assertBatch(batch);
    const missing=(batch||[]).find(item=>!String(item?.tripReference||'').trim());
    if(missing)throw Errors.validation('مرجع الرحلة الصادر من المنشأة مطلوب لكل منشأة قبل حفظ إدخال وحدة المعالجة.');
  }
  function createRecords(route,batch){
    const user=Session.getUser(),source=sourceForUser(),effectiveRoute=Object.assign({},route);
    if(source===Contracts.EntrySources.FACILITY&&!effectiveRoute.tripReference)effectiveRoute.tripReference=makeReference(route.reportDate);
    return TripEntity.createRecords(effectiveRoute,batch,{generateId:Utils.generateId,createdBy:user?user.fullName:'',timestamp:new Date().toISOString(),entrySource:source});
  }
  async function save(route,batch){
    Validators.assertRoute(route);
    const source=sourceForUser();
    validateForSource(source,batch);
    const records=createRecords(route,batch);
    RecordsRepository.appendLocal(source,records);
    let cloudSaved=false,response=null;
    try{
      response=await RecordsRepository.saveBatch(source,records);
      if(response.result==='success'){
        RecordsRepository.markSynced(source,records.map(r=>r.recordId));
        cloudSaved=true;
      }
    }catch(error){
      if(!Errors.isRetryable(error)){
        RecordsRepository.removeByIds(source,records.map(r=>r.recordId));
        throw error;
      }
      Logger.warn('trip_cloud_save_deferred',{error,pendingRecords:records.length,source});
    }
    const tripReferences=[...new Set(records.map(r=>String(r.tripReference||'').trim()).filter(Boolean))];
    return{records,cloudSaved,response,source,tripReference:tripReferences[0]||'',tripReferences};
  }
  async function syncPending(){
    const source=sourceForUser(),pending=RecordsRepository.getLocal(source).filter(r=>r&&r._syncStatus==='pending'&&r.recordId&&r.tripId);
    if(!pending.length||!Session.getToken())return{synced:0};
    const response=await RecordsRepository.saveBatch(source,pending);
    if(response.result==='success'){
      RecordsRepository.markSynced(source,pending.map(r=>r.recordId));
      return{synced:pending.length};
    }
    return{synced:0};
  }
  const group=records=>TripEntity.group(records);
  async function deleteTrip(tripId,source=Contracts.EntrySources.TREATMENT){
    const response=await RecordsRepository.deleteTripCloud(source,tripId);
    if(response.result!=='success')throw new Error(response.message||'فشل الحذف');
    return RecordsRepository.removeTripLocal(source,tripId);
  }
  MW.Trips=Object.freeze({sourceForUser,makeReference,createRecords,save,syncPending,group,deleteTrip});
})(window.MedWaste);
