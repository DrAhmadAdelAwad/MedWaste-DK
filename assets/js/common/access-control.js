(function (MW) {
  'use strict';

  const { Session, Auth, Contracts } = MW;
  const currentUser = Session.getUser();
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  const pageAction = Object.freeze({
    'view.html': Contracts.Actions.GET_RECORDS,
    'reports.html': Contracts.Actions.GET_RECORDS,
    'facility_report.html': Contracts.Actions.AUTHORIZE_CLAIM,
    'reconciliation.html': Contracts.Actions.GET_RECONCILIATION,
    'admin_users.html': Contracts.Actions.GET_USERS,
    'admin_audit.html': Contracts.Actions.GET_AUDIT_LOG
  });

  if (!currentUser || !Session.getToken()) {
    Session.clearUser();
    window.location.href = 'login.html';
    return;
  }

  const requiredAction = pageAction[currentPage];
  if (requiredAction && !Contracts.canRole(currentUser.role, requiredAction)) {
    alert('عفواً، صلاحيتك الحالية لا تسمح بالوصول لهذه الصفحة.');
    window.location.href = 'index.html';
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (currentUser.role !== Contracts.Roles.ADMIN) document.body.classList.add('role-non-admin');

    const navContainer = document.querySelector('.flex.flex-wrap.gap-2.justify-center');
    if (navContainer) {
      navContainer.querySelectorAll('a').forEach(link => {
        const page = (link.getAttribute('href') || '').split('/').pop();
        const action = pageAction[page];
        if (action && !Contracts.canRole(currentUser.role, action)) link.style.display = 'none';
      });

      if (Contracts.canRole(currentUser.role, Contracts.Actions.GET_USERS) && !navContainer.querySelector('[data-admin-users-nav]')) {
        const adminButton = document.createElement('a');
        adminButton.href = 'admin_users.html';
        adminButton.dataset.adminUsersNav = 'true';
        adminButton.className = 'bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition';
        adminButton.innerText = '⚙️ المستخدمون';
        navContainer.appendChild(adminButton);
      }

      if (Contracts.canRole(currentUser.role, Contracts.Actions.GET_AUDIT_LOG) && !navContainer.querySelector('[data-admin-audit-nav]')) {
        const auditButton = document.createElement('a');
        auditButton.href = 'admin_audit.html';
        auditButton.dataset.adminAuditNav = 'true';
        auditButton.className = 'bg-indigo-500 hover:bg-indigo-600 text-white px-3.5 py-2 rounded-xl font-bold text-xs shadow transition';
        auditButton.innerText = '🛡️ سجل التدقيق';
        navContainer.appendChild(auditButton);
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

    if (!Contracts.canRole(currentUser.role, Contracts.Actions.SAVE_SETTINGS)) {
      document.getElementById('clearLocalStorageButton')?.classList.add('hidden');
      document.getElementById('managerControlsButton')?.classList.add('hidden');
    }
  });
})(window.MedWaste);
