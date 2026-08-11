/**
 * Persistence boundary for application users.
 */

function userRepositorySheet_() {
  return ensureUsersSheet_(getSpreadsheet_());
}

function userRepositoryAllRows_() {
  return userRepositorySheet_().getDataRange().getValues();
}

function userRepositoryList_() {
  var data = userRepositoryAllRows_();
  var users = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][5]) continue;
    users.push(userFromRow_(data[i]));
  }
  return users;
}

function userRepositoryFindByEmail_(email) {
  var data = userRepositoryAllRows_();
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][5]) === normalizeEmail_(email)) {
      return {rowNumber: i + 1, row: data[i], user: userFromRow_(data[i]), authUser: authUserFromRow_(data[i])};
    }
  }
  return null;
}

function userRepositoryAppend_(input) {
  userRepositorySheet_().appendRow([
    new Date(), clean_(input.fullName), clean_(input.jobTitle), clean_(input.workplace), clean_(input.mobile),
    normalizeEmail_(input.email), input.passwordHash, clean_(input.role) || ROLES.DATA_ENTRY
  ]);
}

function userRepositoryUpdatePassword_(rowNumber, passwordHash) {
  userRepositorySheet_().getRange(rowNumber, 7).setValue(passwordHash);
}

function userRepositoryUpdateRole_(rowNumber, role) {
  userRepositorySheet_().getRange(rowNumber, 8).setValue(role);
}

function userRepositoryCountAdmins_() {
  var data = userRepositoryAllRows_();
  var count = 0;
  for (var i = 1; i < data.length; i++) if (clean_(data[i][7]) === ROLES.ADMIN) count++;
  return count;
}

function userRepositoryIsEmpty_() {
  return userRepositorySheet_().getLastRow() <= 1;
}
