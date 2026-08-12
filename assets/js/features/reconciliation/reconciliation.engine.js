(function(MW){
  'use strict';
  const Status=MW.Contracts.ReconciliationStatus;
  const TOLERANCE=0.01;
  const clean=v=>String(v??'').trim();
  const round=v=>Math.round((Number(v)||0)*1000)/1000;
  function weightKg(r){let w=Number(r?.wasteWeight||0);if(!Number.isFinite(w)||clean(r?.visitType)==='زيارة فقط بدون نقل')return 0;const u=clean(r?.weightUnit);if(u==='جرام'||u==='جم')w/=1000;else if(u==='طن')w*=1000;return round(w);}
  function sortKey(r){return [clean(r?.timestamp),clean(r?.recordId),clean(r?.tripReference)].join('|');}
  function item(r){return{record:r,weightKg:weightKg(r),visitType:clean(r?.visitType),carNumber:clean(r?.carNumber),driverName:clean(r?.driverName),sortKey:sortKey(r)};}
  function tie(a,b){let s=0;if(a.carNumber&&b.carNumber&&a.carNumber!==b.carNumber)s+=10;if(a.driverName&&b.driverName&&a.driverName!==b.driverName)s+=1;return s;}
  function autoPair(facility,treatment){
    const fs=(facility||[]).map(item).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
    const ts=(treatment||[]).map(item).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
    const used=new Set(),pairs=[];let no=0;
    function pair(f,t){no++;const fw=f?.weightKg||0,tw=t?.weightKg||0,diff=round(tw-fw),same=!!f&&!!t&&f.visitType===t.visitType;let status,matched=false,reason='';
      if(f&&!t){status=Status.FACILITY_ONLY;reason='لا يوجد إدخال مقابل في وحدة المعالجة.';}
      else if(!f&&t){status=Status.TREATMENT_ONLY;reason='لا يوجد إدخال مقابل من المنشأة.';}
      else if(same&&Math.abs(diff)<=TOLERANCE){status=Status.MATCHED;matched=true;reason='تمت المطابقة آلياً على المنشأة واليوم والوزن.';}
      else{status=Status.WEIGHT_MISMATCH;reason=!same?'نوع الزيارة مختلف بين الطرفين.':'يوجد فرق وزن بين الإدخالين.';}
      return{matchId:`AUTO-${no}`,facilityRecordId:clean(f?.record?.recordId),treatmentRecordId:clean(t?.record?.recordId),facilityWeightKg:fw,treatmentWeightKg:tw,differenceKg:diff,facilityVisitType:f?.visitType||'',treatmentVisitType:t?.visitType||'',status,matched,reason};
    }
    fs.forEach(f=>{let best=-1,bestScore=Infinity;ts.forEach((t,j)=>{if(used.has(j)||f.visitType!==t.visitType)return;const d=Math.abs(f.weightKg-t.weightKg);const score=tie(f,t)+d;if(d<=TOLERANCE&&score<bestScore){best=j;bestScore=score;}});if(best>=0){used.add(best);f._paired=true;pairs.push(pair(f,ts[best]));}});
    fs.filter(f=>!f._paired).forEach(f=>{let best=-1,bestScore=Infinity;ts.forEach((t,j)=>{if(used.has(j))return;const score=(f.visitType===t.visitType?0:1000000)+Math.abs(f.weightKg-t.weightKg)+tie(f,t)/1000;if(score<bestScore){best=j;bestScore=score;}});if(best>=0){used.add(best);pairs.push(pair(f,ts[best]));}else pairs.push(pair(f,null));});
    ts.forEach((t,j)=>{if(!used.has(j))pairs.push(pair(null,t));});return pairs;
  }
  function build(facility,treatment,scope){
    const map=new Map();
    function add(r,side){const fid=clean(r?.facilityId),date=clean(r?.reportDate),key=`${fid}|${date}`;if(!map.has(key))map.set(key,{facilityId:fid,facilityName:r?.subFacilityName||r?.facilityName||'',healthAdmin:r?.healthAdmin||'',reportDate:date,facilityRecords:[],treatmentRecords:[]});map.get(key)[`${side}Records`].push(r);}
    (facility||[]).forEach(r=>add(r,'facility'));(treatment||[]).forEach(r=>add(r,'treatment'));
    const days=[...map.values()].sort((a,b)=>(a.reportDate+a.facilityName).localeCompare(b.reportDate+b.facilityName)).map(g=>{g.facilityWeightKg=round(g.facilityRecords.reduce((n,r)=>n+weightKg(r),0));g.treatmentWeightKg=round(g.treatmentRecords.reduce((n,r)=>n+weightKg(r),0));g.differenceKg=round(g.treatmentWeightKg-g.facilityWeightKg);g.tripMatches=autoPair(g.facilityRecords,g.treatmentRecords);if(g.facilityRecords.length&&!g.treatmentRecords.length)g.status=Status.FACILITY_ONLY;else if(!g.facilityRecords.length&&g.treatmentRecords.length)g.status=Status.TREATMENT_ONLY;else if(g.facilityRecords.length!==g.treatmentRecords.length)g.status=Status.PARTIAL;else if(g.tripMatches.length===g.facilityRecords.length&&g.tripMatches.every(x=>x.matched))g.status=Status.MATCHED;else g.status=Status.WEIGHT_MISMATCH;g.matched=g.status===Status.MATCHED;delete g.facilityRecords;delete g.treatmentRecords;return g;});
    const states=new Map(),summary={days:days.length,matchedDays:0,unmatchedDays:0,facilitiesCount:0,matchedFacilities:0,unmatchedFacilities:0,facilityWeightKg:0,treatmentWeightKg:0,differenceKg:0,matched:false};
    days.forEach(d=>{d.matched?summary.matchedDays++:summary.unmatchedDays++;summary.facilityWeightKg+=d.facilityWeightKg;summary.treatmentWeightKg+=d.treatmentWeightKg;const k=d.facilityId||d.facilityName||'UNKNOWN';if(!states.has(k))states.set(k,true);if(!d.matched)states.set(k,false);});
    states.forEach(ok=>{summary.facilitiesCount++;ok?summary.matchedFacilities++:summary.unmatchedFacilities++;});summary.facilityWeightKg=round(summary.facilityWeightKg);summary.treatmentWeightKg=round(summary.treatmentWeightKg);summary.differenceKg=round(summary.treatmentWeightKg-summary.facilityWeightKg);summary.matched=days.length>0&&summary.unmatchedDays===0;
    return{summary,days,scope:scope||null,source:'client_scoped_records'};
  }
  MW.ReconciliationEngine=Object.freeze({build,weightKg,autoPair});
})(window.MedWaste);
