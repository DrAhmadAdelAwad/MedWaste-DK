(function(MW){
  'use strict';
  const {Auth,EntitiesRepository}=MW;
  let facilities=[],healthAdmins=[],directorates=[];
  const select=()=>document.getElementById('facilityId');
  const typeSelect=()=>document.getElementById('registrationFacilityType');
  function applyData(data){facilities=Array.isArray(data?.facilities)?data.facilities:[];healthAdmins=Array.isArray(data?.healthAdmins)?data.healthAdmins:[];directorates=Array.isArray(data?.directorates)?data.directorates:[];renderAssignments();}
  function addOption(sel,item,type){const o=document.createElement('option');o.value=item.entityId||'';o.textContent=`${item.name||''}${item.healthAdmin&&type!=='إدارات صحية'?` — ${item.healthAdmin}`:''}`;sel.appendChild(o);}
  function renderAssignments(){
    const type=typeSelect()?.value||'',sel=select(),label=document.getElementById('registrationEntityLabel'),wrap=document.getElementById('registrationEntityWrap');if(!sel)return;
    sel.disabled=false;sel.required=true;sel.innerHTML='<option value="">-- اختر الجهة --</option>';
    if(!type){wrap?.classList.remove('hidden');sel.disabled=true;sel.required=false;sel.innerHTML='<option value="">-- اختر نوع الجهة أولاً --</option>';if(label)label.textContent='الجهة التابعة لك *';return;}
    if(type==='مديرية الشئون الصحية بالدقهلية'){
      const dir=directorates.find(x=>x.name==='مديرية الشئون الصحية بالدقهلية')||directorates[0]||null;wrap?.classList.add('hidden');sel.required=false;
      sel.innerHTML='';if(dir){addOption(sel,dir,type);sel.value=dir.entityId;}
      return;
    }
    wrap?.classList.remove('hidden');
    let list=[];
    if(type==='إدارات صحية'){list=healthAdmins;if(label)label.textContent='اختر الإدارة الصحية التابعة لك *';}
    else{list=facilities.filter(x=>x.mainType===type);if(label)label.textContent='المنشأة التابعة لك *';}
    list.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar')).forEach(x=>addOption(sel,x,type));
    if(type&&list.length===0)sel.innerHTML='<option value="">لا توجد جهات متاحة لهذا النوع حالياً</option>';
  }
  async function loadOptions(){
    const cached=EntitiesRepository.registrationFromCache?.();
    if(cached&&(cached.facilities.length||cached.healthAdmins.length||cached.directorates.length))applyData(cached);
    try{const fresh=await EntitiesRepository.registrationOptions({force:!!cached,maxAgeMs:21600000});applyData(fresh);}catch(error){if(!cached){const sel=select();if(sel){sel.innerHTML='<option value="">تعذر تحميل دليل الجهات</option>';sel.disabled=true;}const m=document.getElementById('statusMsg');if(m){m.textContent='تعذر تحميل دليل الجهات. تحقق من الاتصال ثم أعد المحاولة.';m.classList.remove('hidden');}}}
  }
  typeSelect()?.addEventListener('change',renderAssignments);
  document.getElementById('registerForm')?.addEventListener('submit',async event=>{
    event.preventDefault();const button=document.getElementById('submitBtn'),message=document.getElementById('statusMsg'),password=document.getElementById('password').value,confirm=document.getElementById('confirmPassword').value,email=document.getElementById('email').value.trim().toLowerCase(),type=typeSelect()?.value||'';
    if(password!==confirm){message.innerText='كلمتا المرور غير متطابقتين';message.classList.remove('hidden');return;}
    const entityId=select()?.value||'';if(!entityId&&type!=='مديرية الشئون الصحية بالدقهلية'){message.innerText=type==='إدارات صحية'?'اختر الإدارة الصحية التابعة لك.':'اختر المنشأة التابعة لك.';message.classList.remove('hidden');return;}
    button.innerText='جاري إنشاء الحساب...';button.disabled=true;message.classList.add('hidden');
    try{
      await Auth.register({fullName:document.getElementById('fullName').value,jobTitle:document.getElementById('jobTitle').value,workplace:document.getElementById('workplace').value,mobile:document.getElementById('mobile').value,email,password,entityId,facilityId:entityId,registrationKey:Auth.registrationKeyFor(email),registrationFacilityType:type});
      Auth.clearRegistrationKey();message.textContent='✅ تم إنشاء الحساب بنجاح. سيتم تحويلك لتسجيل الدخول.';message.className='text-center text-sm font-bold p-3 rounded-xl text-emerald-800 bg-emerald-50 border border-emerald-200';button.innerText='تم التسجيل بنجاح ✓';
      window.setTimeout(()=>{window.location.href='login.html';},700);
    }catch(error){message.innerText=error.message||'تعذر إنشاء الحساب. حاول مرة أخرى.';message.classList.remove('hidden');button.innerText='تأكيد وإنشاء الحساب';button.disabled=false;}
  });
  document.addEventListener('DOMContentLoaded',loadOptions);
})(window.MedWaste);
