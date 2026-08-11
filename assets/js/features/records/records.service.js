(function (MW) {
  'use strict';

  const Repo = MW.RecordsRepository;

  MW.Records = Object.freeze({
    getLocal: Repo.getLocal,
    saveLocal: Repo.saveLocal,
    mergeCloudWithLocal: Repo.mergeCloudWithLocal,
    fetchMerged: Repo.fetchMerged,
    markSynced: Repo.markSynced,
    append: Repo.appendLocal,
    removeByIds: Repo.removeByIds,
    removeTripLocal: Repo.removeTripLocal,
    clearLocal: Repo.clearLocal
  });
})(window.MedWaste);
