(function(MW){'use strict';
const {Api,Contracts,RecordMapper,ReconciliationEngine,EntitiesRepository}=MW;
const clean=v=>String(v??'').trim();
async function scoped(source,filters){
  const payload={source,startDate:filters.startDate||'',endDate:filters.endDate||''};
  if(filters.facilityId)payload.facilityId=filters.facilityId;
  if(filters.healthAdmin){payload.healthAdmin=filters.healthAdmin;payload.facilityMainType='إدارات صحية';}
  if(filters.healthAdminId)payload.healthAdminId=filters.healthAdminId;
  const r=await Api.read(Contracts.Actions.GET_RECORDS,payload);
  return (r.data||[]).map(RecordMapper.fromApi);
}
async function compare(filters){
  const [facility,treatment]=await Promise.all([scoped(Contracts.EntrySources.FACILITY,filters),scoped(Contracts.EntrySources.TREATMENT,filters)]);
  const fid=clean(filters.facilityId);
  return ReconciliationEngine.build(facility.filter(r=>clean(r.facilityId)===fid),treatment.filter(r=>clean(r.facilityId)===fid),{entityType:Contracts.EntityTypes.FACILITY,entityId:fid,label:filters.label||filters.facilityName||fid||'المنشأة'});
}
async function compareHealthAdmin(filters){
  const adminName=clean(filters.healthAdmin||filters.entityId);
  let directory=null,admin=null,canonicalName=adminName,adminId='',allowedIds=new Set((filters.allowedFacilityIds||[]).map(clean).filter(Boolean));
  if(!allowedIds.size){
    directory=await EntitiesRepository.list({maxAgeMs:300000});
    admin=(directory.healthAdmins||[]).find(a=>clean(a.name)===adminName||clean(a.entityId)===adminName);
    canonicalName=clean(admin?.name||adminName);adminId=clean(admin?.entityId||'');
    const allowed=(directory.facilities||[]).filter(f=>f.mainType==='إدارات صحية'&&clean(f.healthAdmin)===canonicalName);
    allowedIds=new Set(allowed.map(f=>clean(f.entityId)).filter(Boolean));
  }
  if(!allowedIds.size)throw new Error('لم يتم العثور على وحدات تابعة للإدارة المختارة في دليل الجهات. حدّث القوائم ثم حاول مرة أخرى.');
  const query=Object.assign({},filters,{healthAdmin:canonicalName,healthAdminId:adminId});
  const [facilityRaw,treatmentRaw]=await Promise.all([scoped(Contracts.EntrySources.FACILITY,query),scoped(Contracts.EntrySources.TREATMENT,query)]);
  /* Defense in depth: even if a stale backend accidentally returns broader data,
     the browser cannot render a facility outside the selected administration. */
  const facility=facilityRaw.filter(r=>allowedIds.has(clean(r.facilityId)));
  const treatment=treatmentRaw.filter(r=>allowedIds.has(clean(r.facilityId)));
  return ReconciliationEngine.build(facility,treatment,{entityType:Contracts.EntityTypes.HEALTH_ADMIN,entityId:adminId||canonicalName,label:`الإدارة الصحية: ${canonicalName}`});
}
async function authorizeClaim(scope){return Api.post(Contracts.Actions.AUTHORIZE_CLAIM,scope);}
MW.ReconciliationRepository=Object.freeze({compare,compareHealthAdmin,authorizeClaim});
})(window.MedWaste);
