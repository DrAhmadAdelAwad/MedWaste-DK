/**
 * Cache-backed security rate limiting.
 * This is a best-effort abuse control; authentication remains authoritative.
 */

function rateLimitKey_(scope, subject) {
  var normalized = clean_(subject).toLowerCase();
  var digest = sha256Hex_(clean_(scope) + '|' + normalized).substring(0, 32);
  return 'medwaste:rl:' + clean_(scope) + ':' + digest;
}

function rateLimitState_(scope, subject) {
  return cacheGetJson_(rateLimitKey_(scope, subject));
}

function rateLimitCheck_(scope, subject, maxAttempts, windowSeconds) {
  var state = rateLimitState_(scope, subject);
  if (!state) return null;

  var now = Date.now();
  var resetAt = Number(state.resetAt) || 0;
  if (!resetAt || resetAt <= now) {
    cacheRemove_(rateLimitKey_(scope, subject));
    return null;
  }

  if ((Number(state.count) || 0) >= maxAttempts) {
    return failure_(
      ERROR_CODES.RATE_LIMITED,
      'تم تجاوز عدد المحاولات المسموح مؤقتاً. حاول لاحقاً.',
      {retryAfterMs: Math.max(1000, resetAt - now)}
    );
  }
  return null;
}

function rateLimitRecord_(scope, subject, windowSeconds) {
  var key = rateLimitKey_(scope, subject);
  var now = Date.now();
  var state = cacheGetJson_(key);
  if (!state || !state.resetAt || Number(state.resetAt) <= now) {
    state = {count: 0, resetAt: now + windowSeconds * 1000};
  }
  state.count = (Number(state.count) || 0) + 1;
  var ttl = Math.max(1, Math.ceil((Number(state.resetAt) - now) / 1000));
  cachePutJson_(key, state, ttl);
  return state;
}

function rateLimitReset_(scope, subject) {
  cacheRemove_(rateLimitKey_(scope, subject));
}

function consumeRateLimit_(scope, subject, maxAttempts, windowSeconds) {
  var blocked = rateLimitCheck_(scope, subject, maxAttempts, windowSeconds);
  if (blocked) return blocked;
  rateLimitRecord_(scope, subject, windowSeconds);
  return null;
}
