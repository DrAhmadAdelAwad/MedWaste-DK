(function (MW) {
  'use strict';

  const TEXT_FIELDS = [
    'recordId', 'tripId', 'reportDate', 'treatmentUnit', 'driverName', 'carNumber',
    'facilityMainType', 'healthAdmin', 'subFacilityName', 'facilityName', 'visitType',
    'weightUnit', 'createdBy', 'timestamp', '_syncStatus'
  ];

  function normalize(input = {}) {
    const record = {};
    TEXT_FIELDS.forEach(key => {
      if (input[key] != null) record[key] = String(input[key]).trim();
    });
    record.subFacilityName = record.subFacilityName || record.facilityName || '';
    record.facilityName = record.facilityName || record.subFacilityName || '';
    const weight = Number(input.wasteWeight);
    record.wasteWeight = Number.isFinite(weight) ? weight : 0;
    return record;
  }

  function signature(input) {
    const record = normalize(input);
    return [
      record.reportDate,
      record.treatmentUnit,
      record.driverName,
      record.carNumber,
      record.facilityMainType,
      record.healthAdmin,
      record.subFacilityName,
      record.visitType,
      String(record.wasteWeight),
      record.weightUnit
    ].join('|');
  }

  function isPending(record) {
    return normalize(record)._syncStatus === 'pending';
  }

  MW.RecordEntity = Object.freeze({ normalize, signature, isPending });
})(window.MedWaste);
