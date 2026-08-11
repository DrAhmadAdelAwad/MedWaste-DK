(function (MW) {
  'use strict';

  const { RecordEntity } = MW;

  function createRecords(route, batch, options = {}) {
    const tripId = options.tripId || options.generateId('trip-');
    const timestamp = options.timestamp || new Date().toISOString();
    const createdBy = options.createdBy || '';

    return (batch || []).map(item => RecordEntity.normalize({
      recordId: options.generateId('rec-'),
      tripId,
      reportDate: route.reportDate,
      treatmentUnit: route.treatmentUnit,
      driverName: route.driverName,
      carNumber: route.carNumber,
      facilityMainType: item.facilityMainType,
      healthAdmin: item.healthAdmin,
      subFacilityName: item.subFacilityName,
      facilityName: item.subFacilityName,
      visitType: item.visitType,
      wasteWeight: item.wasteWeight,
      weightUnit: item.weightUnit,
      createdBy,
      timestamp,
      _syncStatus: 'pending'
    }));
  }

  function group(records) {
    const tripsMap = new Map();
    (records || []).forEach((rawRecord, index) => {
      const record = RecordEntity.normalize(rawRecord);
      const tripKey = record.tripId || `legacy_${record.reportDate}_${record.treatmentUnit}_${record.driverName}_${record.carNumber}`;
      if (!tripsMap.has(tripKey)) {
        tripsMap.set(tripKey, {
          tripKey,
          tripId: record.tripId || tripKey,
          reportDate: record.reportDate,
          treatmentUnit: record.treatmentUnit,
          driverName: record.driverName,
          carNumber: record.carNumber,
          timestamp: record.timestamp || 'غير متوفر',
          createdBy: record.createdBy || 'غير مسجل',
          facilities: []
        });
      }
      tripsMap.get(tripKey).facilities.push(Object.assign({ originalIndex: index }, rawRecord, record));
    });
    return Array.from(tripsMap.values());
  }

  MW.TripEntity = Object.freeze({ createRecords, group });
})(window.MedWaste);
