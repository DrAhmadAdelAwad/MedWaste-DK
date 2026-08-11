/**
 * Medical-waste record and trip use cases.
 * Persistence is delegated to RecordRepository.gs.
 */

function normalizeRecordsPage_(value) {
  var n = Math.floor(Number(value));
  return isFinite(n) && n > 0 ? n : 1;
}

function normalizeRecordsPageSize_(value) {
  var n = Math.floor(Number(value));
  if (!isFinite(n) || n <= 0) n = API_LIMITS.RECORDS_PAGE_SIZE_DEFAULT;
  return Math.min(API_LIMITS.RECORDS_PAGE_SIZE_MAX, n);
}

function getRecords_(p) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;

  // Backward compatibility: callers without page/pageSize still receive the full list.
  var hasPaging = clean_(p.page) !== '' || clean_(p.pageSize) !== '';
  if (!hasPaging) return success_({data: recordRepositoryFindAll_()});

  var page = normalizeRecordsPage_(p.page);
  var pageSize = normalizeRecordsPageSize_(p.pageSize);
  var result = recordRepositoryFindPage_(page, pageSize);
  return success_({data: result.records, pagination: result.pagination});
}

function addRecords_(p, isBatch) {
  var auth = requireAuth_(p);
  if (!auth.ok) return auth.error;

  var incoming;
  if (isBatch) {
    try {
      incoming = JSON.parse(clean_(p.recordsData) || '[]');
    } catch (err) {
      return failure_(ERROR_CODES.INVALID_JSON, 'بيانات السجلات غير صحيحة.');
    }
  } else {
    incoming = [p];
  }

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return failure_(ERROR_CODES.VALIDATION, 'لا توجد سجلات للحفظ.');
  }
  if (incoming.length > API_LIMITS.RECORDS_PER_BATCH) {
    return failure_(ERROR_CODES.TOO_MANY_RECORDS, 'الحد الأقصى ' + API_LIMITS.RECORDS_PER_BATCH + ' سجل في العملية الواحدة.');
  }

  return withScriptLock_('add_records', function () {
    var existingIds = recordRepositoryExistingIds_();
    var rows = [];
    var accepted = [];
    var skipped = 0;

    for (var i = 0; i < incoming.length; i++) {
      var record = incoming[i] || {};
      var recordId = clean_(record.recordId || record.id) || Utilities.getUuid();
      if (existingIds[recordId]) {
        skipped++;
        continue;
      }

      var validationError = validateRecordInput_(record);
      if (validationError) {
        validationError.details = {recordIndex: i};
        return validationError;
      }

      var tripId = clean_(record.tripId) || Utilities.getUuid();
      var canonical = Object.assign({}, record, {recordId: recordId, tripId: tripId});
      rows.push(recordToRow_(canonical, auth.user.fullName || auth.user.email));
      accepted.push({recordId: recordId, tripId: tripId});
      existingIds[recordId] = true;
    }

    recordRepositoryInsertRows_(rows);
    return success_({inserted: rows.length, skipped: skipped, records: accepted});
  });
}

function deleteTrip_(p) {
  var auth = requireAuth_(p, [ROLES.ADMIN]);
  if (!auth.ok) return auth.error;

  var tripId = clean_(p.tripId);
  if (!tripId) return failure_(ERROR_CODES.VALIDATION, 'معرف الرحلة مطلوب للحذف.');

  return withScriptLock_('delete_trip', function () {
    var deleted = recordRepositoryDeleteByTripId_(tripId);
    // Treat repeated deletes as success so a lost response can be retried safely.
    return success_({deleted: deleted, alreadyDeleted: deleted === 0});
  });
}
