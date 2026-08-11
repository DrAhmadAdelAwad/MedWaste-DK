/**
 * Script-level concurrency helpers.
 * LockService is intentionally isolated here so business modules stay testable.
 */

function withScriptLock_(operationName, fn) {
  var lock = LockService.getScriptLock();
  var acquired = false;
  try {
    acquired = lock.tryLock(LOCK_WAIT_MS);
  } catch (err) {
    acquired = false;
  }

  if (!acquired) {
    return failure_(
      ERROR_CODES.BUSY,
      'النظام مشغول بعملية أخرى حالياً. سيتم إعادة المحاولة تلقائياً.',
      {operation: clean_(operationName), retryAfterMs: 1000}
    );
  }

  try {
    return fn();
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
}
