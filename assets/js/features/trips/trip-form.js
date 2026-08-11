(function (MW) {
  'use strict';
  const {SettingsService,Utils,Trips,Records,UI,Validators,Session,Contracts}=MW;
  let currentBatch=[];
  const user=Session.getUser()||{};
  const isFacilityEntry=()=>user.role===Contracts.Roles.FACILITY_ENTRY;
  const isTreatmentEntry=()=>user.role===Contracts.Roles.TREATMENT_ENTRY;
  const source=()=>isFacilityEntry()?Contracts.EntrySources.FACILITY:Contracts.EntrySources.TREATMENT;
  const getSettings=()=>SettingsService.getData();

  function setToday(){const el=document.getElementById('reportDate');if(!el)return;const t=new Date().toISOString().split('T')[0];el.value=t;el.max=t;}
  function fillSelect(select,placeholder,items){if(!select)return;select.innerHTML=`<option value="">${placeholder}</option>`;(items||[]).forEach(item=>{const o=document.createElement('option');o.value=item;o.textContent=item;select.appendChild(o);});}
  function renderIdentity(){
    const box=document.getElementById('entryIdentityBanner');if(!box)return;
    if(!user.entityId&&(isFacilityEntry()||isTreatmentEntry())){box.className='rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 font-bold';box.textContent='⚠️ حسابك غير مربوط بجهة. راجع المدير قبل تسجيل أي بيانات.';document.getElementById('submitBtn')?.setAttribute('disabled','disabled');return;}
    const label=isFacilityEntry()?'المنشأة المسؤولة عن هذا الإدخال':'وحدة المعالجة المسؤولة عن هذا الإدخال';
    box.innerHTML=`<span class="font-bold text-emerald-800">${label}:</span> ${Utils.escapeHtml(user.entityName||'-')} <span class="text-slate-400">(${Utils.escapeHtml(user.entityId||'-')})</span>`;
  }
  function configureReferenceUI(){
    const label=document.getElementById('tripReferenceLabel'),input=document.getElementById('tripReference'),help=document.getElementById('tripReferenceHelp');if(!input)return;
    if(isTreatmentEntry()){
      if(label)label.textContent='مرجع الرحلة الصادر من المنشأة *';
      input.placeholder='مثال: MW-20260812-XXXXXXXX';
      if(help)help.textContent='أدخل مرجع المنشأة لهذه المنشأة تحديداً. عند إضافة منشأة أخرى أدخل مرجعها الخاص.';
    }else{
      if(label)label.textContent='مرجع الرحلة للمطابقة';
      input.placeholder='اختياري — يُنشأ تلقائياً إذا تُرك فارغاً';
      if(help)help.textContent='بعد الحفظ سيظهر المرجع؛ يُسلَّم مع الرحلة ليستخدمه مدخل وحدة المعالجة في المطابقة.';
    }
  }
  function refreshOptions(){const s=getSettings();fillSelect(document.getElementById('carNumber'),'-- اختر رقم السيارة --',s.cars);fillSelect(document.getElementById('driverName'),'-- اختر اسم السائق --',s.drivers);handleMainTypeChange();}
  function handleMainTypeChange(){if(isFacilityEntry())return;const s=getSettings(),main=document.getElementById('facilityMainType')?.value||'',adminBox=document.getElementById('adminContainer'),sub=document.getElementById('subFacilityName'),label=document.getElementById('subFacilityLabel');if(!sub||!label||!adminBox)return;fillSelect(sub,'-- اختر المنشأة / الوحدة --',[]);if(main==='إدارات صحية'){adminBox.classList.remove('hidden');label.innerText='اختر الوحدة الصحية التابعة للإدارة';loadAdminSelectOptions();loadAdminUnits();return;}adminBox.classList.add('hidden');const adm=document.getElementById('healthAdmin');if(adm)adm.value='';let items=[];if(main==='منشأت حكومية'){label.innerText='اختر المستشفى أو المركز الحكومي';items=s.govFacilities;}else if(main==='منشأت خاصة'){label.innerText='اختر المنشأة الخاصة';items=s.privateFacilities;}else if(main==='شركات خاصة'){label.innerText='اختر الشركة الخاصة';items=s.privateCompanies;}else label.innerText='اختر المنشأة / الوحدة';fillSelect(sub,'-- اختر المنشأة / الوحدة --',items);}
  function loadAdminSelectOptions(){fillSelect(document.getElementById('healthAdmin'),'-- اختر الإدارة الصحية --',Object.keys(getSettings().healthAdmins||{}));}
  function loadAdminUnits(){const a=document.getElementById('healthAdmin')?.value||'';fillSelect(document.getElementById('subFacilityName'),'-- اختر الوحدة الصحية --',getSettings().healthAdmins?.[a]||[]);}
  function toggleWeightSection(){const v=document.querySelector('input[name="visitType"]:checked')?.value,wSec=document.getElementById('weightSection'),w=document.getElementById('wasteWeight');if(!wSec||!w)return;if(v==='زيارة فقط بدون نقل'){wSec.classList.add('hidden');w.value='0';}else{wSec.classList.remove('hidden');if(w.value==='0')w.value='';}}
  function currentReference(){return document.getElementById('tripReference')?.value.trim()||'';}
  function collectFacilityFromForm(){const visitType=document.querySelector('input[name="visitType"]:checked')?.value||'',wasteWeight=document.getElementById('wasteWeight')?.value||'',weightUnit=document.getElementById('weightUnit')?.value||'';if(isFacilityEntry())return{mainType:'',facilityMainType:'',healthAdmin:'',subFacilityName:user.entityName||'',facilityId:user.entityId||'',visitType,wasteWeight,weightUnit,tripReference:currentReference()};const mainType=document.getElementById('facilityMainType')?.value||'',subFacilityName=document.getElementById('subFacilityName')?.value||'',healthAdmin=document.getElementById('healthAdmin')?.value||'جهات مباشرة';return{mainType,facilityMainType:mainType,healthAdmin,subFacilityName,visitType,wasteWeight,weightUnit,tripReference:currentReference()};}
  function validateFacility(f,requireSelection=true){try{Validators.assertFacility(f,requireSelection);if(isTreatmentEntry()&&!String(f.tripReference||'').trim())return 'مرجع الرحلة الصادر من المنشأة مطلوب قبل إضافة المنشأة.';return '';}catch(e){return e.message||'بيانات المنشأة غير صحيحة.';}}
  function addFacilityToBatch(){if(!isTreatmentEntry())return;const f=collectFacilityFromForm(),error=validateFacility(f,true);if(error)return alert(error);currentBatch.push({id:Utils.generateId('item-'),facilityMainType:f.mainType,healthAdmin:f.healthAdmin,subFacilityName:f.subFacilityName,tripReference:f.tripReference,visitType:f.visitType,wasteWeight:f.visitType==='زيارة فقط بدون نقل'?'0':f.wasteWeight,weightUnit:f.visitType==='زيارة فقط بدون نقل'?'-':f.weightUnit});renderBatch();resetFacilityForm();}
  function renderBatch(){const tbody=document.getElementById('batchTableBody'),container=document.getElementById('batchContainer'),count=document.getElementById('batchCount');if(!tbody||!container||!count)return;if(isFacilityEntry()){container.classList.add('hidden');return;}tbody.innerHTML='';count.innerText=currentBatch.length;container.classList.toggle('hidden',currentBatch.length===0);currentBatch.forEach((item,index)=>{const tr=document.createElement('tr'),weight=item.visitType==='زيارة فقط بدون نقل'?'<span class="text-amber-600 font-semibold">زيارة فقط</span>':`${item.wasteWeight} ${item.weightUnit}`;tr.innerHTML=`<td class="p-2 font-medium text-slate-800">${Utils.escapeHtml(item.subFacilityName)}</td><td class="p-2 font-mono text-[10px] text-indigo-700">${Utils.escapeHtml(item.tripReference||'-')}</td><td class="p-2">${Utils.escapeHtml(item.visitType)}</td><td class="p-2 font-bold">${weight}</td><td class="p-2 text-center"><button type="button" data-batch-action="remove" data-index="${index}" class="text-rose-600 font-bold px-2 py-0.5 bg-rose-50 rounded">حذف</button></td>`;tbody.appendChild(tr);});}
  function resetFacilityForm(){if(isFacilityEntry()){const w=document.getElementById('wasteWeight');if(w)w.value='';return;}const main=document.getElementById('facilityMainType');if(main)main.value='';document.getElementById('adminContainer')?.classList.add('hidden');const adm=document.getElementById('healthAdmin');if(adm)adm.value='';fillSelect(document.getElementById('subFacilityName'),'-- برجاء اختيار نوع المنشأة الرئيسية أولاً --',[]);const radio=document.querySelector('input[name="visitType"][value="نقل نفايات"]');if(radio)radio.checked=true;const w=document.getElementById('wasteWeight');if(w)w.value='';const ref=document.getElementById('tripReference');if(ref)ref.value='';toggleWeightSection();}
  function configureRoleUI(){const selector=document.getElementById('facilitySelectorGrid'),add=document.getElementById('addFacilityToBatchControl'),batchHint=document.querySelector('#batchContainer');if(isFacilityEntry()){selector?.classList.add('hidden');add?.classList.add('hidden');batchHint?.classList.add('hidden');}else{selector?.classList.remove('hidden');add?.classList.remove('hidden');}}
  function updateLocalCount(){const c=document.getElementById('local-count');if(c)c.innerText=`محفوظ محلياً: ${Records.getLocal(source()).length}`;}
  async function submitTrip(event){
    event.preventDefault();
    const route={reportDate:document.getElementById('reportDate')?.value||'',tripReference:isFacilityEntry()?currentReference():'',driverName:document.getElementById('driverName')?.value||'',carNumber:document.getElementById('carNumber')?.value||''};
    try{Validators.assertRoute(route);}catch(e){alert(e.message);return;}
    if(!user.entityId){alert('الحساب غير مربوط بجهة. راجع المدير.');return;}
    if(isFacilityEntry()){
      const f=collectFacilityFromForm(),error=validateFacility(f,false);if(error)return alert(error);
      currentBatch=[{facilityId:user.entityId,facilityMainType:'',healthAdmin:'',subFacilityName:user.entityName,tripReference:f.tripReference,visitType:f.visitType,wasteWeight:f.visitType==='زيارة فقط بدون نقل'?'0':f.wasteWeight,weightUnit:f.visitType==='زيارة فقط بدون نقل'?'-':f.weightUnit}];
    }else{
      const f=collectFacilityFromForm();
      if(f.mainType&&f.subFacilityName){const error=validateFacility(f,true);if(error)return alert(error);if(!currentBatch.some(x=>x.subFacilityName===f.subFacilityName&&x.tripReference===f.tripReference))currentBatch.push({id:Utils.generateId('item-'),facilityMainType:f.mainType,healthAdmin:f.healthAdmin,subFacilityName:f.subFacilityName,tripReference:f.tripReference,visitType:f.visitType,wasteWeight:f.visitType==='زيارة فقط بدون نقل'?'0':f.wasteWeight,weightUnit:f.visitType==='زيارة فقط بدون نقل'?'-':f.weightUnit});}
      if(currentBatch.some(x=>!String(x.tripReference||'').trim())){alert('كل منشأة في إدخال وحدة المعالجة يجب أن يكون لها مرجع رحلة صادر من المنشأة.');return;}
    }
    if(!currentBatch.length){alert('برجاء إدخال منشأة واحدة على الأقل قبل الحفظ النهائي.');return;}
    const btn=document.getElementById('submitBtn'),old=btn?.innerText||'حفظ',status=document.getElementById('statusMessage');if(btn?.disabled)return;if(btn){btn.disabled=true;btn.innerText='جاري الحفظ والمزامنة...';}
    try{
      const result=await Trips.save(route,currentBatch);updateLocalCount();
      const refInfo=isFacilityEntry()&&result.tripReference?` | مرجع الرحلة: ${result.tripReference}`:isTreatmentEntry()?` | مراجع المطابقة المسجلة: ${result.tripReferences?.length||0}`:'';
      UI.setStatus(status,result.cloudSaved?`تم الحفظ والمزامنة بنجاح.${refInfo}`:`تم الحفظ محلياً وتعذر تأكيد السحابة؛ ستتم إعادة المحاولة.${refInfo}`,result.cloudSaved?'success':'error');
      currentBatch=[];renderBatch();document.getElementById('wasteForm')?.reset();setToday();refreshOptions();configureRoleUI();configureReferenceUI();resetFacilityForm();updateLocalCount();
    }catch(e){UI.setStatus(status,e.message||'تعذر حفظ الإدخال.','error');}
    finally{if(btn){btn.disabled=false;btn.innerText=old;}}
  }
  function bindEvents(){document.getElementById('facilityMainType')?.addEventListener('change',handleMainTypeChange);document.getElementById('healthAdmin')?.addEventListener('change',loadAdminUnits);document.getElementById('toggleWeightSectionControl')?.addEventListener('change',toggleWeightSection);document.getElementById('toggleWeightSection2Control')?.addEventListener('change',toggleWeightSection);document.getElementById('addFacilityToBatchControl')?.addEventListener('click',addFacilityToBatch);document.getElementById('wasteForm')?.addEventListener('submit',submitTrip);document.getElementById('batchTableBody')?.addEventListener('click',e=>{const b=e.target.closest('[data-batch-action="remove"]');if(!b)return;const i=Number(b.dataset.index);if(Number.isInteger(i)){currentBatch.splice(i,1);renderBatch();}});}
  function init(){setToday();renderIdentity();configureRoleUI();configureReferenceUI();refreshOptions();toggleWeightSection();renderBatch();updateLocalCount();bindEvents();}
  MW.TripForm=Object.freeze({init,refreshOptions,updateLocalCount});
})(window.MedWaste);
