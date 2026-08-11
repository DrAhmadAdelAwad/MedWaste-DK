/**
 * Safe backend self-tests. Does not read or write Google Sheets.
 * Stage 8 adds RBAC, token-at-rest and audit-safety checks.
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
    assert_(API_CONTRACT_VERSION === '1.3', 'Stage 8 contract version mismatch');
  });

  test('health action exists', function () {
    assert_(API_ACTIONS.HEALTH === 'health', 'Health action mismatch');
  });

  test('audit action exists', function () {
    assert_(API_ACTIONS.GET_AUDIT_LOG === 'get_audit_log', 'Audit action mismatch');
  });

  test('email validation', function () {
    assert_(isValidEmail_('user@example.com'), 'Valid email rejected');
    assert_(!isValidEmail_('invalid-email'), 'Invalid email accepted');
  });

  test('ISO date validation', function () {
    assert_(isValidIsoDate_('2026-08-11'), 'Valid date rejected');
    assert_(!isValidIsoDate_('2026-02-30'), 'Invalid date accepted');
  });

  test('stage8 password minimum', function () {
    assert_(API_LIMITS.PASSWORD_MIN_LENGTH === 8, 'Password minimum is not 8');
    var bad = validateRegistrationInput_({fullName:'Tester', email:'user@example.com', password:'1234567'});
    assert_(bad && bad.result === 'error', 'Short registration password accepted');
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
  });

  test('user row mapper', function () {
    var user = userFromRow_(['', 'Name', 'Job', 'Place', '010', 'user@example.com', 'hash', ROLES.ADMIN]);
    assert_(user.fullName === 'Name', 'User name mapping failed');
    assert_(user.role === ROLES.ADMIN, 'User role mapping failed');
  });

  test('request id normalization', function () {
    assert_(normalizeRequestId_('req-ABC_123') === 'req-ABC_123', 'Request ID normalization changed valid value');
  });

  test('response metadata', function () {
    var out = attachResponseMeta_(success_({message: 'OK'}), {requestId: 'req-test'});
    assert_(out.requestId === 'req-test', 'Missing request ID');
    assert_(out.contractVersion === API_CONTRACT_VERSION, 'Missing contract version');
    assert_(out.appVersion === APP_VERSION, 'Missing app version');
  });

  test('busy error exists', function () {
    assert_(ERROR_CODES.BUSY === 'BUSY', 'BUSY error code missing');
  });

  test('records pagination limits', function () {
    assert_(API_LIMITS.RECORDS_PAGE_SIZE_DEFAULT === 500, 'Default records page size mismatch');
    assert_(normalizeRecordsPageSize_('9999') === 1000, 'Records page size cap failed');
  });

  test('audit pagination limits', function () {
    assert_(API_LIMITS.AUDIT_PAGE_SIZE_DEFAULT === 100, 'Default audit page size mismatch');
    assert_(API_LIMITS.AUDIT_PAGE_SIZE_MAX === 500, 'Max audit page size mismatch');
  });

  test('idempotency action selection', function () {
    assert_(isIdempotentMutationAction_(API_ACTIONS.ADD_RECORDS_BATCH), 'Batch save should be idempotent');
    assert_(!isIdempotentMutationAction_(API_ACTIONS.LOGIN), 'Login must not use mutation replay storage');
  });

  test('stage8 RBAC matrix', function () {
    assert_(actionRoles_(API_ACTIONS.ADD_RECORDS_BATCH).indexOf(ROLES.DATA_ENTRY) !== -1, 'Data entry cannot add records');
    assert_(actionRoles_(API_ACTIONS.GET_RECORDS).indexOf(ROLES.DATA_ENTRY) === -1, 'Data entry can read protected records');
    assert_(actionRoles_(API_ACTIONS.GET_RECORDS).indexOf(ROLES.SUPERVISOR) !== -1, 'Supervisor cannot read records');
    assert_(actionRoles_(API_ACTIONS.DELETE_TRIP).length === 1 && actionRoles_(API_ACTIONS.DELETE_TRIP)[0] === ROLES.ADMIN, 'Delete trip is not admin-only');
    assert_(actionRoles_(API_ACTIONS.GET_AUDIT_LOG)[0] === ROLES.ADMIN, 'Audit log is not admin-only');
  });

  test('protected GET is rejected', function () {
    var out = routeGet_({action: API_ACTIONS.GET_RECORDS});
    assert_(out.result === 'error' && out.code === ERROR_CODES.METHOD_NOT_ALLOWED, 'Protected GET was not rejected');
  });

  test('audit metadata redaction', function () {
    var safe = sanitizeAuditMetadata_({password:'abc', token:'xyz', passed:21, nested:{secret:'q', okay:2}}, 0);
    assert_(safe.password === '[REDACTED]', 'Password leaked into audit metadata');
    assert_(safe.token === '[REDACTED]', 'Token leaked into audit metadata');
    assert_(safe.nested.secret === '[REDACTED]' && safe.nested.okay === 2, 'Nested audit sanitization failed');
    assert_(safe.passed === 21, 'Safe audit key was over-redacted');
  });

  test('log metadata redaction', function () {
    var safe = sanitizeLogMeta_({password:'abc', token:'xyz', passed:21, okay:2}, 0);
    assert_(safe.password === '[REDACTED]' && safe.token === '[REDACTED]', 'Sensitive log metadata leaked');
    assert_(safe.okay === 2 && safe.passed === 21, 'Safe log metadata changed');
  });

  test('session token is hashed at rest', function () {
    var raw = 'raw-session-token';
    var stored = sessionTokenHash_(raw);
    assert_(stored.indexOf('tok$') === 0, 'Session token hash prefix missing');
    assert_(stored !== raw && stored.indexOf(raw) === -1, 'Raw token appears in stored session value');
  });

  test('stage8 security error codes', function () {
    assert_(ERROR_CODES.RATE_LIMITED === 'RATE_LIMITED', 'Rate limit error missing');
    assert_(ERROR_CODES.METHOD_NOT_ALLOWED === 'METHOD_NOT_ALLOWED', 'Method error missing');
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

  if (typeof logEvent_ === 'function') logEvent_(failed ? 'ERROR' : 'INFO', 'self_tests_finished', report);
  return report;
}
