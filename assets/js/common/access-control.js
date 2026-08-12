(function (MW) {
  'use strict';
  const { Session, Contracts } = MW;
  const currentUser = Session.getUser();
  const currentPage = (window.location.pathname.split('/').pop() || 'home.html').toLowerCase();
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
    window.location.href = 'home.html';
    return;
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (currentUser.role !== Contracts.Roles.ADMIN) document.body.classList.add('role-non-admin');
    if (!Contracts.canRole(currentUser.role, Contracts.Actions.SAVE_SETTINGS)) {
      document.getElementById('clearLocalStorageButton')?.classList.add('hidden');
      document.getElementById('managerControlsButton')?.classList.add('hidden');
    }
  });
})(window.MedWaste);
