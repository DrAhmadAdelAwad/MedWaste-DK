/**
 * Persistence boundary for medical-waste records.
 */

function recordRepositoryFindAll_() {
  var sheet = ensureDataSheet_(getSpreadsheet_());
  var data = sheet.getDataRange().getValues();
  var records = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[1] && !row[12]) continue;
    records.push(recordFromRow_(row));
  }
  return records;
}

function recordRepositoryFindPage_(page, pageSize) {
  var sheet = ensureDataSheet_(getSpreadsheet_());
  var lastRow = sheet.getLastRow();
  var totalRows = Math.max(0, lastRow - 1);
  var totalPages = totalRows === 0 ? 1 : Math.ceil(totalRows / pageSize);
  var safePage = Math.min(Math.max(1, page), totalPages);
  var startRow = 2 + (safePage - 1) * pageSize;
  var count = Math.max(0, Math.min(pageSize, lastRow - startRow + 1));
  var records = [];

  if (count > 0) {
    var data = sheet.getRange(startRow, 1, count, DATA_HEADERS.length).getValues();
    for (var i = 0; i < data.length; i++) {
      if (!data[i][1] && !data[i][12]) continue;
      records.push(recordFromRow_(data[i]));
    }
  }

  return {
    records: records,
    pagination: {
      page: safePage,
      pageSize: pageSize,
      totalRows: totalRows,
      totalPages: totalPages,
      hasMore: safePage < totalPages
    }
  };
}

function recordRepositoryExistingIds_() {
  var sheet = ensureDataSheet_(getSpreadsheet_());
  var existingIds = {};
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return existingIds;
  var ids = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0]) existingIds[String(ids[i][0])] = true;
  }
  return existingIds;
}

function recordRepositoryInsertRows_(rows) {
  if (!rows || !rows.length) return 0;
  var sheet = ensureDataSheet_(getSpreadsheet_());
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, DATA_HEADERS.length).setValues(rows);
  return rows.length;
}

function groupContiguousRowsDescending_(rowNumbers) {
  var rows = (rowNumbers || []).slice().sort(function (a, b) { return b - a; });
  var groups = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!groups.length || row !== groups[groups.length - 1].start - 1) {
      groups.push({start: row, count: 1});
    } else {
      groups[groups.length - 1].start = row;
      groups[groups.length - 1].count++;
    }
  }
  return groups;
}

function recordRepositoryDeleteByTripId_(tripId) {
  var sheet = ensureDataSheet_(getSpreadsheet_());
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;

  var matches = sheet
    .getRange(2, 14, lastRow - 1, 1)
    .createTextFinder(clean_(tripId))
    .matchEntireCell(true)
    .findAll();

  if (!matches || !matches.length) return 0;
  var rows = matches.map(function (range) { return range.getRow(); });
  var groups = groupContiguousRowsDescending_(rows);
  for (var i = 0; i < groups.length; i++) {
    sheet.deleteRows(groups[i].start, groups[i].count);
  }
  return rows.length;
}
