/**
 * Persistence boundary for authentication sessions.
 * Stage 7 avoids keeping stale row numbers across mutations by locating rows by token.
 */

function sessionRepositorySheet_() {
  return ensureSessionsSheet_(getSpreadsheet_());
}

function sessionRepositoryCreate_(email, expires) {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  sessionRepositorySheet_().appendRow([token, normalizeEmail_(email), expires, new Date()]);
  return token;
}

function sessionRepositoryTokenRange_(sheet) {
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1) : null;
}

function sessionRepositoryFindByToken_(token) {
  var sheet = sessionRepositorySheet_();
  var range = sessionRepositoryTokenRange_(sheet);
  if (!range) return null;
  var match = range.createTextFinder(clean_(token)).matchEntireCell(true).findNext();
  if (!match) return null;
  var rowNumber = match.getRow();
  var row = sheet.getRange(rowNumber, 1, 1, SESSION_HEADERS.length).getValues()[0];
  return {
    sheet: sheet,
    rowNumber: rowNumber,
    token: clean_(row[0]),
    email: normalizeEmail_(row[1]),
    expires: row[2],
    lastUsed: row[3]
  };
}

function sessionRepositoryTouch_(token) {
  var sheet = sessionRepositorySheet_();
  var range = sessionRepositoryTokenRange_(sheet);
  if (!range) return false;
  var match = range.createTextFinder(clean_(token)).matchEntireCell(true).findNext();
  if (!match) return false;
  sheet.getRange(match.getRow(), 4).setValue(new Date());
  return true;
}

function sessionRepositoryDeleteByToken_(token) {
  var sheet = sessionRepositorySheet_();
  var range = sessionRepositoryTokenRange_(sheet);
  if (!range) return 0;
  var matches = range.createTextFinder(clean_(token)).matchEntireCell(true).findAll();
  if (!matches || !matches.length) return 0;
  var rows = matches.map(function (item) { return item.getRow(); }).sort(function (a, b) { return b - a; });
  for (var i = 0; i < rows.length; i++) sheet.deleteRow(rows[i]);
  return rows.length;
}

function sessionRepositoryInvalidateEmail_(email) {
  var sheet = sessionRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var deleted = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    if (normalizeEmail_(values[i][0]) === normalizeEmail_(email)) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function sessionRepositoryCleanupExpired_(now) {
  var sheet = sessionRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var values = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  var deleted = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    var expires = values[i][0] instanceof Date ? values[i][0] : new Date(values[i][0]);
    if (isNaN(expires.getTime()) || expires <= now) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}
