(function(MW){
  'use strict';
  const {EntitiesRepository,Reconciliation,Utils,SettingsService,Contracts}=MW;
  let facilities=[];
  let settings={healthAdmins:{},govFacilities:[],privateFacilities:[],privateCompanies:[]};
  const statusMap={MATCHED:['مطابق','bg-emerald-100 text-emerald-800'],WEIGHT_MISMATCH:['فرق وزن','bg-rose-100 text-rose-800'],FACILITY_ONLY:['عند المنشأة فقط','bg-amber-100 text-amber-800'],TREATMENT_ONLY:['عند وحدة المعالجة فقط','bg-orange-100 text-orange-800'],PARTIAL:['مطابقة جزئية','bg-slate-100 text-slate-700']};

  function fillSelect(select,placeholder,items){
    if(!select)return;
    select.innerHTML=`<option value="">${placeholder}</option>`;
    (items||[]).forEach(item=>{const o=document.createElement('option');o.value=item.value;o.textContent=item.label;select.appendChild(o);});
  }
  function applySettings(){settings=SettingsService.getData()||settings;}
  function loadHealthAdmins(){fillSelect(document.getElementById('healthAdmin'),'-- اختر الإدارة الصحية --',Object.keys(settings.healthAdmins||{}).map(name=>({value:name,label:name})));}
  function resolveFacility(mainType,healthAdmin,name){return facilities.find(f=>f.mainType===mainType&&(f.healthAdmin||'')===(healthAdmin||'')&&f.name===name);}
  function facilityNamesFor(mainType,healthAdmin){
    if(mainType==='إدارات صحية')return (settings.healthAdmins?.[healthAdmin]||[]).slice();
    if(mainType==='منشأت حكومية')return (settings.govFacilities||[]).slice();
    if(mainType==='منشأت خاصة')return (settings.privateFacilities||[]).slice();
    if(mainType==='شركات خاصة')return (settings.privateCompanies||[]).slice();
    return [];
  }
  function selectedAdminScope(){return document.querySelector('input[name="adminScope"]:checked')?.value||'admin';}
  function isWholeAdminMode(){return document.getElementById('mainType').value==='إدارات صحية'&&selectedAdminScope()==='admin';}

  function renderFacilityOptions(){
    const mainType=document.getElementById('mainType').value;
    const healthAdmin=document.getElementById('healthAdmin').value;
    const select=document.getElementById('facilityId');
    const label=document.getElementById('facilityLabel');
    const adminBox=document.getElementById('healthAdminBox');
    const adminScopeBox=document.getElementById('adminScopeBox');
    const facilityBox=document.getElementById('facilityBox');
    const hint=document.getElementById('compareHint');

    if(mainType==='إدارات صحية'){
      adminBox.classList.remove('hidden');
      adminScopeBox.classList.remove('hidden');
      if(isWholeAdminMode()){
        facilityBox.classList.add('hidden');
        select.value='';
        hint.textContent='في وضع الإدارة كاملة تتم مراجعة جميع وحداتها وكل رحلاتها داخل الفترة المحددة تلقائياً.';
        return;
      }
      facilityBox.classList.remove('hidden');
      label.textContent='اختر الوحدة الصحية التابعة للإدارة';
      hint.textContent='وضع الوحدة المحددة يراجع رحلة ووَزن وحدة صحية واحدة فقط داخل الإدارة.';
      if(!healthAdmin){fillSelect(select,'-- اختر الإدارة الصحية أولاً --',[]);return;}
    }else{
      adminBox.classList.add('hidden');
      adminScopeBox.classList.add('hidden');
      facilityBox.classList.remove('hidden');
      document.getElementById('healthAdmin').value='';
      hint.textContent='اختيار المنشأة هنا مطابق لقوائم شاشة الإدخال. لا يتم اختيار وحدة معالجة في صفحة المطابقة.';
      if(mainType==='منشأت حكومية')label.textContent='اختر المستشفى أو المركز الحكومي';
      else if(mainType==='منشأت خاصة')label.textContent='اختر المنشأة الخاصة';
      else if(mainType==='شركات خاصة')label.textContent='اختر الشركة الخاصة';
      else label.textContent='المنشأة / الوحدة';
    }

    if(!mainType){fillSelect(select,'-- اختر نوع المنشأة الرئيسية أولاً --',[]);return;}
    const effectiveAdmin=mainType==='إدارات صحية'?healthAdmin:'';
    const items=facilityNamesFor(mainType,effectiveAdmin).map(name=>{const entity=resolveFacility(mainType,effectiveAdmin,name);return {value:entity?.entityId||'',label:name};}).filter(item=>item.value);
    fillSelect(select,mainType==='إدارات صحية'?'-- اختر الوحدة الصحية --':'-- اختر المنشأة --',items);
  }

  function handleMainTypeChange(){if(document.getElementById('mainType').value==='إدارات صحية')loadHealthAdmins();renderFacilityOptions();}
  function card(label,value,cls='text-slate-800'){return `<div class="bg-white border rounded-2xl p-4 shadow-sm"><div class="text-[11px] text-slate-500 font-bold">${label}</div><div class="text-xl font-black ${cls}">${value}</div></div>`;}

  function render(data){
    const s=data.summary||{},cards=document.getElementById('summaryCards');
    cards.innerHTML=card('نقاط مطابقة',s.matchedDays||0,'text-emerald-700')+card('نقاط غير مطابقة',s.unmatchedDays||0,'text-rose-700')+card('عدد الوحدات/المنشآت',s.facilitiesCount||0)+card('وزن المنشآت',`${s.facilityWeightKg||0} كجم`)+card('وزن وحدة المعالجة',`${s.treatmentWeightKg||0} كجم`)+card('إجمالي الفرق',`${s.differenceKg||0} كجم`,Math.abs(s.differenceKg||0)<0.01?'text-emerald-700':'text-rose-700');
    const scope=document.getElementById('scopeSummary');
    if(data.scope){
      scope.classList.remove('hidden');
      const status=s.matched?'✅ مطابق بالكامل':'❌ توجد فروق تحتاج مراجعة';
      scope.textContent=`${data.scope.label||'نطاق المطابقة'} — ${status}${data.scope.entityType===Contracts.EntityTypes.HEALTH_ADMIN?` — ${s.facilitiesCount||0} وحدة/منشأة`:''}`;
    }else scope.classList.add('hidden');
    const body=document.getElementById('reconciliationBody');body.innerHTML='';
    document.getElementById('emptyMsg').classList.toggle('hidden',(data.days||[]).length>0);
    (data.days||[]).forEach(d=>{
      const st=statusMap[d.status]||[d.status,'bg-slate-100'];
      const trips=(d.tripMatches||[]).length?(d.tripMatches||[]).map((t,i)=>`<div class="mb-1"><span class="font-bold text-slate-600">رحلة ${i+1}</span> — ${t.facilityWeightKg}/${t.treatmentWeightKg} كجم ${t.matched?'✅':'❌'}<div class="text-[9px] text-slate-400">${Utils.escapeHtml(t.reason||'مطابقة آلية')}</div></div>`).join(''):'<span class="text-slate-400">لا توجد رحلات داخل هذا النطاق.</span>';
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="p-3 font-bold">${Utils.escapeHtml(d.reportDate)}</td><td class="p-3"><div class="font-bold">${Utils.escapeHtml(d.facilityName)}</div><div class="text-[10px] text-slate-400">${Utils.escapeHtml(d.facilityId)}</div></td><td class="p-3 text-center font-bold">${d.facilityWeightKg} كجم</td><td class="p-3 text-center font-bold">${d.treatmentWeightKg} كجم</td><td class="p-3 text-center font-black ${Math.abs(d.differenceKg)<0.01?'text-emerald-700':'text-rose-700'}">${d.differenceKg} كجم</td><td class="p-3 text-center"><span class="px-2 py-1 rounded-lg font-bold ${st[1]}">${st[0]}</span></td><td class="p-3 text-[11px]">${trips}</td>`;
      body.appendChild(tr);
    });
  }

  async function compare(){
    const mainType=document.getElementById('mainType').value;
    const healthAdmin=document.getElementById('healthAdmin').value;
    const startDate=document.getElementById('startDate').value,endDate=document.getElementById('endDate').value;
    let filters={startDate,endDate};
    const wholeAdmin=mainType==='إدارات صحية'&&isWholeAdminMode();
    if(wholeAdmin){
      if(!healthAdmin){alert('اختر الإدارة الصحية أولاً.');return;}
      filters={...filters,healthAdmin,entityId:healthAdmin,entityType:Contracts.EntityTypes.HEALTH_ADMIN,scopeType:Contracts.EntityTypes.HEALTH_ADMIN,adminScope:'admin',compareMode:'health_admin',facilityMainType:'إدارات صحية',mainType:'إدارات صحية'};
    }else{
      const facilityId=document.getElementById('facilityId').value;
      if(!facilityId){alert(mainType==='إدارات صحية'?'اختر الوحدة الصحية أولاً.':'اختر المنشأة أولاً.');return;}
      filters={...filters,entityType:Contracts.EntityTypes.FACILITY,entityId:facilityId,facilityId};
    }
    const b=document.getElementById('compareBtn');b.disabled=true;b.textContent='جاري المطابقة...';
    try{render(await (wholeAdmin?Reconciliation.compareHealthAdmin(filters):Reconciliation.compare(filters)));}
    catch(e){alert(e.message||'تعذر إجراء المطابقة.');}
    finally{b.disabled=false;b.textContent='إجراء المطابقة';}
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    SettingsService.reloadFromLocal();applySettings();
    const cachedDirectory=EntitiesRepository.cached?.();
    if(cachedDirectory) facilities=cachedDirectory.facilities||[];
    loadHealthAdmins();renderFacilityOptions();
    document.getElementById('mainType').addEventListener('change',handleMainTypeChange);
    document.getElementById('healthAdmin').addEventListener('change',renderFacilityOptions);
    document.querySelectorAll('input[name="adminScope"]').forEach(r=>r.addEventListener('change',renderFacilityOptions));
    document.getElementById('compareBtn').addEventListener('click',compare);
    const [settingsResult,entitiesResult]=await Promise.allSettled([
      SettingsService.refreshFromCloud({maxAgeMs:120000}),
      EntitiesRepository.list({maxAgeMs:120000})
    ]);
    if(settingsResult.status==='fulfilled'){applySettings();loadHealthAdmins();}
    if(entitiesResult.status==='fulfilled') facilities=entitiesResult.value.facilities||facilities;
    renderFacilityOptions();
  });
})(window.MedWaste);
