/**
 * Persistence boundary for mutation request idempotency.
 */

function idempotencyRepositorySheet_() {
  return ensureIdempotencySheet_(getSpreadsheet_());
}


function idempotencyRepositoryCount_() {
  return Math.max(0, idempotencyRepositorySheet_().getLastRow() - 1);
}

function idempotencyRepositoryFind_(key) {
  var sheet = idempotencyRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;

  var match = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .createTextFinder(clean_(key))
    .matchEntireCell(true)
    .findNext();

  if (!match) return null;
  var rowNumber = match.getRow();
  var row = sheet.getRange(rowNumber, 1, 1, IDEMPOTENCY_HEADERS.length).getValues()[0];
  return {
    rowNumber: rowNumber,
    key: clean_(row[0]),
    requestId: clean_(row[1]),
    action: clean_(row[2]),
    status: clean_(row[3]),
    responseJson: clean_(row[4]),
    createdAt: row[5],
    expiresAt: row[6]
  };
}

function idempotencyRepositoryCreate_(entry) {
  idempotencyRepositorySheet_().appendRow([
    clean_(entry.key),
    clean_(entry.requestId),
    clean_(entry.action),
    'PROCESSING',
    '',
    entry.createdAt || new Date(),
    entry.expiresAt || new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000)
  ]);
}

function idempotencyRepositoryResetProcessing_(rowNumber, createdAt, expiresAt) {
  var sheet = idempotencyRepositorySheet_();
  sheet.getRange(rowNumber, 4, 1, 4).setValues([[
    'PROCESSING', '', createdAt || new Date(), expiresAt || new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000)
  ]]);
}

function idempotencyRepositoryComplete_(rowNumber, response) {
  var sheet = idempotencyRepositorySheet_();
  sheet.getRange(rowNumber, 4, 1, 2).setValues([['COMPLETED', JSON.stringify(response || {})]]);
}

function idempotencyRepositoryDelete_(rowNumber) {
  var sheet = idempotencyRepositorySheet_();
  if (rowNumber > 1 && rowNumber <= sheet.getLastRow()) sheet.deleteRow(rowNumber);
}

function idempotencyRepositoryCleanupExpired_(now) {
  var sheet = idempotencyRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var values = sheet.getRange(2, 7, lastRow - 1, 1).getValues();
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
