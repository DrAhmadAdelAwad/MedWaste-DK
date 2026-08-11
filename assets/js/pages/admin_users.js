(function (MW) {
  'use strict';

  const { Session, UsersRepository, Contracts, Validators } = MW;
  const currentUser = Session.getUser();
  if (!currentUser || !Session.getToken() || !Contracts.canRole(currentUser.role, Contracts.Actions.GET_USERS)) {
    alert('عفواً، هذه الصفحة مخصصة للمدير فقط.');
    window.location.href = 'index.html';
    return;
  }

  async function loadUsers() {
    const table = document.getElementById('usersTable');
    try {
      const users = await UsersRepository.list();
      table.innerHTML = '';

      users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50';
        row.innerHTML = `
          <td class="p-4">
            <div class="font-bold text-slate-800 user-name"></div>
            <div class="text-xs text-slate-500 user-job"></div>
          </td>
          <td class="p-4 text-sm text-slate-600">
            <div class="user-email"></div>
            <div class="text-xs user-mobile"></div>
          </td>
          <td class="p-4 font-bold text-emerald-600 user-role"></td>
          <td class="p-4 flex gap-2">
            <select class="border rounded-lg px-2 py-1 text-sm bg-white role-select">
              ${Contracts.RoleList.map(role => `<option value="${role}">${role}</option>`).join('')}
            </select>
            <button type="button" class="update-role-btn bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg">تحديث</button>
          </td>`;
        row.querySelector('.user-name').textContent = user.fullName || '';
        row.querySelector('.user-job').textContent = `${user.jobTitle || ''} - ${user.workplace || ''}`;
        row.querySelector('.user-email').textContent = user.email || '';
        row.querySelector('.user-mobile').textContent = user.mobile || '';
        row.querySelector('.user-role').textContent = user.role || '';
        row.querySelector('.role-select').value = user.role || Contracts.Roles.DATA_ENTRY;
        row.querySelector('.update-role-btn').dataset.email = user.email || '';
        table.appendChild(row);
      });
    } catch (error) {
      table.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-rose-500">حدث خطأ في تحميل البيانات</td></tr>';
    }
  }

  async function updateRole(email, button) {
    const row = button.closest('tr');
    const newRole = row.querySelector('.role-select').value;
    try {
      Validators.assertRole(newRole);
      button.innerText = '...';
      button.disabled = true;
      await UsersRepository.updateRole(email, newRole);
      alert('تم تحديث الصلاحية بنجاح');
      await loadUsers();
    } catch (error) {
      alert(error.message || 'فشل الاتصال');
      button.innerText = 'تحديث';
      button.disabled = false;
    }
  }

  document.getElementById('usersTable')?.addEventListener('click', event => {
    const button = event.target.closest('.update-role-btn');
    if (button) updateRole(button.dataset.email, button);
  });

  document.addEventListener('DOMContentLoaded', loadUsers);
})(window.MedWaste);
