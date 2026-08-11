# Stage 7 Test Report

## Automated frontend/backend suite

Result: **30 passed / 0 failed**

Coverage includes:

- JavaScript syntax
- Apps Script syntax
- HTML dependency integrity
- frontend architecture boundaries
- backend architecture boundaries
- complete backend installation manifest
- frontend/backend API contract parity
- logger redaction
- validation and request correlation
- retry metadata
- transient safe-mutation retries retain one requestId
- login is not automatically retried
- backend `retryAfterMs` is respected for `BUSY`
- cloud/offline/permanent-error trip-save regression paths
- domain/repository boundaries
- cloud/local duplicate merging
- paginated record retrieval
- BUSY and pagination contract values
- row mapper schema preservation
- diagnostics token redaction
- backend idempotency replay executes a side effect only once
- lock contention returns BUSY
- settings replacement writes before stale cleanup
- password reset rolls back the previous credential when email delivery fails
- backend self-tests
- health endpoint metadata

## Backend self-tests

Result: **13 passed / 0 failed**

Stage 7 self-tests include:

- contract version
- health action
- email/date validation
- record validation
- record mapper
- user mapper
- request ID normalization
- response metadata
- BUSY error contract
- pagination limits
- pagination normalization
- idempotent mutation selection

`runSelfTests()` logs its structured report automatically in the Apps Script Execution log.

## Data safety

`DATA_HEADERS`, `USER_HEADERS`, `SETTINGS_HEADERS`, and `SESSION_HEADERS` are unchanged from Stage 6.1.

The only new spreadsheet structure is the hidden infrastructure sheet `_الطلبات` for request idempotency. Medical-waste business data columns remain unchanged.

## Final status

**Stage 7 release candidate: PASS**
