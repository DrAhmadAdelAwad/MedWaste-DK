# MedWaste DK — Stage 7 Production Hardening

Application version: **7.0**  
API contract version: **1.2**

Stage 7 hardens the existing Stage 6 domain/data architecture for real concurrent use on Google Sheets. It does not replace the Domain → Repository design and it does not change the medical-waste data columns.

## 1. Concurrency control

Critical read-then-write operations now use `Concurrency.gs` and `LockService` through one boundary:

- registering a user
- adding record batches
- deleting a trip
- saving centralized settings
- changing user roles
- committing a password reset

When the script lock cannot be acquired within the configured window, the API returns `BUSY`. The frontend treats `BUSY` as transient and retries safe operations.

## 2. Idempotent mutations

The following mutations are protected against duplicate execution when the same request is retried:

- `update_role`
- `save_settings`
- `add_record`
- `add_records_batch`
- `delete_trip`

A hidden system sheet named `_الطلبات` stores the request claim and completed response for 24 hours. The same `requestId` receives the stored response instead of repeating the side effect.

Record saves still retain the stronger `recordId` duplicate protection already introduced in earlier stages.

## 3. Retry with exponential backoff

`assets/js/core/api.js` retries transient failures only for safe operations. The same `requestId` is retained across all retry attempts.

Retryable conditions:

- network failure
- request timeout
- temporary server error
- invalid/transient response
- backend `BUSY`

The client also respects the backend `details.retryAfterMs` hint for lock contention, while still applying a bounded retry delay. Authentication operations such as login/register are intentionally not auto-retried because they can create unintended side effects.

## 4. Paged record reads

`get_records` now supports:

- `page`
- `pageSize`

The frontend reads records in pages of 500 rows. The maximum page size is 1000. Calls without paging parameters still return the full dataset for backward compatibility.

## 5. Google Sheets performance

- Record inserts remain one `setValues()` batch.
- Trip deletion uses exact trip-ID matches and deletes contiguous row groups instead of calling `deleteRow()` for every record.
- Settings use Script Cache for five minutes; Google Sheets remains the source of truth.
- Spreadsheet and sheet references are cached within one Apps Script execution.
- Record-ID legacy migration is marked in PropertiesService and is no longer rescanned on every normal request.
- Session `last used` writes are throttled to once every five minutes per active session.

## 6. New backend modules

- `Concurrency.gs`
- `Cache.gs`
- `Idempotency.gs`
- `IdempotencyRepository.gs`

A new hidden sheet `_الطلبات` is created by `setupSystem()`.


## 7. Failure-safe writes

Two destructive edge cases are hardened in Stage 7:

- Settings replacement writes the new normalized snapshot **before** clearing stale tail rows. A transient Sheets failure can no longer empty the settings table simply because `clearContents()` happened first.
- Password reset persists the temporary credential before sending the email. If mail delivery fails, the previous stored credential is restored. Session invalidation is best-effort after successful delivery so an auxiliary cleanup failure cannot invalidate the password that was already emailed.

## 8. Deployment diagnostics

`runSelfTests()` now writes its complete structured result to the Apps Script Execution log through `Logging.gs`. No manual `console.log` patch is required.

## 9. Compatibility

The medical-waste record schema is unchanged:

- existing 12 legacy columns remain unchanged
- column 13 remains `معرف السجل`
- column 14 remains `معرف الرحلة`

The new `_الطلبات` sheet is infrastructure metadata only and does not alter existing business data.
