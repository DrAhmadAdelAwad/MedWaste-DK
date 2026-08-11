# MedWaste DK — Stage 7 Release Notes

Version: **7.0**  
API Contract: **1.2**

Stage 7 is the production-hardening release built on the stable Stage 6.1 architecture.

## Added

- Script-level locking for critical read/write operations.
- Request idempotency for retry-safe mutations via hidden `_الطلبات` sheet.
- Bounded exponential retry/backoff with stable `requestId` across retries.
- Backend `retryAfterMs` support for lock contention.
- Paginated record reads (default 500, maximum 1000 rows per page).
- Settings cache (5 minutes) with Google Sheets remaining source of truth.
- Per-execution Spreadsheet/Sheet handle caching.
- One-time record-ID migration marker.
- Throttled session `lastUsed` writes.
- Contiguous-row trip deletion.
- Failure-safe settings replacement.
- Failure-safe password reset rollback when email delivery fails.
- Automatic Apps Script self-test logging.

## Compatibility

- Existing medical-waste record schema is unchanged.
- User/settings/session schemas are unchanged.
- Frontend and backend must be deployed together because API Contract changes from 1.1 to 1.2.

## Verified

- Automated suite: **30/30 PASS**.
- Backend self-tests: **13/13 PASS**.
