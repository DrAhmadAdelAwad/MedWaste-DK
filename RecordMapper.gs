/**
 * Maps record domain objects to/from the Google Sheets row schema.
 */

function recordFromRow_(row) {
  return {
    timestamp: normalizeTimestamp_(row[0]),
    reportDate: normalizeDate_(row[1]),
    treatmentUnit: row[2] || '',
    driverName: row[3] || '',
    carNumber: row[4] || '',
    facilityMainType: row[5] || '',
    healthAdmin: row[6] || '',
    subFacilityName: row[7] || '',
    facilityName: row[7] || '',
    visitType: row[8] || '',
    wasteWeight: row[9] === '' ? 0 : row[9],
    weightUnit: row[10] || '',
    createdBy: row[11] || 'غير مسجل',
    recordId: clean_(row[12]),
    tripId: clean_(row[13])
  };
}

function recordToRow_(record, actor) {
  return [
    normalizeTimestamp_(record.timestamp) || new Date().toISOString(),
    normalizeDate_(record.reportDate),
    clean_(record.treatmentUnit),
    clean_(record.driverName),
    clean_(record.carNumber),
    clean_(record.facilityMainType),
    clean_(record.healthAdmin),
    clean_(record.subFacilityName || record.facilityName),
    clean_(record.visitType),
    numberOrZero_(record.wasteWeight),
    clean_(record.weightUnit),
    actor || 'غير مسجل',
    clean_(record.recordId),
    clean_(record.tripId)
  ];
}
