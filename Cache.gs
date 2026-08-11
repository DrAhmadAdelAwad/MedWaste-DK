/**
 * CacheService boundary.
 * Caching is an optimization only; Google Sheets remains the source of truth.
 */

function cacheGetJson_(key) {
  try {
    var raw = CacheService.getScriptCache().get(clean_(key));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function cachePutJson_(key, value, seconds) {
  try {
    CacheService.getScriptCache().put(
      clean_(key),
      JSON.stringify(value),
      Math.max(1, Math.min(21600, Number(seconds) || 60))
    );
  } catch (err) {
    // Cache failure must never fail a business operation.
  }
}

function cacheRemove_(key) {
  try { CacheService.getScriptCache().remove(clean_(key)); } catch (err) {}
}
