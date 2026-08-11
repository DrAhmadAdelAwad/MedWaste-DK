// Central API configuration and shared helpers.
var scriptURL = 'https://script.google.com/macros/s/AKfycby3fbtG-5YHmHkPF6O-zq9sHE1X20iM8jmwEF_z-aAy0dYFTfDoUoNypms7Luk4NJDuIw/exec';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') || 'null'); }
  catch (_) { return null; }
}

function getSessionToken() {
  var user = getStoredUser();
  return user && user.sessionToken ? user.sessionToken : '';
}

function parseMaybeJson(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (_) { return value; }
}

async function parseApiResponse(response) {
  if (!response.ok) throw new Error('HTTP ' + response.status);
  var text = await response.text();
  var data;
  try { data = JSON.parse(text); }
  catch (_) { throw new Error('استجابة غير صالحة من الخادم'); }

  if (data && data.result === 'error') {
    if (data.code === 'AUTH_REQUIRED') {
      localStorage.removeItem('currentUser');
      if (!/login\.html$/i.test(window.location.pathname)) {
        alert(data.message || 'انتهت جلسة الدخول. سجل الدخول مرة أخرى.');
        window.location.href = 'login.html';
      }
    }
    var err = new Error(data.message || 'فشلت العملية');
    err.code = data.code || 'API_ERROR';
    err.payload = data;
    throw err;
  }
  return data;
}

async function apiGet(action, params) {
  var url = new URL(scriptURL);
  url.searchParams.set('action', action);
  var token = getSessionToken();
  if (token) url.searchParams.set('token', token);
  Object.keys(params || {}).forEach(function (key) {
    if (params[key] != null) url.searchParams.set(key, params[key]);
  });
  return parseApiResponse(await fetch(url.toString(), { method: 'GET', cache: 'no-store' }));
}

async function apiPost(action, payload) {
  var formData = new FormData();
  formData.append('action', action);
  var token = getSessionToken();
  if (token) formData.append('token', token);
  Object.keys(payload || {}).forEach(function (key) {
    if (payload[key] != null) formData.append(key, payload[key]);
  });
  return parseApiResponse(await fetch(scriptURL, { method: 'POST', body: formData }));
}

function generateId(prefix) {
  var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
    (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2));
  return (prefix || '') + id;
}

function recordSignature(record) {
  return [
    record.reportDate, record.treatmentUnit, record.driverName, record.carNumber,
    record.facilityMainType, record.healthAdmin,
    record.subFacilityName || record.facilityName, record.visitType,
    String(record.wasteWeight == null ? '' : record.wasteWeight), record.weightUnit
  ].map(function (v) { return String(v == null ? '' : v).trim(); }).join('|');
}

// Cloud is the source of truth. Only local-only/pending records are preserved when absent from cloud.
function mergeCloudWithLocal(cloudRecords, localRecords) {
  cloudRecords = Array.isArray(cloudRecords) ? cloudRecords : [];
  localRecords = Array.isArray(localRecords) ? localRecords : [];

  var merged = cloudRecords.map(function (r) {
    var copy = Object.assign({}, r);
    delete copy._syncStatus;
    return copy;
  });
  var ids = new Set();
  var signatures = new Set();
  merged.forEach(function (r) {
    if (r.recordId) ids.add(String(r.recordId));
    signatures.add(recordSignature(r));
  });

  localRecords.forEach(function (r) {
    var id = r.recordId ? String(r.recordId) : '';
    if (id && ids.has(id)) return;
    var sig = recordSignature(r);
    if (!id && signatures.has(sig)) return;
    if (r._syncStatus === 'pending' || !id) {
      merged.push(r);
      if (id) ids.add(id);
      signatures.add(sig);
    }
  });
  return merged;
}

function markRecordsSynced(recordIds) {
  var wanted = new Set((recordIds || []).map(String));
  var records = JSON.parse(localStorage.getItem('dakahlia_waste_records') || '[]');
  records.forEach(function (r) {
    if (r.recordId && wanted.has(String(r.recordId))) delete r._syncStatus;
  });
  localStorage.setItem('dakahlia_waste_records', JSON.stringify(records));
  return records;
}

async function performLogout() {
  try { await apiPost('logout', {}); } catch (_) {}
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}
