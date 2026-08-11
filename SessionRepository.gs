/**
 * Persistence boundary for authentication sessions.
 * Stage 8 stores only a SHA-256 lookup hash of session tokens at rest.
 */

function sessionRepositorySheet_() {
  return ensureSessionsSheet_(getSpreadsheet_());
}

function sessionRepositoryCreate_(email, expires) {
  var rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  sessionRepositorySheet_().appendRow([sessionTokenHash_(rawToken), normalizeEmail_(email), expires, new Date()]);
  sessionRepositoryTrimForEmail_(email, SESSION_MAX_ACTIVE_PER_USER);
  return rawToken;
}


function sessionRepositoryMigrateLegacyTokens_() {
  var sheet = sessionRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var range = sheet.getRange(2, 1, lastRow - 1, 1);
  var values = range.getValues();
  var changed = 0;
  for (var i = 0; i < values.length; i++) {
    var token = clean_(values[i][0]);
    if (token && token.indexOf('tok$') !== 0) {
      values[i][0] = sessionTokenHash_(token);
      changed++;
    }
  }
  if (changed) range.setValues(values);
  return changed;
}

function sessionRepositoryTokenRange_(sheet) {
  var lastRow = sheet.getLastRow();
  return lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1) : null;
}

function sessionRepositoryFindTokenMatch_(sheet, token) {
  var range = sessionRepositoryTokenRange_(sheet);
  if (!range) return null;
  var candidates = sessionTokenCandidates_(token);
  for (var i = 0; i < candidates.length; i++) {
    var match = range.createTextFinder(candidates[i]).matchEntireCell(true).findNext();
    if (match) return {match: match, matchedValue: candidates[i], hashedValue: candidates[0]};
  }
  return null;
}

function sessionRepositoryFindByToken_(token) {
  var sheet = sessionRepositorySheet_();
  var found = sessionRepositoryFindTokenMatch_(sheet, token);
  if (!found) return null;

  var rowNumber = found.match.getRow();
  var row = sheet.getRange(rowNumber, 1, 1, SESSION_HEADERS.length).getValues()[0];

  // One-time migration of legacy plaintext tokens.
  if (clean_(row[0]) !== found.hashedValue) {
    sheet.getRange(rowNumber, 1).setValue(found.hashedValue);
    row[0] = found.hashedValue;
  }

  return {
    sheet: sheet,
    rowNumber: rowNumber,
    tokenHash: clean_(row[0]),
    email: normalizeEmail_(row[1]),
    expires: row[2],
    lastUsed: row[3]
  };
}

function sessionRepositoryTouch_(token) {
  var sheet = sessionRepositorySheet_();
  var found = sessionRepositoryFindTokenMatch_(sheet, token);
  if (!found) return false;
  if (found.matchedValue !== found.hashedValue) sheet.getRange(found.match.getRow(), 1).setValue(found.hashedValue);
  sheet.getRange(found.match.getRow(), 4).setValue(new Date());
  return true;
}

function sessionRepositoryDeleteByToken_(token) {
  var sheet = sessionRepositorySheet_();
  var range = sessionRepositoryTokenRange_(sheet);
  if (!range) return 0;
  var candidates = sessionTokenCandidates_(token);
  var rowsMap = {};
  for (var c = 0; c < candidates.length; c++) {
    var matches = range.createTextFinder(candidates[c]).matchEntireCell(true).findAll();
    for (var i = 0; i < matches.length; i++) rowsMap[matches[i].getRow()] = true;
  }
  var rows = Object.keys(rowsMap).map(Number).sort(function (a, b) { return b - a; });
  for (var r = 0; r < rows.length; r++) sheet.deleteRow(rows[r]);
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
  var values = sheet.getRange(2, 3, lastRow - 1, 2).getValues();
  var deleted = 0;
  var idleCutoff = new Date(now.getTime() - SESSION_IDLE_MINUTES * 60 * 1000);
  for (var i = values.length - 1; i >= 0; i--) {
    var expires = values[i][0] instanceof Date ? values[i][0] : new Date(values[i][0]);
    var lastUsed = values[i][1] instanceof Date ? values[i][1] : new Date(values[i][1]);
    var expired = isNaN(expires.getTime()) || expires <= now;
    var idle = !isNaN(lastUsed.getTime()) && lastUsed < idleCutoff;
    if (expired || idle) {
      sheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

function sessionRepositoryTrimForEmail_(email, maxActive) {
  maxActive = Math.max(1, Number(maxActive) || 1);
  var sheet = sessionRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var values = sheet.getRange(2, 1, lastRow - 1, SESSION_HEADERS.length).getValues();
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (normalizeEmail_(values[i][1]) === normalizeEmail_(email)) {
      var lastUsed = values[i][3] instanceof Date ? values[i][3] : new Date(values[i][3]);
      matches.push({row: i + 2, time: isNaN(lastUsed.getTime()) ? 0 : lastUsed.getTime()});
    }
  }
  matches.sort(function (a, b) { return b.time - a.time; });
  var remove = matches.slice(maxActive).sort(function (a, b) { return b.row - a.row; });
  for (var r = 0; r < remove.length; r++) sheet.deleteRow(remove[r].row);
  return remove.length;
}
