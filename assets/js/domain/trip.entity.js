(function (MW) {
  'use strict'; const {RecordEntity}=MW;
  function createRecords(route,batch,options={}){
    const tripId=options.tripId||options.generateId('trip-'),timestamp=options.timestamp||new Date().toISOString(),createdBy=options.createdBy||'',source=options.entrySource||'',defaultReference=route.tripReference||options.tripReference||'';
    return (batch||[]).map(item=>RecordEntity.normalize({recordId:options.generateId('rec-'),tripId,reportDate:route.reportDate,treatmentUnit:route.treatmentUnit||'',treatmentUnitId:route.treatmentUnitId||'',driverName:route.driverName,carNumber:route.carNumber,facilityMainType:item.facilityMainType,healthAdmin:item.healthAdmin,subFacilityName:item.subFacilityName,facilityName:item.subFacilityName,facilityId:item.facilityId||'',visitType:item.visitType,wasteWeight:item.wasteWeight,weightUnit:item.weightUnit,tripReference:item.tripReference||defaultReference,entrySource:source,createdBy,timestamp,_syncStatus:'pending'}));
  }
  function group(records){const map=new Map();(records||[]).forEach((raw,index)=>{const r=RecordEntity.normalize(raw),key=r.tripId||`legacy_${r.entrySource}_${r.reportDate}_${r.tripReference}_${r.driverName}_${r.carNumber}`;if(!map.has(key))map.set(key,{tripKey:key,tripId:r.tripId||key,tripReference:r.tripReference,entrySource:r.entrySource,reportDate:r.reportDate,treatmentUnit:r.treatmentUnit,treatmentUnitId:r.treatmentUnitId,driverName:r.driverName,carNumber:r.carNumber,timestamp:r.timestamp||'غير متوفر',createdBy:r.createdBy||'غير مسجل',facilities:[]});map.get(key).facilities.push(Object.assign({originalIndex:index},raw,r));});return Array.from(map.values());}
  MW.TripEntity=Object.freeze({createRecords,group});
})(window.MedWaste);
