(function(MW){
  'use strict';
  const {Auth,EntitiesRepository,Contracts}=MW;let facilities=[],healthAdmins=[],directorates=[];
  function renderAssignments(){
    const type=document.getElementById('registrationFacilityType')?.value||'',select=document.getElementById('facilityId'),label=document.getElementById('registrationEntityLabel');if(!select)return;
    select.innerHTML='<option value="">-- اختر الجهة --</option>';
    let list=[];
    if(type==='إدارات صحية')list=healthAdmins;
    else if(type==='مديرية الشئون الصحية بالدقهلية')list=directorates;
    else list=facilities.filter(x=>!type||x.mainType===type);
    if(label)label.textContent=type==='إدارات صحية'?'الإدارة الصحية التابعة لك *':type==='مديرية الشئون الصحية بالدقهلية'?'الجهة الإشرافية *':'المنشأة التابعة لك *';
    list.slice().sort((a,b)=>(a.name||'').localeCompare(b.name||'','ar')).forEach(f=>{const o=document.createElement('option');o.value=f.entityId;o.textContent=`${f.name}${f.healthAdmin&&type!=='إدارات صحية'?` — ${f.healthAdmin}`:''}`;select.appendChild(o);});
    const hint=document.getElementById('directorateHint');if(hint)hint.classList.toggle('hidden',type!=='مديرية الشئون الصحية بالدقهلية');
  }
  async function loadOptions(){const select=document.getElementById('facilityId');try{const data=await EntitiesRepository.registrationOptions();facilities=data.facilities||[];healthAdmins=data.healthAdmins||[];directorates=data.directorates||[];renderAssignments();}catch(e){if(select){select.innerHTML='<option value="">تعذر تحميل دليل الجهات</option>';select.disabled=true;}const m=document.getElementById('statusMsg');m.textContent='تعذر تحميل دليل الجهات. تأكد من الاتصال ثم أعد تحميل الصفحة.';m.classList.remove('hidden');}}
  document.getElementById('registrationFacilityType')?.addEventListener('change',renderAssignments);
  document.getElementById('registerForm')?.addEventListener('submit',async event=>{event.preventDefault();const button=document.getElementById('submitBtn'),message=document.getElementById('statusMsg'),password=document.getElementById('password').value,confirm=document.getElementById('confirmPassword').value;if(password!==confirm){message.innerText='كلمتا المرور غير متطابقتين';message.classList.remove('hidden');return;}button.innerText='جاري تسجيل البيانات...';button.disabled=true;try{const entityId=document.getElementById('facilityId').value,type=document.getElementById('registrationFacilityType').value;await Auth.register({fullName:document.getElementById('fullName').value,jobTitle:document.getElementById('jobTitle').value,workplace:document.getElementById('workplace').value,mobile:document.getElementById('mobile').value,email:document.getElementById('email').value,password,entityId,facilityId:entityId});alert(type==='مديرية الشئون الصحية بالدقهلية'?'تم إنشاء الحساب. حفاظاً على الأمان، يحتاج المدير الآن لتفعيل صلاحية مشرف/مدير وربط الحساب بالمديرية.':'تم التسجيل بنجاح كمدخل منشأة. إذا اخترت إدارة صحية فالحساب يغطي جميع وحداتها.');window.location.href='login.html';}catch(error){message.innerText=error.message||'خطأ في الاتصال بالخادم';message.classList.remove('hidden');button.innerText='تأكيد وإنشاء الحساب';button.disabled=false;}});
  document.addEventListener('DOMContentLoaded',loadOptions);
})(window.MedWaste);