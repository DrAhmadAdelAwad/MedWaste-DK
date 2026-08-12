(function(MW){
  'use strict';
  const user=MW.Session.getUser()||{};
  document.addEventListener('DOMContentLoaded',()=>{
    const name=document.getElementById('homeUserName');
    if(name)name.textContent=(user.fullName||'مستخدم').split(' ')[0];
    const role=document.getElementById('homeRole');if(role)role.textContent=user.role||'';
    const entity=document.getElementById('homeEntity');if(entity)entity.textContent=user.entityName||'نطاق العمل المسجل بالحساب';
    const now=document.getElementById('homeDate');if(now)now.textContent=new Intl.DateTimeFormat('ar-EG',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  });
})(window.MedWaste);
