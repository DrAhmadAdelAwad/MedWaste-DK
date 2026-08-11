(function (MW) {
  'use strict';

  const { Storage, Api, Contracts, RecordEntity, RecordMapper } = MW;

  function getLocal() {
    const records = Storage.getJson(Storage.KEYS.records, []);
    return Array.isArray(records) ? records.map(RecordMapper.fromStorage) : [];
  }

  function saveLocal(records) {
    Storage.setJson(Storage.KEYS.records, Array.isArray(records) ? records : []);
  }

  function mergeCloudWithLocal(cloudRecords, localRecords) {
    const cloud = Array.isArray(cloudRecords) ? cloudRecords : [];
    const local = Array.isArray(localRecords) ? localRecords : [];
    const merged = cloud.map(record => {
      const copy = Object.assign({}, record);
      delete copy._syncStatus;
      return copy;
    });

    const ids = new Set();
    const signatures = new Set();
    merged.forEach(record => {
      if (record.recordId) ids.add(String(record.recordId));
      signatures.add(RecordEntity.signature(record));
    });

    local.forEach(record => {
      const id = record.recordId ? String(record.recordId) : '';
      if (id && ids.has(id)) return;
      const sig = RecordEntity.signature(record);
      if (!id && signatures.has(sig)) return;
      if (RecordEntity.isPending(record) || !id) {
        merged.push(record);
        if (id) ids.add(id);
        signatures.add(sig);
      }
    });
    return merged;
  }

  async function fetchCloudPaged() {
    const all = [];
    const pageSize = Contracts.Limits.RECORDS_PAGE_SIZE_DEFAULT || 500;
    let page = 1;

    // Safety cap prevents a malformed server response from causing an infinite loop.
    for (let guard = 0; guard < 500; guard += 1) {
      const response = await Api.get(Contracts.Actions.GET_RECORDS, { page, pageSize });
      all.push(...(response.data || []).map(RecordMapper.fromApi));

      const pagination = response.pagination;
      if (!pagination || !pagination.hasMore) break;
      page = Number(pagination.page || page) + 1;
    }
    return all;
  }

  async function fetchMerged() {
    const localSnapshot = getLocal().slice();
    const cloudRecords = await fetchCloudPaged();
    const merged = mergeCloudWithLocal(cloudRecords, localSnapshot);
    saveLocal(merged);
    return merged;
  }

  async function saveBatch(records) {
    const payload = (records || []).map(RecordMapper.toApi);
    return Api.post(Contracts.Actions.ADD_RECORDS_BATCH, { recordsData: JSON.stringify(payload) });
  }

  async function deleteTripCloud(tripId) {
    return Api.post(Contracts.Actions.DELETE_TRIP, { tripId: String(tripId || '').trim() });
  }

  function markSynced(recordIds) {
    const wanted = new Set((recordIds || []).map(String));
    const records = getLocal();
    records.forEach(record => {
      if (record.recordId && wanted.has(String(record.recordId))) delete record._syncStatus;
    });
    saveLocal(records);
    return records;
  }

  function appendLocal(records) {
    const current = getLocal();
    current.push(...records);
    saveLocal(current);
    return current;
  }

  function removeByIds(recordIds) {
    const wanted = new Set((recordIds || []).map(String));
    if (!wanted.size) return getLocal();
    const records = getLocal().filter(record => !record.recordId || !wanted.has(String(record.recordId)));
    saveLocal(records);
    return records;
  }

  function removeTripLocal(tripId) {
    const normalizedTripId = String(tripId || '').trim();
    const records = getLocal().filter(record => String(record.tripId || '').trim() !== normalizedTripId);
    saveLocal(records);
    return records;
  }

  function clearLocal() { Storage.remove(Storage.KEYS.records); }

  MW.RecordsRepository = Object.freeze({
    getLocal, saveLocal, mergeCloudWithLocal, fetchCloudPaged, fetchMerged, saveBatch, deleteTripCloud,
    markSynced, appendLocal, removeByIds, removeTripLocal, clearLocal
  });
})(window.MedWaste);
