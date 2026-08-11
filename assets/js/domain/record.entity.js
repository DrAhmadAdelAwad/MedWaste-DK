(function (MW) {
  'use strict';
  const TEXT_FIELDS=['recordId','tripId','reportDate','treatmentUnit','driverName','carNumber','facilityMainType','healthAdmin','subFacilityName','facilityName','visitType','weightUnit','createdBy','timestamp','_syncStatus','facilityId','treatmentUnitId','tripReference','entrySource'];
  function normalize(input={}){const r={};TEXT_FIELDS.forEach(k=>{if(input[k]!=null)r[k]=String(input[k]).trim();});r.subFacilityName=r.subFacilityName||r.facilityName||'';r.facilityName=r.facilityName||r.subFacilityName||'';const w=Number(input.wasteWeight);r.wasteWeight=Number.isFinite(w)?w:0;return r;}
  function signature(input){const r=normalize(input);return [r.entrySource,r.facilityId,r.treatmentUnitId,r.reportDate,r.tripReference,r.driverName,r.carNumber,r.visitType,String(r.wasteWeight),r.weightUnit].join('|');}
  function isPending(record){return normalize(record)._syncStatus==='pending';}
  MW.RecordEntity=Object.freeze({normalize,signature,isPending});
})(window.MedWaste);
