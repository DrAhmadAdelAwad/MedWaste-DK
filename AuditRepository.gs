/**
 * Persistence boundary for the immutable-style audit trail.
 */

function auditRepositorySheet_() {
  return ensureAuditSheet_(getSpreadsheet_());
}

function auditRepositoryAppend_(entry) {
  var sheet = auditRepositorySheet_();
  sheet.appendRow([
    clean_(entry.auditId) || Utilities.getUuid(),
    entry.timestamp || new Date(),
    clean_(entry.requestId),
    clean_(entry.action),
    clean_(entry.event),
    clean_(entry.result),
    normalizeEmail_(entry.actorEmail),
    clean_(entry.actorName),
    clean_(entry.actorRole),
    clean_(entry.targetType),
    clean_(entry.targetId),
    clean_(entry.metadataJson)
  ]);

  var total = Math.max(0, sheet.getLastRow() - 1);
  if (total > AUDIT_MAX_ROWS) {
    var excess = total - AUDIT_MAX_ROWS;
    sheet.deleteRows(2, excess);
  }
  return true;
}

function auditRepositoryFindPage_(page, pageSize) {
  var sheet = auditRepositorySheet_();
  var total = Math.max(0, sheet.getLastRow() - 1);
  page = Math.max(1, Math.floor(Number(page) || 1));
  pageSize = Math.max(1, Math.min(API_LIMITS.AUDIT_PAGE_SIZE_MAX, Math.floor(Number(pageSize) || API_LIMITS.AUDIT_PAGE_SIZE_DEFAULT)));

  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) page = totalPages;
  if (!total) {
    return {items: [], pagination: {page: 1, pageSize: pageSize, total: 0, totalPages: 0, hasMore: false}};
  }

  var newestIndex = total - (page - 1) * pageSize;
  var oldestIndex = Math.max(1, newestIndex - pageSize + 1);
  var count = newestIndex - oldestIndex + 1;
  var rows = sheet.getRange(oldestIndex + 1, 1, count, AUDIT_HEADERS.length).getValues().reverse();

  var items = rows.map(function (row) {
    var metadata = {};
    try { metadata = row[11] ? JSON.parse(String(row[11])) : {}; } catch (err) { metadata = {}; }
    return {
      auditId: clean_(row[0]),
      timestamp: normalizeTimestamp_(row[1]),
      requestId: clean_(row[2]),
      action: clean_(row[3]),
      event: clean_(row[4]),
      result: clean_(row[5]),
      actorEmail: normalizeEmail_(row[6]),
      actorName: clean_(row[7]),
      actorRole: clean_(row[8]),
      targetType: clean_(row[9]),
      targetId: clean_(row[10]),
      metadata: metadata
    };
  });

  return {
    items: items,
    pagination: {
      page: page,
      pageSize: pageSize,
      total: total,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page < Math.ceil(total / pageSize)
    }
  };
}

function auditRepositoryCleanupOld_(now) {
  var sheet = auditRepositorySheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  var cutoff = new Date((now || new Date()).getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var removeCount = 0;
  for (var i = 0; i < values.length; i++) {
    var d = values[i][0] instanceof Date ? values[i][0] : new Date(values[i][0]);
    if (!isNaN(d.getTime()) && d < cutoff) removeCount++;
    else break;
  }
  if (removeCount > 0) sheet.deleteRows(2, removeCount);
  return removeCount;
}
