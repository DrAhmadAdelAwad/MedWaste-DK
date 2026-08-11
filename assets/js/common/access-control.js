(function (MW) {
  'use strict';

  const { Session, Auth, Contracts } = MW;
  const currentUser = Session.getUser();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const restrictedPages = ['view.html', 'reports.html', 'facility_report.html'];

  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  if (currentUser.role === Contracts.Roles.DATA_ENTRY && restrictedPages.includes(currentPage)) {
    alert('عفواً، صلاحيتك (مدخل بيانات) لا تسمح بالوصول لهذه الصفحة.');
    window.location.href = 'index.html';
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (currentUser.role !== Contracts.Roles.ADMIN) document.body.classList.add('role-non-admin');

    const navContainer = document.querySelector('.flex.flex-wrap.gap-2.justify-center');
    if (navContainer) {
      if (currentUser.role === Contracts.Roles.DATA_ENTRY) {
        navContainer.querySelectorAll('a').forEach(link => {
          if (!link.href.includes('index.html')) link.style.display = 'none';
        });
      }

      if (currentUser.role === Contracts.Roles.ADMIN && !navContainer.querySelector('[data-admin-nav]')) {
        const adminButton = document.createElement('a');
        adminButton.href = 'admin_users.html';
        adminButton.dataset.adminNav = 'true';
        adminButton.className = 'bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition';
        adminButton.innerText = '⚙️ لوحة المستخدمين';
        navContainer.appendChild(adminButton);
      }

      const userBadge = document.createElement('span');
      userBadge.className = 'bg-white/20 text-white px-3.5 py-2 rounded-xl font-semibold text-xs border border-white/30 backdrop-blur-sm flex items-center';
      userBadge.innerText = `👤 ${currentUser.fullName} (${currentUser.role})`;
      navContainer.appendChild(userBadge);

      const logoutButton = document.createElement('button');
      logoutButton.type = 'button';
      logoutButton.className = 'bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition';
      logoutButton.innerText = '🚪 خروج';
      logoutButton.addEventListener('click', () => Auth.logout());
      navContainer.appendChild(logoutButton);
    }

    if (currentUser.role !== Contracts.Roles.ADMIN) {
      document.getElementById('clearLocalStorageButton')?.classList.add('hidden');
      document.getElementById('managerControlsButton')?.classList.add('hidden');
    }
  });
})(window.MedWaste);
