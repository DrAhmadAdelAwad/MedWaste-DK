/**
 * User administration use cases.
 * Persistence is delegated to UserRepository.gs.
 */

function getUsers_(p) {
  var auth = requireAuth_(p, [ROLES.ADMIN]);
  if (!auth.ok) return auth.error;
  return success_({data: userRepositoryList_()});
}

function updateRole_(p) {
  var auth = requireAuth_(p, [ROLES.ADMIN]);
  if (!auth.ok) return auth.error;

  var targetEmail = normalizeEmail_(p.targetEmail);
  var newRole = clean_(p.newRole);
  var validationError = validateRoleUpdateInput_(p);
  if (validationError) return validationError;

  return withScriptLock_('update_role', function () {
    var found = userRepositoryFindByEmail_(targetEmail);
    if (!found) return failure_(ERROR_CODES.NOT_FOUND, 'المستخدم غير موجود.');

    if (found.user.role === ROLES.ADMIN && newRole !== ROLES.ADMIN && userRepositoryCountAdmins_() <= 1) {
      return failure_(ERROR_CODES.LAST_ADMIN, 'لا يمكن إزالة صلاحية آخر مدير في النظام.');
    }

    userRepositoryUpdateRole_(found.rowNumber, newRole);
    return success_();
  });
}
