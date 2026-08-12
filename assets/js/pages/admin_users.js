(function(MW){
  'use strict';
  const {Session,UsersRepository,Contracts,Validators,Utils}=MW;
  const currentUser=Session.getUser();
  if(!currentUser||!Session.getToken()||!Contracts.canRole(currentUser.role,Contracts.Actions.GET_USERS)){
    alert('عفواً، هذه الصفحة مخصصة للمدير فقط.');window.location.href='home.html';return;
  }

  let entities={facilities:[],healthAdmins:[],treatmentUnits:[],directorates:[]},usersCache=[],editingEmail='';
  const $=id=>document.getElementById(id);
  const sortAr=list=>(list||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'ar'));
  const allEntities=()=>[...(entities.facilities||[]),...(entities.healthAdmins||[]),...(entities.treatmentUnits||[]),...(entities.directorates||[])];
  const findEntity=id=>allEntities().find(x=>x.entityId===id)||null;
  const directorate=()=>entities.directorates?.find(x=>x.name==='مديرية الشئون الصحية بالدقهلية')||entities.directorates?.[0]||null;

  function roleLabel(role){return role||'غير محدد';}
  function entityLabel(user){
    if((user.role===Contracts.Roles.ADMIN||user.role===Contracts.Roles.SUPERVISOR)&&!user.entityName)return 'مديرية الشئون الصحية بالدقهلية';
    return user.entityName||'غير مرتبط';
  }
  function userRow(user){
    const tr=document.createElement('tr');tr.className='hover:bg-slate-50 user-admin-row';tr.dataset.email=user.email||'';
    tr.innerHTML=`
      <td class="p-4"><div class="font-bold text-slate-800 user-name"></div><div class="text-xs text-slate-500 user-job"></div></td>
      <td class="p-4 text-sm text-slate-600"><div class="user-email"></div><div class="text-xs user-mobile"></div></td>
      <td class="p-4"><span class="inline-flex rounded-full bg-red-50 text-red-800 border border-red-100 px-3 py-1 text-xs font-bold user-role"></span></td>
      <td class="p-4"><div class="text-sm font-bold text-slate-700 entity-name"></div><div class="text-[10px] text-slate-400 entity-id"></div></td>
      <td class="p-4"><div class="flex flex-wrap gap-2">
        <button type="button" class="edit-user-btn bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg">تعديل</button>
        <button type="button" class="delete-user-btn bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold px-4 py-2 rounded-lg">حذف</button>
      </div></td>`;
    tr.querySelector('.user-name').textContent=user.fullName||'';
    tr.querySelector('.user-job').textContent=[user.jobTitle,user.workplace].filter(Boolean).join(' — ');
    tr.querySelector('.user-email').textContent=user.email||'';
    tr.querySelector('.user-mobile').textContent=user.mobile||'';
    tr.querySelector('.user-role').textContent=roleLabel(user.role);
    tr.querySelector('.entity-name').textContent=entityLabel(user);
    tr.querySelector('.entity-id').textContent=user.entityId||'';
    return tr;
  }
  function renderUsers(users){
    const table=$('usersTable'),frag=document.createDocumentFragment();table.innerHTML='';
    (users||[]).forEach(u=>frag.appendChild(userRow(u)));table.appendChild(frag);
    $('usersCount').textContent=String((users||[]).length);
    if(!(users||[]).length)table.innerHTML='<tr><td colspan="5" class="p-8 text-center text-slate-500">لا توجد حسابات مطابقة.</td></tr>';
  }
  async function loadUsers(){
    const table=$('usersTable'),local=UsersRepository.cachedBundle?.();
    if(local){usersCache=local.users||[];entities=local.entities||entities;renderUsers(usersCache);}
    try{
      const bundle=await UsersRepository.listBundle({force:false});
      usersCache=bundle.users||[];entities=bundle.entities||entities;renderUsers(usersCache);
    }catch(error){if(!local)table.innerHTML='<tr><td colspan="5" class="p-8 text-center text-rose-500">تعذر تحميل المستخدمين. أعد المحاولة.</td></tr>';}
  }

  function optionsHtml(list,selected,placeholder){
    let html=`<option value="">${Utils.escapeHtml(placeholder)}</option>`;
    sortAr(list).forEach(x=>{html+=`<option value="${Utils.escapeHtml(x.entityId)}" ${x.entityId===selected?'selected':''}>${Utils.escapeHtml(x.name)}</option>`;});
    return html;
  }
  function currentAssignmentKind(user){
    if(user.entityType===Contracts.EntityTypes.HEALTH_ADMIN)return 'health_admin';
    if(user.entityType===Contracts.EntityTypes.DIRECTORATE)return 'directorate_pending';
    const e=findEntity(user.entityId);
    if(e?.mainType==='منشأت حكومية')return 'gov';
    if(e?.mainType==='منشأت خاصة')return 'private';
    if(e?.mainType==='شركات خاصة')return 'company';
    return 'gov';
  }
  function renderAssignmentEditor(user){
    const role=$('editRole').value,kindWrap=$('editEntityKindWrap'),entityWrap=$('editEntityWrap'),fixed=$('editFixedAssignment'),kind=$('editEntityKind'),sel=$('editEntity');
    fixed.classList.add('hidden');kindWrap.classList.add('hidden');entityWrap.classList.add('hidden');
    if(role===Contracts.Roles.ADMIN||role===Contracts.Roles.SUPERVISOR){
      const dir=directorate();fixed.textContent=`الجهة الإشرافية: ${dir?.name||'مديرية الشئون الصحية بالدقهلية'} (تلقائياً)`;fixed.classList.remove('hidden');sel.value=dir?.entityId||'';return;
    }
    if(role===Contracts.Roles.TREATMENT_ENTRY){
      entityWrap.classList.remove('hidden');$('editEntityLabel').textContent='وحدة المعالجة';sel.innerHTML=optionsHtml(entities.treatmentUnits,user?.entityId,'-- اختر وحدة المعالجة --');return;
    }
    kindWrap.classList.remove('hidden');entityWrap.classList.remove('hidden');$('editEntityLabel').textContent='الجهة المرتبطة';
    if(!kind.value)kind.value=currentAssignmentKind(user||{});
    const k=kind.value;let list=[],placeholder='-- اختر الجهة --';
    if(k==='health_admin'){list=entities.healthAdmins;placeholder='-- اختر الإدارة الصحية --';}
    else if(k==='private'){list=(entities.facilities||[]).filter(x=>x.mainType==='منشأت خاصة');placeholder='-- اختر المنشأة الخاصة --';}
    else if(k==='company'){list=(entities.facilities||[]).filter(x=>x.mainType==='شركات خاصة');placeholder='-- اختر الشركة الخاصة --';}
    else if(k==='directorate_pending'){list=entities.directorates;placeholder='-- حساب مديرية بانتظار تفعيل مشرف/مدير --';}
    else{list=(entities.facilities||[]).filter(x=>x.mainType==='منشأت حكومية');placeholder='-- اختر المنشأة الحكومية --';}
    sel.innerHTML=optionsHtml(list,user?.entityId,placeholder);
  }
  function openEdit(user){
    editingEmail=user.email||'';$('editUserTitle').textContent=user.fullName||user.email||'تعديل مستخدم';$('editUserEmail').textContent=user.email||'';
    $('editRole').innerHTML=Contracts.RoleList.map(r=>`<option value="${Utils.escapeHtml(r)}">${Utils.escapeHtml(r)}</option>`).join('');$('editRole').value=Contracts.RoleList.includes(user.role)?user.role:Contracts.Roles.FACILITY_ENTRY;
    $('editEntityKind').value=currentAssignmentKind(user);$('editEntity').dataset.original=user.entityId||'';renderAssignmentEditor(user);
    $('userEditModal').classList.remove('hidden');document.body.classList.add('overflow-hidden');
  }
  function closeEdit(){editingEmail='';$('userEditModal').classList.add('hidden');document.body.classList.remove('overflow-hidden');}
  async function saveEdit(){
    const user=usersCache.find(x=>x.email===editingEmail);if(!user)return;
    const role=$('editRole').value;let entityId=$('editEntity').value||'';
    if(role===Contracts.Roles.ADMIN||role===Contracts.Roles.SUPERVISOR)entityId=directorate()?.entityId||'';
    try{
      Validators.assertAccessAssignment(role,entityId);const btn=$('saveUserEdit');btn.disabled=true;btn.textContent='جاري الحفظ...';
      await UsersRepository.updateRole(editingEmail,role,entityId);
      user.role=role;const e=findEntity(entityId);user.entityId=entityId;user.entityName=e?.name||((role===Contracts.Roles.ADMIN||role===Contracts.Roles.SUPERVISOR)?'مديرية الشئون الصحية بالدقهلية':'');user.entityType=e?.entityType||'';
      renderUsers(usersCache);closeEdit();alert('تم حفظ الصلاحية والجهة بنجاح. سيحتاج المستخدم لتسجيل الدخول مجدداً.');
    }catch(error){alert(error.message||'تعذر حفظ التعديل.');}finally{const btn=$('saveUserEdit');if(btn){btn.disabled=false;btn.textContent='حفظ التعديل';}}
  }
  async function deleteUser(user,button){
    if(!confirm(`حذف المستخدم «${user.fullName||user.email}» من التطبيق؟\nلن يتم حذف سجلاته التاريخية.`))return;
    try{button.disabled=true;button.textContent='جاري الحذف...';await UsersRepository.deleteUser(user.email);usersCache=usersCache.filter(x=>x.email!==user.email);renderUsers(usersCache);}catch(error){alert(error.message||'تعذر حذف المستخدم.');button.disabled=false;button.textContent='حذف';}
  }

  $('usersTable')?.addEventListener('click',e=>{const row=e.target.closest('tr[data-email]');if(!row)return;const user=usersCache.find(x=>x.email===row.dataset.email);if(!user)return;if(e.target.closest('.edit-user-btn'))openEdit(user);if(e.target.closest('.delete-user-btn'))deleteUser(user,e.target.closest('.delete-user-btn'));});
  $('editRole')?.addEventListener('change',()=>{const u=usersCache.find(x=>x.email===editingEmail)||{};$('editEntityKind').value='';renderAssignmentEditor(u);});
  $('editEntityKind')?.addEventListener('change',()=>{const u=usersCache.find(x=>x.email===editingEmail)||{};renderAssignmentEditor({...u,entityId:''});});
  $('saveUserEdit')?.addEventListener('click',saveEdit);$('cancelUserEdit')?.addEventListener('click',closeEdit);$('closeUserEdit')?.addEventListener('click',closeEdit);
  $('userEditModal')?.addEventListener('click',e=>{if(e.target===$('userEditModal'))closeEdit();});
  $('userSearch')?.addEventListener('input',e=>{const q=String(e.target.value||'').trim().toLowerCase();renderUsers(!q?usersCache:usersCache.filter(u=>[u.fullName,u.email,u.mobile,u.role,u.entityName,u.workplace].some(v=>String(v||'').toLowerCase().includes(q))));});
  document.addEventListener('DOMContentLoaded',loadUsers);
})(window.MedWaste);
