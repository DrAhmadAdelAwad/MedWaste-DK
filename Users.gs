/**
 * User administration use cases.
 * Stage 8 uses the centralized RBAC matrix and invalidates sessions after role changes.
 */

function getUsers_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.GET_USERS);
  if (!auth.ok) return auth.error;
  safeAuditEvent_({
    params: p, auth: auth, action: API_ACTIONS.GET_USERS,
    event: 'USERS_VIEWED', result: 'SUCCESS', targetType: 'users', targetId: 'list'
  });
  return success_({data: userRepositoryList_()});
}

function updateRole_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.UPDATE_ROLE);
  if (!auth.ok) return auth.error;

  var targetEmail = normalizeEmail_(p.targetEmail);
  var newRole = clean_(p.newRole);
  var validationError = validateRoleUpdateInput_(p);
  if (validationError) return validationError;

  return withScriptLock_('update_role', function () {
    var found = userRepositoryFindByEmail_(targetEmail);
    if (!found) return failure_(ERROR_CODES.NOT_FOUND, 'المستخدم غير موجود.');

    var oldRole = found.user.role;
    if (oldRole === ROLES.ADMIN && newRole !== ROLES.ADMIN && userRepositoryCountAdmins_() <= 1) {
      return failure_(ERROR_CODES.LAST_ADMIN, 'لا يمكن إزالة صلاحية آخر مدير في النظام.');
    }

    if (oldRole !== newRole) {
      userRepositoryUpdateRole_(found.rowNumber, newRole);
      invalidateSessionsForEmail_(targetEmail);
    }

    safeAuditEvent_({
      params: p, auth: auth, action: API_ACTIONS.UPDATE_ROLE,
      event: 'USER_ROLE_UPDATED', result: 'SUCCESS',
      targetType: 'user', targetId: targetEmail,
      metadata: {oldRole: oldRole, newRole: newRole, sessionsInvalidated: oldRole !== newRole}
    });
    return success_({changed: oldRole !== newRole});
  });
}
