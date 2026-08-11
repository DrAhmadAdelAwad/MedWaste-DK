(function (MW) {
  'use strict';

  const { RecordEntity, Utils } = MW;

  function fromApi(input) {
    const record = RecordEntity.normalize(input);
    record.reportDate = Utils.toDateInputValue(record.reportDate);
    record.timestamp = Utils.toArabicDateTime(record.timestamp);
    return record;
  }

  function toApi(input) {
    const record = RecordEntity.normalize(input);
    delete record._syncStatus;
    return record;
  }

  function fromStorage(input) {
    return RecordEntity.normalize(input);
  }

  MW.RecordMapper = Object.freeze({ fromApi, toApi, fromStorage });
})(window.MedWaste);
