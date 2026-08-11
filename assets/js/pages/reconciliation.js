(function(MW){
  'use strict';
  const {EntitiesRepository,Reconciliation,Utils,SettingsService}=MW;
  let facilities=[];
  let settings={healthAdmins:{},govFacilities:[],privateFacilities:[],privateCompanies:[]};
  const statusMap={MATCHED:['مطابق','bg-emerald-100 text-emerald-800'],WEIGHT_MISMATCH:['فرق وزن','bg-rose-100 text-rose-800'],FACILITY_ONLY:['عند المنشأة فقط','bg-amber-100 text-amber-800'],TREATMENT_ONLY:['عند وحدة المعالجة فقط','bg-orange-100 text-orange-800'],PARTIAL:['مطابقة جزئية','bg-slate-100 text-slate-700']};

  function fillSelect(select,placeholder,items){
    if(!select)return;
    select.innerHTML=`<option value="">${placeholder}</option>`;
    (items||[]).forEach(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.label;select.appendChild(o);});
  }

  function applySettings(){settings=SettingsService.getData()||settings;}

  function loadHealthAdmins(){
    fillSelect(document.getElementById('healthAdmin'),'-- اختر الإدارة الصحية --',Object.keys(settings.healthAdmins||{}).map(name=>({value:name,label:name})));
  }

  function resolveFacility(mainType,healthAdmin,name){
    return facilities.find(f=>f.mainType===mainType&&(f.healthAdmin||'')===(healthAdmin||'')&&f.name===name);
  }

  function facilityNamesFor(mainType,healthAdmin){
    if(mainType==='إدارات صحية')return (settings.healthAdmins?.[healthAdmin]||[]).slice();
    if(mainType==='منشأت حكومية')return (settings.govFacilities||[]).slice();
    if(mainType==='منشأت خاصة')return (settings.privateFacilities||[]).slice();
    if(mainType==='شركات خاصة')return (settings.privateCompanies||[]).slice();
    return [];
  }

  function renderFacilityOptions(){
    const mainType=document.getElementById('mainType').value;
    const healthAdmin=document.getElementById('healthAdmin').value;
    const select=document.getElementById('facilityId');
    const label=document.getElementById('facilityLabel');
    const adminBox=document.getElementById('healthAdminBox');

    if(mainType==='إدارات صحية'){
      adminBox.classList.remove('hidden');
      label.textContent='اختر الوحدة الصحية التابعة للإدارة';
      if(!healthAdmin){fillSelect(select,'-- اختر الإدارة الصحية أولاً --',[]);return;}
    }else{
      adminBox.classList.add('hidden');
      document.getElementById('healthAdmin').value='';
      if(mainType==='منشأت حكومية')label.textContent='اختر المستشفى أو المركز الحكومي';
      else if(mainType==='منشأت خاصة')label.textContent='اختر المنشأة الخاصة';
      else if(mainType==='شركات خاصة')label.textContent='اختر الشركة الخاصة';
      else label.textContent='المنشأة / الوحدة';
    }

    if(!mainType){fillSelect(select,'-- اختر نوع المنشأة الرئيسية أولاً --',[]);return;}
    const effectiveAdmin=mainType==='إدارات صحية'?healthAdmin:'';
    const items=facilityNamesFor(mainType,effectiveAdmin).map(name=>{
      const entity=resolveFacility(mainType,effectiveAdmin,name);
      return {value:entity?.entityId||'',label:name,missing:!entity};
    }).filter(item=>item.value);
    fillSelect(select,mainType==='إدارات صحية'?'-- اختر الوحدة الصحية --':'-- اختر المنشأة --',items);
  }

  function handleMainTypeChange(){
    if(document.getElementById('mainType').value==='إدارات صحية') loadHealthAdmins();
    renderFacilityOptions();
  }

  function card(label,value,cls='text-slate-800'){return `<div class="bg-white border rounded-2xl p-4 shadow-sm"><div class="text-[11px] text-slate-500 font-bold">${label}</div><div class="text-xl font-black ${cls}">${value}</div></div>`;}

  function render(data){
    const s=data.summary||{},cards=document.getElementById('summaryCards');
    cards.innerHTML=card('أيام مطابقة',s.matchedDays||0,'text-emerald-700')+card('أيام غير مطابقة',s.unmatchedDays||0,'text-rose-700')+card('وزن المنشأة',`${s.facilityWeightKg||0} كجم`)+card('وزن وحدة المعالجة',`${s.treatmentWeightKg||0} كجم`)+card('إجمالي الفرق',`${s.differenceKg||0} كجم`,Math.abs(s.differenceKg||0)<0.01?'text-emerald-700':'text-rose-700');
    const body=document.getElementById('reconciliationBody');body.innerHTML='';
    document.getElementById('emptyMsg').classList.toggle('hidden',(data.days||[]).length>0);
    (data.days||[]).forEach(d=>{
      const st=statusMap[d.status]||[d.status,'bg-slate-100'];
      const trips=(d.tripMatches||[]).length?(d.tripMatches||[]).map(t=>`<div class="mb-1"><span class="font-mono">${Utils.escapeHtml(t.tripReference)}</span> — ${t.facilityWeightKg}/${t.treatmentWeightKg} كجم ${t.matched?'✅':'❌'}</div>`).join(''):'<span class="text-slate-400">لا يوجد مرجع مشترك؛ المطابقة اليومية فقط</span>';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="p-3 font-bold">${Utils.escapeHtml(d.reportDate)}</td><td class="p-3"><div class="font-bold">${Utils.escapeHtml(d.facilityName)}</div><div class="text-[10px] text-slate-400">${Utils.escapeHtml(d.facilityId)}</div></td><td class="p-3 text-center font-bold">${d.facilityWeightKg} كجم</td><td class="p-3 text-center font-bold">${d.treatmentWeightKg} كجم</td><td class="p-3 text-center font-black ${Math.abs(d.differenceKg)<0.01?'text-emerald-700':'text-rose-700'}">${d.differenceKg} كجم</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-lg font-bold ${st[1]}">${st[0]}</span></td><td class="p-3 text-[11px]">${trips}</td>`;
      body.appendChild(tr);
    });
  }

  async function compare(){
    const facilityId=document.getElementById('facilityId').value;
    if(!facilityId){alert('اختر المنشأة أولاً.');return;}
    const b=document.getElementById('compareBtn');b.disabled=true;b.textContent='جاري المطابقة...';
    try{render(await Reconciliation.compare({facilityId,startDate:document.getElementById('startDate').value,endDate:document.getElementById('endDate').value}));}
    catch(e){alert(e.message||'تعذر إجراء المطابقة.');}
    finally{b.disabled=false;b.textContent='إجراء المطابقة';}
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    SettingsService.reloadFromLocal();applySettings();
    try{await SettingsService.refreshFromCloud();applySettings();}catch(_){}
    const data=await EntitiesRepository.list();facilities=data.facilities||[];
    loadHealthAdmins();renderFacilityOptions();
    document.getElementById('mainType').addEventListener('change',handleMainTypeChange);
    document.getElementById('healthAdmin').addEventListener('change',renderFacilityOptions);
    document.getElementById('compareBtn').addEventListener('click',compare);
  });
})(window.MedWaste);
