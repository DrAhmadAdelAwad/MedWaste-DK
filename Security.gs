/**
 * Password and session-token security helpers.
 */

function hashPassword_(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return 'sha256$' + salt + '$' + sha256Hex_(salt + String(password));
}

function constantTimeEquals_(a, b) {
  a = String(a || '');
  b = String(b || '');
  var mismatch = a.length ^ b.length;
  var max = Math.max(a.length, b.length);
  for (var i = 0; i < max; i++) {
    mismatch |= (a.charCodeAt(i % Math.max(1, a.length)) || 0) ^ (b.charCodeAt(i % Math.max(1, b.length)) || 0);
  }
  return mismatch === 0;
}

function verifyPassword_(password, stored) {
  stored = String(stored || '');
  if (stored.indexOf('sha256$') !== 0) return constantTimeEquals_(stored, String(password || ''));
  var parts = stored.split('$');
  if (parts.length !== 3) return false;
  return constantTimeEquals_(sha256Hex_(parts[1] + String(password || '')), parts[2]);
}

function sha256Hex_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    hex += ('0' + v.toString(16)).slice(-2);
  }
  return hex;
}

function makeTemporaryPassword_() {
  return 'Mw-' + Utilities.getUuid().replace(/-/g, '').substring(0, 12);
}

function sessionTokenHash_(token) {
  return 'tok$' + sha256Hex_(clean_(token));
}

function sessionTokenCandidates_(token) {
  var raw = clean_(token);
  if (!raw) return [];
  return [sessionTokenHash_(raw), raw];
}
