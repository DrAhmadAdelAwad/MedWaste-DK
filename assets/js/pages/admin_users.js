(function(MW){
  'use strict';
  const {Session,UsersRepository,Contracts,Validators,Utils}=MW;
  const currentUser=Session.getUser();
  if(!currentUser||!Session.getToken()||!Contracts.canRole(currentUser.role,Contracts.Actions.GET_USERS)){
    alert('عفواً، هذه الصفحة مخصصة للمدير فقط.');window.location.href='home.html';return;
  }
  let entities={facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]},usersCache=[];
  const sortAr=list=>(list||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
  const option=(x,selected)=>`<option value="${Utils.escapeHtml(x.entityId)}" ${x.entityId===selected?'selected':''}>${Utils.escapeHtml(x.name)} [${Utils.escapeHtml(x.entityId)}]</option>`;
  function entityOptions(role,selected){
    if(role===Contracts.Roles.TREATMENT_ENTRY){return '<option value="">-- اختر وحدة المعالجة --</option>'+sortAr(entities.treatmentUnits).map(x=>option(x,selected)).join('');}
    if(role===Contracts.Roles.FACILITY_ENTRY){
      const admins=sortAr(entities.healthAdmins),fac=sortAr((entities.facilities||[]).filter(x=>x.mainType!=='إدارات صحية'));
      let html='<option value="">-- اختر المنشأة أو الإدارة --</option>';
      if(admins.length)html+='<optgroup label="الإدارات الصحية — حساب واحد لكل إدارة">'+admins.map(x=>option(x,selected)).join('')+'</optgroup>';
      const groups={};fac.forEach(x=>(groups[x.mainType||'منشآت أخرى']=groups[x.mainType||'منشآت أخرى']||[]).push(x));
      Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ar')).forEach(k=>{html+=`<optgroup label="${Utils.escapeHtml(k)}">${groups[k].map(x=>option(x,selected)).join('')}</optgroup>`;});
      return html;
    }
    if(role===Contracts.Roles.SUPERVISOR||role===Contracts.Roles.ADMIN){
      const dirs=sortAr(entities.directorates);return '<option value="">-- جهة إشرافية اختيارية --</option>'+dirs.map(x=>option(x,selected)).join('');
    }
    return '<option value="">لا تتطلب جهة</option>';
  }
  function updateAssignmentForRow(row){
    const role=row.querySelector('.role-select').value,sel=row.querySelector('.entity-select'),current=sel.dataset.current||'';
    sel.innerHTML=entityOptions(role,current);sel.disabled=false;sel.dataset.loaded='1';
  }
  function primeAssignmentForRow(row,user){
    const sel=row.querySelector('.entity-select'),id=user.entityId||'',name=user.entityName||'';
    sel.dataset.current=id;sel.dataset.loaded='0';
    sel.innerHTML=id?`<option value="${Utils.escapeHtml(id)}" selected>${Utils.escapeHtml(name||id)}</option>`:'<option value="">-- اضغط لعرض الجهات المتاحة --</option>';
  }
  function userRow(user){
    const row=document.createElement('tr');row.className='hover:bg-slate-50 user-admin-row';row.dataset.email=user.email||'';
    row.innerHTML=`
      <td class="p-4"><div class="font-bold text-slate-800 user-name"></div><div class="text-xs text-slate-500 user-job"></div></td>
      <td class="p-4 text-sm text-slate-600"><div class="user-email"></div><div class="text-xs user-mobile"></div></td>
      <td class="p-4 font-bold text-red-700 user-role"></td>
      <td class="p-4"><div class="text-xs font-bold entity-name"></div><div class="text-[10px] text-slate-400 entity-id"></div></td>
      <td class="p-4 min-w-[220px] space-y-2">
        <select class="border rounded-lg px-2 py-2 text-sm bg-white role-select w-full">${Contracts.RoleList.map(role=>`<option value="${role}">${role}</option>`).join('')}</select>
        <select class="border rounded-lg px-2 py-2 text-xs bg-white entity-select w-full"></select>
        <div class="grid grid-cols-2 gap-2">
          <button type="button" class="update-role-btn bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg">حفظ التعديل</button>
          <button type="button" class="delete-user-btn bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-lg">حذف المستخدم</button>
        </div>
      </td>`;
    row.querySelector('.user-name').textContent=user.fullName||'';row.querySelector('.user-job').textContent=`${user.jobTitle||''} - ${user.workplace||''}`;
    row.querySelector('.user-email').textContent=user.email||'';row.querySelector('.user-mobile').textContent=user.mobile||'';row.querySelector('.user-role').textContent=user.role||'';
    row.querySelector('.entity-name').textContent=user.entityName||'غير مرتبط';row.querySelector('.entity-id').textContent=user.entityId?`${user.entityType==='health_admin'?'إدارة صحية':user.entityType==='directorate'?'جهة إشرافية':'ID'}: ${user.entityId}`:'';
    row.querySelector('.role-select').value=Contracts.RoleList.includes(user.role)?user.role:Contracts.Roles.FACILITY_ENTRY;
    primeAssignmentForRow(row,user);return row;
  }
  function renderUsers(users){const table=document.getElementById('usersTable'),frag=document.createDocumentFragment();table.innerHTML='';(users||[]).forEach(u=>frag.appendChild(userRow(u)));table.appendChild(frag);document.getElementById('usersCount')?.replaceChildren(document.createTextNode(String((users||[]).length)));}
  async function loadUsers(){const table=document.getElementById('usersTable'),local=UsersRepository.cachedBundle?.();if(local){usersCache=local.users||[];entities=local.entities||entities;renderUsers(usersCache);}try{const bundle=await UsersRepository.listBundle({force:!!local});usersCache=bundle.users||[];entities=bundle.entities||entities;renderUsers(usersCache);}catch(error){if(!local)table.innerHTML='<tr><td colspan="5" class="p-8 text-center text-rose-500">حدث خطأ في تحميل بيانات المستخدمين</td></tr>';}}
  async function updateRole(row,button){const email=row.dataset.email,role=row.querySelector('.role-select').value,entityId=row.querySelector('.entity-select').value;try{
    Validators.assertAccessAssignment(role,entityId);button.textContent='جاري الحفظ...';button.disabled=true;await UsersRepository.updateRole(email,role,entityId);
    const idx=usersCache.findIndex(x=>x.email===email);if(idx>=0){usersCache[idx].role=role;const all=[...(entities.facilities||[]),...(entities.healthAdmins||[]),...(entities.treatmentUnits||[]),...(entities.directorates||[])],e=all.find(x=>x.entityId===entityId);usersCache[idx].entityId=entityId;usersCache[idx].entityName=e?.name||'';usersCache[idx].entityType=e?.entityType||'';}
    renderUsers(usersCache);alert('تم تحديث الصلاحية والجهة. سيحتاج المستخدم لتسجيل الدخول مجدداً.');
  }catch(error){alert(error.message||'فشل التحديث');button.textContent='حفظ التعديل';button.disabled=false;}}
  async function deleteUser(row,button){const email=row.dataset.email,name=row.querySelector('.user-name')?.textContent||email;if(!confirm(`حذف المستخدم «${name}» نهائياً من التطبيق؟\nلن يتم حذف السجلات التاريخية التي أنشأها.`))return;try{button.disabled=true;button.textContent='جاري الحذف...';await UsersRepository.deleteUser(email);usersCache=usersCache.filter(x=>x.email!==email);renderUsers(usersCache);}catch(error){alert(error.message||'تعذر حذف المستخدم');button.disabled=false;button.textContent='حذف المستخدم';}}
  document.getElementById('usersTable')?.addEventListener('focusin',e=>{if(e.target.matches('.entity-select')&&e.target.dataset.loaded!=='1'){updateAssignmentForRow(e.target.closest('tr'));}});
  document.getElementById('usersTable')?.addEventListener('change',e=>{if(e.target.matches('.role-select')){const row=e.target.closest('tr');row.querySelector('.entity-select').dataset.current='';updateAssignmentForRow(row);}});
  document.getElementById('usersTable')?.addEventListener('click',e=>{const row=e.target.closest('tr');if(!row)return;const update=e.target.closest('.update-role-btn'),del=e.target.closest('.delete-user-btn');if(update)updateRole(row,update);if(del)deleteUser(row,del);});
  document.getElementById('userSearch')?.addEventListener('input',e=>{const q=String(e.target.value||'').trim().toLowerCase();renderUsers(!q?usersCache:usersCache.filter(u=>[u.fullName,u.email,u.mobile,u.role,u.entityName].some(v=>String(v||'').toLowerCase().includes(q))));});
  document.addEventListener('DOMContentLoaded',loadUsers);
})(window.MedWaste);
