(function (MW) {
  'use strict';

  const { Session, Utils, Contracts, Validators, Errors, RecordsRepository, TripEntity } = MW;
  const Logger = MW.Logger || { warn() {} };

  function createRecords(route, batch) {
    const user = Session.getUser();
    return TripEntity.createRecords(route, batch, {
      generateId: Utils.generateId,
      createdBy: user ? user.fullName : Contracts.Roles.DATA_ENTRY,
      timestamp: new Date().toISOString()
    });
  }

  async function save(route, batch) {
    Validators.assertRoute(route);
    Validators.assertBatch(batch);
    const records = createRecords(route, batch);
    RecordsRepository.appendLocal(records);

    let cloudSaved = false;
    try {
      const response = await RecordsRepository.saveBatch(records);
      if (response.result === 'success') {
        RecordsRepository.markSynced(records.map(record => record.recordId));
        cloudSaved = true;
      }
    } catch (error) {
      if (!Errors.isRetryable(error)) {
        RecordsRepository.removeByIds(records.map(record => record.recordId));
        throw error;
      }
      Logger.warn('trip_cloud_save_deferred', { error, pendingRecords: records.length });
    }

    return { records, cloudSaved };
  }

  async function syncPending() {
    const pending = RecordsRepository.getLocal().filter(record =>
      record && record._syncStatus === 'pending' && record.recordId && record.tripId
    );
    if (!pending.length || !Session.getToken()) return { synced: 0 };

    const response = await RecordsRepository.saveBatch(pending);
    if (response.result === 'success') {
      RecordsRepository.markSynced(pending.map(record => record.recordId));
      return { synced: pending.length };
    }
    return { synced: 0 };
  }

  function group(records) {
    return TripEntity.group(records);
  }

  async function deleteTrip(tripId) {
    const response = await RecordsRepository.deleteTripCloud(tripId);
    if (response.result !== 'success') throw new Error(response.message || 'فشل الحذف');
    return RecordsRepository.removeTripLocal(tripId);
  }

  MW.Trips = Object.freeze({ createRecords, save, syncPending, group, deleteTrip });
})(window.MedWaste);
