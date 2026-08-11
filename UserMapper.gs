/**
 * Maps user rows into domain-safe user objects.
 */

function userFromRow_(row) {
  return {
    fullName: row[1] || '',
    jobTitle: row[2] || '',
    workplace: row[3] || '',
    mobile: row[4] || '',
    email: row[5] || '',
    role: row[7] || ROLES.DATA_ENTRY
  };
}

function authUserFromRow_(row) {
  var user = userFromRow_(row);
  return {fullName: user.fullName, email: user.email, role: user.role};
}
