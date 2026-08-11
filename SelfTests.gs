/**
 * Safe backend self-tests. Does not read or write Google Sheets.
 * Run runSelfTests() manually from Apps Script after structural changes.
 */

function runSelfTests() {
  var results = [];

  function test(name, fn) {
    try {
      fn();
      results.push({name: name, status: 'PASS'});
    } catch (err) {
      results.push({name: name, status: 'FAIL', message: errorSummary_(err)});
    }
  }

  function assert_(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }

  test('contract version exists', function () {
    assert_(Boolean(API_CONTRACT_VERSION), 'Missing API contract version');
  });

  test('health action exists', function () {
    assert_(API_ACTIONS.HEALTH === 'health', 'Health action mismatch');
  });

  test('email validation', function () {
    assert_(isValidEmail_('user@example.com'), 'Valid email rejected');
    assert_(!isValidEmail_('invalid-email'), 'Invalid email accepted');
  });

  test('ISO date validation', function () {
    assert_(isValidIsoDate_('2026-08-11'), 'Valid date rejected');
    assert_(!isValidIsoDate_('2026-02-30'), 'Invalid date accepted');
  });

  test('record validation', function () {
    var valid = validateRecordInput_({
      reportDate: '2026-08-11',
      treatmentUnit: 'وحدة معالجة',
      driverName: 'سائق',
      carNumber: '1234',
      facilityMainType: 'منشأت حكومية',
      subFacilityName: 'منشأة',
      visitType: 'نقل نفايات',
      wasteWeight: 10,
      weightUnit: 'كجم'
    });
    assert_(valid === null, 'Valid record rejected');
  });

  test('record row mapper', function () {
    var record = recordFromRow_([
      '2026-08-11T10:00:00Z', '2026-08-11', 'Unit', 'Driver', '123',
      'Government', 'Admin', 'Facility', 'Visit', 5, 'kg', 'Tester', 'rec-1', 'trip-1'
    ]);
    assert_(record.recordId === 'rec-1', 'Record ID column mismatch');
    assert_(record.tripId === 'trip-1', 'Trip ID column mismatch');
    var row = recordToRow_(record, 'Tester');
    assert_(row.length === DATA_HEADERS.length, 'Record row column count mismatch');
    assert_(row[12] === 'rec-1' && row[13] === 'trip-1', 'Record identifiers moved');
  });

  test('user row mapper', function () {
    var user = userFromRow_(['', 'Name', 'Job', 'Place', '010', 'user@example.com', 'hash', ROLES.ADMIN]);
    assert_(user.fullName === 'Name', 'User name mapping failed');
    assert_(user.role === ROLES.ADMIN, 'User role mapping failed');
  });

  test('request id normalization', function () {
    var id = normalizeRequestId_('req-ABC_123');
    assert_(id === 'req-ABC_123', 'Request ID normalization changed valid value');
  });

  test('response metadata', function () {
    var context = {requestId: 'req-test'};
    var out = attachResponseMeta_(success_({message: 'OK'}), context);
    assert_(out.requestId === 'req-test', 'Missing request ID');
    assert_(out.contractVersion === API_CONTRACT_VERSION, 'Missing contract version');
    assert_(out.appVersion === APP_VERSION, 'Missing app version');
  });

  test('stage7 busy error exists', function () {
    assert_(ERROR_CODES.BUSY === 'BUSY', 'BUSY error code missing');
  });

  test('stage7 pagination limits', function () {
    assert_(API_LIMITS.RECORDS_PAGE_SIZE_DEFAULT === 500, 'Default page size mismatch');
    assert_(API_LIMITS.RECORDS_PAGE_SIZE_MAX === 1000, 'Max page size mismatch');
  });

  test('stage7 pagination normalization', function () {
    assert_(normalizeRecordsPage_('2') === 2, 'Page normalization failed');
    assert_(normalizeRecordsPageSize_('9999') === 1000, 'Page size cap failed');
  });

  test('stage7 idempotency action selection', function () {
    assert_(isIdempotentMutationAction_(API_ACTIONS.ADD_RECORDS_BATCH), 'Batch save should be idempotent');
    assert_(!isIdempotentMutationAction_(API_ACTIONS.LOGIN), 'Login must not use mutation replay storage');
  });

  var failed = results.filter(function (item) { return item.status === 'FAIL'; }).length;
  var report = {
    result: failed ? 'error' : 'success',
    passed: results.length - failed,
    failed: failed,
    tests: results,
    version: APP_VERSION,
    contractVersion: API_CONTRACT_VERSION
  };

  // Surface the report automatically in the Apps Script Execution log.
  // Logging remains centralized through Logging.gs.
  if (typeof logEvent_ === 'function') {
    logEvent_(failed ? 'ERROR' : 'INFO', 'self_tests_finished', report);
  }
  return report;
}
