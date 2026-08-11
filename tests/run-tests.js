'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
let passed = 0;

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`PASS  ${name}`);
    })
    .catch(error => {
      failures.push({ name, error });
      console.error(`FAIL  ${name}: ${error.message}`);
    });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walk(dir, ext) {
  const out = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) out.push(...walk(full, ext));
    else if (!ext || full.endsWith(ext)) out.push(full);
  }
  return out;
}

function load(context, rel) {
  new vm.Script(read(rel), { filename: rel }).runInContext(context);
}

function frontendContext(fetchImpl) {
  const store = new Map();
  const sessionStore = new Map();
  class FakeFormData {
    constructor() { this.map = new Map(); }
    append(key, value) { this.map.set(String(key), String(value)); }
    get(key) { return this.map.get(String(key)); }
    entries() { return this.map.entries(); }
  }
  const win = {
    location: { pathname: '/index.html', href: '' },
    setTimeout,
    clearTimeout,
    addEventListener() {},
    crypto: { randomUUID: () => crypto.randomUUID() }
  };
  const context = vm.createContext({
    window: win,
    console,
    URL,
    FormData: FakeFormData,
    AbortController,
    setTimeout,
    clearTimeout,
    crypto: win.crypto,
    navigator: { onLine: true },
    alert() {},
    fetch: fetchImpl || (async () => { throw new Error('fetch not mocked'); }),
    localStorage: {
      getItem: key => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(String(key), String(value)),
      removeItem: key => store.delete(String(key))
    },
    sessionStorage: {
      getItem: key => sessionStore.has(String(key)) ? sessionStore.get(String(key)) : null,
      setItem: (key, value) => sessionStore.set(String(key), String(value)),
      removeItem: key => sessionStore.delete(String(key))
    }
  });
  win.window = win;
  context.globalThis = context;
  return context;
}

function loadFrontendCore(context) {
  [
    'assets/js/core/namespace.js',
    'assets/js/config/app-config.js',
    'assets/js/core/contracts.js',
    'assets/js/core/logger.js',
    'assets/js/core/storage.js',
    'assets/js/core/session.js',
    'assets/js/core/utils.js',
    'assets/js/core/errors.js',
    'assets/js/core/validators.js',
    'assets/js/core/api.js',
    'assets/js/domain/record.entity.js',
    'assets/js/domain/trip.entity.js',
    'assets/js/domain/user.entity.js',
    'assets/js/domain/settings.entity.js',
    'assets/js/data/mappers/record.mapper.js',
    'assets/js/data/mappers/user.mapper.js',
    'assets/js/data/mappers/settings.mapper.js',
    'assets/js/data/repositories/records.repository.js',
    'assets/js/data/repositories/auth.repository.js',
    'assets/js/data/repositories/settings.repository.js',
    'assets/js/data/repositories/users.repository.js',
    'assets/js/data/repositories/audit.repository.js',
    'assets/js/core/diagnostics.js'
  ].forEach(file => load(context, file));
}

function backendContext() {
  const outputFactory = text => ({
    text,
    setMimeType() { return this; }
  });
  return vm.createContext({
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    RegExp,
    isFinite,
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: outputFactory
    },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      formatDate: date => new Date(date).toISOString().slice(0, 10),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_alg, value) => Array.from(crypto.createHash('sha256').update(String(value), 'utf8').digest())
    },
    Session: { getScriptTimeZone: () => 'Africa/Cairo' }
  });
}

async function main() {
  await test('frontend JavaScript syntax', () => {
    for (const file of walk(path.join(ROOT, 'assets/js'), '.js')) {
      new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file });
    }
  });

  await test('backend Apps Script syntax', () => {
    const source = walk(ROOT, '.gs').sort().map(file => fs.readFileSync(file, 'utf8')).join('\n');
    new vm.Script(source, { filename: 'backend-all.gs' });
  });

  await test('HTML local dependency integrity', () => {
    for (const file of walk(ROOT, '.html')) {
      const html = fs.readFileSync(file, 'utf8');
      const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
      for (const ref of refs) {
        if (/^(https?:|data:|#)/i.test(ref)) continue;
        const clean = ref.split(/[?#]/)[0];
        assert(fs.existsSync(path.resolve(path.dirname(file), clean)), `${path.basename(file)} missing ${clean}`);
      }
      assert(!/\son(?:click|change|keyup|submit)=/i.test(html), `${path.basename(file)} contains inline event handler`);
    }
  });

  await test('HTML core dependency order', () => {
    for (const file of walk(ROOT, '.html')) {
      const html = fs.readFileSync(file, 'utf8');
      const positions = [
        'assets/js/core/namespace.js',
        'assets/js/config/app-config.js',
        'assets/js/core/contracts.js',
        'assets/js/core/logger.js',
        'assets/js/core/storage.js',
        'assets/js/core/session.js',
        'assets/js/core/utils.js',
        'assets/js/core/errors.js',
        'assets/js/core/validators.js',
        'assets/js/core/api.js',
        'assets/js/core/diagnostics.js'
      ].map(ref => html.indexOf(ref));
      assert(positions.every(pos => pos >= 0), `${path.basename(file)} missing a core dependency`);
      for (let i = 1; i < positions.length; i++) {
        assert(positions[i] > positions[i - 1], `${path.basename(file)} core dependency order is invalid`);
      }
    }
  });

  await test('HTML stage6 domain/data dependency order', () => {
    const ordered = [
      'assets/js/core/api.js',
      'assets/js/domain/record.entity.js',
      'assets/js/domain/trip.entity.js',
      'assets/js/domain/user.entity.js',
      'assets/js/domain/settings.entity.js',
      'assets/js/data/mappers/record.mapper.js',
      'assets/js/data/mappers/user.mapper.js',
      'assets/js/data/mappers/settings.mapper.js',
      'assets/js/data/repositories/records.repository.js',
      'assets/js/data/repositories/auth.repository.js',
      'assets/js/data/repositories/settings.repository.js',
      'assets/js/data/repositories/users.repository.js'
    ];
    for (const file of walk(ROOT, '.html')) {
      const html = fs.readFileSync(file, 'utf8');
      const positions = ordered.map(ref => html.indexOf(ref));
      assert(positions.every(pos => pos >= 0), `${path.basename(file)} missing Stage 6 dependency`);
      for (let i = 1; i < positions.length; i++) {
        assert(positions[i] > positions[i - 1], `${path.basename(file)} Stage 6 dependency order invalid`);
      }
    }
  });

  await test('frontend architecture boundaries', () => {
    const jsFiles = walk(path.join(ROOT, 'assets/js'), '.js');
    for (const file of jsFiles) {
      const src = fs.readFileSync(file, 'utf8');
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (rel !== 'assets/js/core/api.js') assert(!/\bfetch\s*\(/.test(src), `fetch outside api.js: ${rel}`);
      if (rel !== 'assets/js/core/storage.js') {
        assert(!/\blocalStorage\b/.test(src), `localStorage outside storage.js: ${rel}`);
        assert(!/\bsessionStorage\b/.test(src), `sessionStorage outside storage.js: ${rel}`);
      }
      if (rel !== 'assets/js/core/logger.js') assert(!/console\.(debug|info|warn|error|log)\s*\(/.test(src), `console outside logger.js: ${rel}`);
    }
  });

  await test('backend architecture boundaries', () => {
    const files = walk(ROOT, '.gs');
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      const src = fs.readFileSync(file, 'utf8');
      if (rel !== 'Sheets.gs') assert(!/\bSpreadsheetApp\b/.test(src), `SpreadsheetApp outside Sheets.gs: ${rel}`);
      if (rel !== 'Logging.gs') assert(!/console\.(debug|info|warn|error|log)\s*\(/.test(src), `console outside Logging.gs: ${rel}`);
      if (rel !== 'Concurrency.gs') assert(!/\bLockService\b/.test(src), `LockService outside Concurrency.gs: ${rel}`);
      if (rel !== 'Cache.gs') assert(!/\bCacheService\b/.test(src), `CacheService outside Cache.gs: ${rel}`);
    }
  });

  let frontContracts;
  let backContracts;
  await test('Stage 8.1 backend installation manifest is complete', () => {
    const ctx = backendContext();
    const files = [
      'Config.gs', 'Contracts.gs', 'Utils.gs', 'Logging.gs', 'Concurrency.gs', 'Cache.gs',
      'Security.gs', 'RateLimit.gs', 'Validators.gs', 'AccessControl.gs', 'Audit.gs',
      'RecordMapper.gs', 'UserMapper.gs', 'Sheets.gs', 'RecordRepository.gs', 'UserRepository.gs',
      'SettingsRepository.gs', 'SessionRepository.gs', 'IdempotencyRepository.gs', 'AuditRepository.gs',
      'EntityRepository.gs', 'Entities.gs', 'Reconciliation.gs',
      'Sessions.gs', 'Auth.gs', 'Records.gs', 'Settings.gs', 'Users.gs', 'Idempotency.gs',
      'Router.gs', 'SelfTests.gs', 'Code.gs'
    ];
    files.forEach(file => load(ctx, file));
    const result = ctx.verifyBackendInstallation();
    assert(result.result === 'success', `backend manifest incomplete: ${JSON.stringify(result.missing)}`);
    assert(result.missing.length === 0, 'backend manifest reports missing symbols');
  });

  await test('frontend/backend contract parity', () => {
    const fctx = frontendContext();
    load(fctx, 'assets/js/core/namespace.js');
    load(fctx, 'assets/js/core/contracts.js');
    frontContracts = fctx.window.MedWaste.Contracts;

    const bctx = backendContext();
    load(bctx, 'Contracts.gs');
    backContracts = {
      version: bctx.API_CONTRACT_VERSION,
      actions: JSON.parse(JSON.stringify(bctx.API_ACTIONS)),
      roles: JSON.parse(JSON.stringify(bctx.ROLES)),
      actionRoles: JSON.parse(JSON.stringify(bctx.ACTION_ROLES)),
      errorCodes: JSON.parse(JSON.stringify(bctx.ERROR_CODES)),
      limits: JSON.parse(JSON.stringify(bctx.API_LIMITS))
    };

    assert(frontContracts.version === backContracts.version, 'contract version mismatch');
    assert(JSON.stringify(frontContracts.Actions) === JSON.stringify(backContracts.actions), 'action mismatch');
    assert(JSON.stringify(frontContracts.Roles) === JSON.stringify(backContracts.roles), 'role mismatch');
    assert(JSON.stringify(frontContracts.ActionRoles) === JSON.stringify(backContracts.actionRoles), 'authorization matrix mismatch');
    assert(JSON.stringify(frontContracts.ErrorCodes) === JSON.stringify(backContracts.errorCodes), 'error code mismatch');
    assert(JSON.stringify(frontContracts.Limits) === JSON.stringify(backContracts.limits), 'limit mismatch');
  });

  await test('logger redacts sensitive metadata', () => {
    const ctx = frontendContext();
    load(ctx, 'assets/js/core/namespace.js');
    load(ctx, 'assets/js/config/app-config.js');
    load(ctx, 'assets/js/core/logger.js');
    const clean = ctx.window.MedWaste.Logger.sanitize({ password: 'abc', token: 'xyz', nested: { secret: '1', okay: 2 } });
    assert(clean.password === '[REDACTED]', 'password not redacted');
    assert(clean.token === '[REDACTED]', 'token not redacted');
    assert(clean.nested.secret === '[REDACTED]', 'secret not redacted');
    assert(clean.nested.okay === 2, 'safe value changed');
  });

  await test('frontend validators and error requestId', () => {
    const ctx = frontendContext();
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    assert(MW.Validators.isEmail('user@example.com'), 'valid email rejected');
    assert(!MW.Validators.isEmail('bad-email'), 'invalid email accepted');
    const err = MW.Errors.fromApi({ result: 'error', code: 'VALIDATION', message: 'Bad', requestId: 'req-test' });
    assert(err.requestId === 'req-test', 'requestId not preserved in AppError');
  });

  await test('API adds correlation and client metadata', async () => {
    let capturedGet = null;
    let capturedPost = null;
    const ctx = frontendContext(async (url, options) => {
      if (options.method === 'GET') {
        capturedGet = new URL(url);
        const requestId = capturedGet.searchParams.get('requestId');
        return { ok: true, text: async () => JSON.stringify({
          result: 'success', message: 'OK', requestId,
          contractVersion: '1.8', version: '8.1.6', appVersion: '8.1.6', environment: 'production'
        }) };
      }
      capturedPost = options.body;
      const requestId = capturedPost.get('requestId');
      return { ok: true, text: async () => JSON.stringify({ result: 'success', requestId, contractVersion: '1.8', appVersion: '8.1.6' }) };
    });
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;

    const health = await MW.Api.get(MW.Contracts.Actions.HEALTH, { requestId: 'spoofed', clientVersion: '0.0', token: 'spoofed-token' });
    assert(/^req-/.test(capturedGet.searchParams.get('requestId')), 'GET requestId missing');
    assert(capturedGet.searchParams.get('requestId') !== 'spoofed', 'reserved GET requestId was overridden');
    assert(capturedGet.searchParams.get('clientVersion') === '8.1.9', 'GET clientVersion missing');
    assert(capturedGet.searchParams.get('contractVersion') === '1.10', 'GET contractVersion missing');
    assert(capturedGet.searchParams.get('token') === null, 'GET URL leaked a session token');
    assert(health.requestId === capturedGet.searchParams.get('requestId'), 'GET response requestId mismatch');

    await MW.Api.post(MW.Contracts.Actions.LOGIN, { email: 'user@example.com', password: 'secret123', requestId: 'spoofed', clientVersion: '0.0' });
    assert(/^req-/.test(capturedPost.get('requestId')), 'POST requestId missing');
    assert(capturedPost.get('requestId') !== 'spoofed', 'reserved POST requestId was overridden');
    assert(capturedPost.get('clientVersion') === '8.1.9', 'POST clientVersion missing');
    assert(capturedPost.get('contractVersion') === '1.10', 'POST contractVersion missing');
  });

  await test('Stage 8 protected reads use POST body and never URL tokens', async () => {
    let capturedUrl = '';
    let capturedBody = null;
    const ctx = frontendContext(async (url, options) => {
      capturedUrl = String(url);
      capturedBody = options.body;
      const requestId = capturedBody.get('requestId');
      return { ok: true, text: async () => JSON.stringify({
        result: 'success', requestId, contractVersion: '1.8', appVersion: '8.1.6', data: []
      }) };
    });
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    MW.Session.setUser({fullName:'Admin', email:'admin@example.com', role:MW.Contracts.Roles.ADMIN, sessionToken:'session-secret'});
    await MW.Api.read(MW.Contracts.Actions.GET_USERS);

    assert(capturedBody instanceof FormData || typeof capturedBody.get === 'function', 'protected read did not use form body');
    assert(capturedBody.get('token') === 'session-secret', 'protected read body missing token');
    assert(!capturedUrl.includes('session-secret'), 'protected read leaked token into URL');
  });

  await test('Stage 8 API retries transient safe mutations with the same requestId', async () => {
    let attempts = 0;
    const requestIds = [];
    const ctx = frontendContext(async (_url, options) => {
      attempts += 1;
      requestIds.push(options.body.get('requestId'));
      if (attempts < 3) throw new Error('temporary network failure');
      return {
        ok: true,
        text: async () => JSON.stringify({
          result: 'success',
          requestId: requestIds[0],
          contractVersion: '1.8',
          appVersion: '8.1.2'
        })
      };
    });
    loadFrontendCore(ctx);
    // Remove the actual backoff delay from the unit test without changing production code.
    ctx.window.setTimeout = fn => { fn(); return 1; };
    const MW = ctx.window.MedWaste;
    await MW.Api.post(MW.Contracts.Actions.DELETE_TRIP, { tripId: 'trip-1' });
    assert(attempts === 3, `expected 3 attempts, got ${attempts}`);
    assert(new Set(requestIds).size === 1, 'requestId changed across retries');
  });

  await test('Stage 8 unsafe auth POST is not automatically retried', async () => {
    let attempts = 0;
    const ctx = frontendContext(async () => {
      attempts += 1;
      throw new Error('temporary network failure');
    });
    loadFrontendCore(ctx);
    let failed = false;
    try {
      await ctx.window.MedWaste.Api.post(ctx.window.MedWaste.Contracts.Actions.LOGIN, { email: 'user@example.com', password: 'secret' });
    } catch (_) { failed = true; }
    assert(failed, 'login failure was swallowed');
    assert(attempts === 1, `login retried unexpectedly (${attempts})`);
  });


  await test('Stage 8 API respects backend retryAfterMs hint for BUSY', async () => {
    let attempts = 0;
    const delays = [];
    const ctx = frontendContext(async (_url, options) => {
      attempts += 1;
      const requestId = options.body.get('requestId');
      if (attempts === 1) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            result: 'error', code: 'BUSY', message: 'busy', requestId,
            contractVersion: '1.8', appVersion: '8.1.6', details: { retryAfterMs: 1800 }
          })
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ result: 'success', requestId, contractVersion: '1.8', appVersion: '8.1.6' })
      };
    });
    loadFrontendCore(ctx);
    ctx.window.setTimeout = (fn, ms) => { delays.push(ms); fn(); return 1; };
    await ctx.window.MedWaste.Api.post(ctx.window.MedWaste.Contracts.Actions.DELETE_TRIP, { tripId: 'trip-busy' });
    assert(attempts === 2, `expected 2 attempts, got ${attempts}`);
    assert(delays.length >= 1 && delays[0] >= 1800, `retryAfterMs hint was ignored: ${JSON.stringify(delays)}`);
  });

  await test('trip save regression paths', async () => {
    function makeTripContext(apiPost) {
      const ctx = frontendContext();
      [
        'assets/js/core/namespace.js','assets/js/config/app-config.js','assets/js/core/contracts.js',
        'assets/js/core/logger.js','assets/js/core/utils.js','assets/js/core/errors.js','assets/js/core/validators.js'
      ].forEach(file => load(ctx, file));
      load(ctx, 'assets/js/domain/record.entity.js');
      load(ctx, 'assets/js/domain/trip.entity.js');
      const MW = ctx.window.MedWaste;
      const state = { local: [], marked: [], removed: [], sources: [] };
      MW.Session = {
        getUser: () => ({ fullName: 'Tester', role: MW.Contracts.Roles.FACILITY_ENTRY, entityId: 'FAC-1', entityName: 'منشأة' }),
        getToken: () => 'token'
      };
      MW.RecordsRepository = {
        appendLocal(source, records) { state.sources.push(source); state.local.push(...records); },
        async saveBatch(source, records) { return apiPost(source, records); },
        markSynced(source, ids) { state.marked.push(...ids); state.local.forEach(r => { if (ids.includes(r.recordId)) delete r._syncStatus; }); },
        removeByIds(source, ids) { state.removed.push(...ids); state.local = state.local.filter(r => !ids.includes(r.recordId)); return state.local; },
        getLocal() { return state.local; },
        async deleteTripCloud() { return { result: 'success' }; },
        removeTripLocal() { return state.local; }
      };
      load(ctx, 'assets/js/features/trips/trips.service.js');
      return { ctx, MW, state };
    }

    const route = { reportDate: '2026-08-11', driverName: 'سائق', carNumber: '123', tripReference: 'MW-20260811-TEST' };
    const batch = [{ facilityId:'FAC-1', facilityMainType: 'منشأت حكومية', subFacilityName: 'منشأة', visitType: 'نقل نفايات', wasteWeight: 5, weightUnit: 'كجم' }];

    let x = makeTripContext(async () => ({ result: 'success' }));
    let result = await x.MW.Trips.save(route, batch);
    assert(result.cloudSaved === true, 'cloud success not reported');
    assert(result.source === x.MW.Contracts.EntrySources.FACILITY, 'facility source was not selected from role');
    assert(x.state.local.length === 1 && !x.state.local[0]._syncStatus, 'cloud success did not mark local record synced');

    x = makeTripContext(async () => { throw new x.MW.Errors.AppError('offline', x.MW.Contracts.ErrorCodes.NETWORK_ERROR); });
    result = await x.MW.Trips.save(route, batch);
    assert(result.cloudSaved === false, 'offline save incorrectly marked cloud success');
    assert(x.state.local.length === 1 && x.state.local[0]._syncStatus === 'pending', 'offline save did not remain pending');

    x = makeTripContext(async () => { throw new x.MW.Errors.AppError('bad data', x.MW.Contracts.ErrorCodes.VALIDATION); });
    let rejected = false;
    try { await x.MW.Trips.save(route, batch); } catch (_) { rejected = true; }
    assert(rejected, 'permanent validation error was swallowed');
    assert(x.state.local.length === 0 && x.state.removed.length === 1, 'permanent validation error did not roll back local record');
  });

  await test('stage6 frontend domain/data boundaries', () => {
    const restrictedDirs = ['assets/js/domain', 'assets/js/features', 'assets/js/pages'];
    for (const dir of restrictedDirs) {
      for (const file of walk(path.join(ROOT, dir), '.js')) {
        const src = fs.readFileSync(file, 'utf8');
        const rel = path.relative(ROOT, file).replace(/\\/g, '/');
        assert(!/\bApi\./.test(src), `Api dependency leaked outside repositories: ${rel}`);
        assert(!/\bStorage\./.test(src), `Storage dependency leaked outside repositories: ${rel}`);
      }
    }
  });

  await test('stage6 backend use cases do not touch sheet rows', () => {
    const useCases = ['Auth.gs', 'Records.gs', 'Users.gs', 'Settings.gs', 'Sessions.gs'];
    const forbidden = /\b(getDataRange|getRange|appendRow|deleteRow|clearContents|setValues|setValue)\s*\(/;
    for (const rel of useCases) {
      assert(!forbidden.test(read(rel)), `${rel} contains persistence operations`);
    }
  });

  await test('record domain and mapper keep canonical identity', () => {
    const ctx = frontendContext();
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    const raw = {
      recordId: ' rec-1 ', tripId: ' trip-1 ', reportDate: '2026-08-11', treatmentUnit: ' وحدة ',
      driverName: ' سائق ', carNumber: ' 123 ', facilityMainType: 'حكومي', healthAdmin: 'أ',
      subFacilityName: 'وحدة صحية', visitType: 'نقل نفايات', wasteWeight: '5.5', weightUnit: 'كجم'
    };
    const normalized = MW.RecordEntity.normalize(raw);
    assert(normalized.recordId === 'rec-1', 'recordId not normalized');
    assert(normalized.tripId === 'trip-1', 'tripId not normalized');
    assert(normalized.wasteWeight === 5.5, 'weight not canonical number');
    assert(MW.RecordEntity.signature(raw) === MW.RecordEntity.signature(normalized), 'signature changed after normalization');
    const api = MW.RecordMapper.toApi(Object.assign({}, normalized, { _syncStatus: 'pending' }));
    assert(!('_syncStatus' in api), 'local sync metadata leaked to API');
  });

  await test('records repository merges cloud with pending local without duplicates', async () => {
    const ctx = frontendContext(async (_url, options) => {
      const body = options.body;
      const requestId = body.get('requestId');
      return { ok: true, text: async () => JSON.stringify({
        result: 'success', requestId, contractVersion: '1.8', appVersion:'8.1.2', data: [{
          recordId: 'rec-cloud', tripId: 'trip-cloud', reportDate: '2026-08-11',
          driverName: 'D', carNumber: 'C', facilityMainType: 'G', subFacilityName: 'F', facilityId:'FAC-1',
          visitType: 'V', wasteWeight: 1, weightUnit: 'kg', tripReference:'MW-1', entrySource:'facility'
        }]
      }) };
    });
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    const source = MW.Contracts.EntrySources.FACILITY;
    MW.RecordsRepository.saveLocal(source, [
      { recordId: 'rec-cloud', tripId: 'trip-cloud', reportDate: '2026-08-11', driverName: 'D', carNumber: 'C', facilityMainType: 'G', subFacilityName: 'F', facilityId:'FAC-1', visitType: 'V', wasteWeight: 1, weightUnit: 'kg', tripReference:'MW-1', entrySource:source },
      { recordId: 'rec-pending', tripId: 'trip-pending', reportDate: '2026-08-12', driverName: 'D2', carNumber: 'C2', facilityMainType: 'G', subFacilityName: 'F2', facilityId:'FAC-2', visitType: 'V', wasteWeight: 2, weightUnit: 'kg', tripReference:'MW-2', entrySource:source, _syncStatus: 'pending' }
    ]);
    const merged = await MW.RecordsRepository.fetchMerged(source);
    assert(merged.length === 2, `expected 2 merged records, got ${merged.length}`);
    assert(merged.filter(r => r.recordId === 'rec-cloud').length === 1, 'cloud duplicate was retained');
    assert(merged.some(r => r.recordId === 'rec-pending' && r._syncStatus === 'pending'), 'pending local record was lost');
  });

  await test('Stage 8 records repository follows paginated protected POST responses', async () => {
    const requestedPages = [];
    const ctx = frontendContext(async (_url, options) => {
      const body = options.body;
      const requestId = body.get('requestId');
      const page = Number(body.get('page'));
      requestedPages.push(page);
      const hasMore = page < 2;
      return {
        ok: true,
        text: async () => JSON.stringify({
          result: 'success', requestId, contractVersion: '1.8', appVersion: '8.1.6',
          data: [{
            recordId: `rec-${page}`, tripId: `trip-${page}`, reportDate: '2026-08-11',
            treatmentUnit: 'U', driverName: 'D', carNumber: 'C', facilityMainType: 'G',
            subFacilityName: `F${page}`, visitType: 'V', wasteWeight: page, weightUnit: 'kg'
          }],
          pagination: {page, pageSize: 500, totalPages: 2, hasMore}
        })
      };
    });
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    MW.Session.setUser({fullName:'Supervisor', email:'sup@example.com', role:MW.Contracts.Roles.SUPERVISOR, sessionToken:'token'});
    const records = await MW.RecordsRepository.fetchCloudPaged();
    assert(records.length === 2, `expected 2 paged records, got ${records.length}`);
    assert(JSON.stringify(requestedPages) === JSON.stringify([1, 2]), `unexpected pages ${JSON.stringify(requestedPages)}`);
  });

  await test('Stage 8 contracts expose BUSY and pagination limits', () => {
    const ctx = frontendContext();
    load(ctx, 'assets/js/core/namespace.js');
    load(ctx, 'assets/js/core/contracts.js');
    const c = ctx.window.MedWaste.Contracts;
    assert(c.ErrorCodes.BUSY === 'BUSY', 'BUSY error code missing');
    assert(c.Limits.RECORDS_PAGE_SIZE_DEFAULT === 500, 'default page size mismatch');
    assert(c.Limits.RECORDS_PAGE_SIZE_MAX === 1000, 'max page size mismatch');
  });

  await test('backend row mappers preserve sheet schema positions', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'RecordMapper.gs', 'UserMapper.gs'].forEach(file => load(ctx, file));
    const record = ctx.recordFromRow_(['2026-08-11T10:00:00Z','2026-08-11','U','D','C','G','A','F','V',3,'kg','Tester','rec-1','trip-1','FAC-1','TRT-1','MW-1','treatment']);
    assert(record.recordId === 'rec-1' && record.tripId === 'trip-1', 'record mapper IDs wrong');
    assert(record.facilityId === 'FAC-1' && record.treatmentUnitId === 'TRT-1', 'record mapper entity IDs wrong');
    assert(record.tripReference === 'MW-1' && record.entrySource === 'treatment', 'record mapper dual-entry fields wrong');
    const row = ctx.recordToRow_(record, 'Tester');
    assert(row.length === ctx.RECORD_HEADERS.length && row.length === 18, 'record mapper changed sheet column count');
    const user = ctx.userFromRow_(['', 'Name', 'Job', 'Place', '010', 'user@example.com', 'hash', 'مدخل وحدة المعالجة','treatment_unit','TRT-1','Unit']);
    assert(user.email === 'user@example.com' && user.role === 'مدخل وحدة المعالجة', 'user mapper positions wrong');
    assert(user.entityId === 'TRT-1' && user.entityType === 'treatment_unit', 'user assignment mapper positions wrong');
  });

  await test('diagnostics snapshot contains no session token', () => {
    const ctx = frontendContext();
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    MW.Session.setUser({ fullName: 'Test', email: 'test@example.com', role: 'مدير', sessionToken: 'very-secret-token' });
    const snap = MW.Diagnostics.snapshot();
    assert(snap.loggedIn === true, 'login status missing');
    assert(!JSON.stringify(snap).includes('very-secret-token'), 'diagnostics leaked token');
  });

  await test('Stage 8 backend idempotency replays completed mutation without repeating side effect', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Logging.gs'].forEach(file => load(ctx, file));
    const store = new Map();
    let nextRow = 2;
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.idempotencyRepositoryCount_ = () => store.size;
    ctx.idempotencyRepositoryCleanupExpired_ = () => 0;
    ctx.idempotencyRepositoryFind_ = key => store.get(key) || null;
    ctx.idempotencyRepositoryCreate_ = entry => {
      store.set(entry.key, {
        rowNumber: nextRow++, key: entry.key, requestId: entry.requestId, action: entry.action,
        status: 'PROCESSING', responseJson: '', createdAt: entry.createdAt, expiresAt: entry.expiresAt
      });
    };
    ctx.idempotencyRepositoryResetProcessing_ = (rowNumber, createdAt, expiresAt) => {
      for (const item of store.values()) if (item.rowNumber === rowNumber) {
        item.status = 'PROCESSING'; item.responseJson = ''; item.createdAt = createdAt; item.expiresAt = expiresAt;
      }
    };
    ctx.idempotencyRepositoryComplete_ = (rowNumber, response) => {
      for (const item of store.values()) if (item.rowNumber === rowNumber) {
        item.status = 'COMPLETED'; item.responseJson = JSON.stringify(response);
      }
    };
    ctx.idempotencyRepositoryDelete_ = rowNumber => {
      for (const [key, item] of store.entries()) if (item.rowNumber === rowNumber) store.delete(key);
    };
    load(ctx, 'Idempotency.gs');

    let sideEffects = 0;
    const params = { requestId: 'req-same-1' };
    const first = ctx.executeIdempotentMutation_(ctx.API_ACTIONS.DELETE_TRIP, params, () => {
      sideEffects += 1;
      return ctx.success_({deleted: 3});
    });
    const second = ctx.executeIdempotentMutation_(ctx.API_ACTIONS.DELETE_TRIP, params, () => {
      sideEffects += 1;
      return ctx.success_({deleted: 99});
    });
    assert(first.deleted === 3, 'first idempotent result wrong');
    assert(second.deleted === 3 && second.idempotentReplay === true, 'completed response was not replayed');
    assert(sideEffects === 1, `side effect executed ${sideEffects} times`);
  });

  await test('Stage 8 concurrency helper returns BUSY when lock is unavailable', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs'].forEach(file => load(ctx, file));
    ctx.LockService = {
      getScriptLock: () => ({ tryLock: () => false, releaseLock() {} })
    };
    load(ctx, 'Concurrency.gs');
    const result = ctx.withScriptLock_('test_lock', () => ctx.success_());
    assert(result.result === 'error', 'busy lock did not return error');
    assert(result.code === 'BUSY', `unexpected busy code ${result.code}`);
  });


  await test('Stage 8 settings replacement writes before clearing stale tail rows', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs'].forEach(file => load(ctx, file));
    const operations = [];
    const fakeSheet = {
      getRange(row, col, numRows, numCols) {
        return {
          setValues(values) { operations.push({ type: 'setValues', row, col, numRows, numCols, values }); return this; },
          clearContent() { operations.push({ type: 'clearContent', row, col, numRows, numCols }); return this; }
        };
      },
      getLastRow() { return 10; },
      getLastColumn() { return 3; }
    };
    ctx.getSpreadsheet_ = () => ({});
    ctx.ensureSettingsSheet_ = () => fakeSheet;
    ctx.cachePutJson_ = () => {};
    ctx.cacheGetJson_ = () => null;
    ctx.defaultSettingValue_ = key => key === 'healthAdmins' ? {} : [];
    load(ctx, 'SettingsRepository.gs');
    ctx.settingsRepositoryWrite_({});
    assert(operations.length >= 1, 'settings repository performed no write');
    assert(operations[0].type === 'setValues', `first settings operation was ${operations[0].type}`);
    const clearIndex = operations.findIndex(item => item.type === 'clearContent');
    assert(clearIndex === -1 || clearIndex > 0, 'stale settings were cleared before replacement write');
  });

  await test('Stage 8 password reset restores previous credential when email delivery fails', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Validators.gs'].forEach(file => load(ctx, file));
    const updates = [];
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.consumeRateLimit_ = () => null;
    ctx.safeAuditEvent_ = () => true;
    ctx.userRepositoryFindByEmail_ = () => ({
      rowNumber: 2,
      row: ['', 'Tester', '', '', '', 'user@example.com', 'old-password-hash', 'مدير'],
      user: { fullName: 'Tester' }
    });
    ctx.makeTemporaryPassword_ = () => 'TempPass123';
    ctx.hashPassword_ = value => `hash:${value}`;
    ctx.userRepositoryUpdatePassword_ = (_row, value) => { updates.push(value); };
    ctx.invalidateSessionsForEmail_ = () => { throw new Error('should not run when mail fails'); };
    ctx.logEvent_ = () => {};
    ctx.errorSummary_ = err => String(err && (err.message || err));
    ctx.MailApp = { sendEmail() { throw new Error('mail unavailable'); } };
    load(ctx, 'Auth.gs');
    const result = ctx.forgotPassword_({ email: 'user@example.com' });
    assert(result.result === 'error' && result.code === 'MAIL_ERROR', 'mail failure did not return MAIL_ERROR');
    assert(updates.length === 2, `expected temp write + rollback, got ${updates.length}`);
    assert(updates[0] === 'hash:TempPass123', 'temporary password was not persisted before email');
    assert(updates[1] === 'old-password-hash', 'previous credential was not restored after mail failure');
  });


  await test('Stage 8 browser session keeps raw token out of localStorage', () => {
    const ctx = frontendContext();
    loadFrontendCore(ctx);
    const MW = ctx.window.MedWaste;
    MW.Session.setUser({
      fullName: 'Admin',
      email: 'admin@example.com',
      role: MW.Contracts.Roles.ADMIN,
      sessionToken: 'raw-browser-token'
    });
    const persisted = ctx.localStorage.getItem(MW.Storage.KEYS.currentUser) || '';
    assert(!persisted.includes('raw-browser-token'), 'raw token persisted in localStorage');
    assert(ctx.sessionStorage.getItem(MW.Storage.KEYS.sessionToken) === 'raw-browser-token', 'token missing from sessionStorage');
    assert(MW.Session.getToken() === 'raw-browser-token', 'Session.getToken failed');
  });

  await test('Stage 8 backend stores only token hash for new sessions', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Security.gs'].forEach(file => load(ctx, file));
    load(ctx, 'SessionRepository.gs');
    let appended = null;
    ctx.sessionRepositorySheet_ = () => ({
      appendRow(row) { appended = row; },
      getLastRow() { return 1; }
    });
    ctx.sessionRepositoryTrimForEmail_ = () => 0;
    const raw = ctx.sessionRepositoryCreate_('user@example.com', new Date(Date.now() + 10000));
    assert(Boolean(raw), 'raw session token not returned');
    assert(appended && String(appended[0]).startsWith('tok$'), 'stored session value is not hashed');
    assert(appended[0] !== raw && !String(appended[0]).includes(raw), 'raw token stored at rest');
  });

  await test('Stage 8 login rate limiter blocks at configured threshold', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Security.gs'].forEach(file => load(ctx, file));
    const cache = new Map();
    ctx.cacheGetJson_ = key => cache.get(key) || null;
    ctx.cachePutJson_ = (key, value) => cache.set(key, JSON.parse(JSON.stringify(value)));
    ctx.cacheRemove_ = key => cache.delete(key);
    load(ctx, 'RateLimit.gs');

    for (let i = 0; i < ctx.LOGIN_MAX_FAILURES; i++) {
      const pre = ctx.rateLimitCheck_('login', 'user@example.com', ctx.LOGIN_MAX_FAILURES, ctx.LOGIN_RATE_WINDOW_SECONDS);
      assert(pre === null, `rate limited too early at attempt ${i + 1}`);
      ctx.rateLimitRecord_('login', 'user@example.com', ctx.LOGIN_RATE_WINDOW_SECONDS);
    }
    const blocked = ctx.rateLimitCheck_('login', 'user@example.com', ctx.LOGIN_MAX_FAILURES, ctx.LOGIN_RATE_WINDOW_SECONDS);
    assert(blocked && blocked.code === 'RATE_LIMITED', 'rate limiter did not block threshold');
    assert(Number(blocked.details?.retryAfterMs) > 0, 'rate limiter missing retry hint');
  });

  await test('Stage 8.1 access update invalidates target user sessions', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs'].forEach(file => load(ctx, file));
    let updated = null;
    let invalidatedEmail = '';
    ctx.requireActionAuth_ = () => ({ok: true, user: {email:'admin@example.com', fullName:'Admin', role:'مدير'}});
    ctx.validateRoleUpdateInput_ = () => null;
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.userRepositoryFindByEmail_ = () => ({rowNumber:2, user:{role:'مشرف',entityId:'',entityType:''}});
    ctx.userRepositoryCountAdmins_ = () => 2;
    ctx.userRepositoryUpdateAccess_ = (row, role, entityType, entityId, entityName) => { updated = {row,role,entityType,entityId,entityName}; };
    ctx.invalidateSessionsForEmail_ = email => { invalidatedEmail = email; };
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Users.gs');
    const result = ctx.updateRole_({targetEmail:'user@example.com', newRole:'مدير'});
    assert(result.result === 'success' && result.changed === true, 'access update did not succeed');
    assert(updated && updated.role === 'مدير' && updated.entityId === '', 'access assignment was not updated');
    assert(invalidatedEmail === 'user@example.com', 'target sessions were not invalidated');
  });

  await test('Stage 8 unknown password-reset account returns generic success', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Security.gs', 'Validators.gs'].forEach(file => load(ctx, file));
    ctx.consumeRateLimit_ = () => null;
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.userRepositoryFindByEmail_ = () => null;
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Auth.gs');
    const result = ctx.forgotPassword_({email:'unknown@example.com'});
    assert(result.result === 'success', 'unknown reset account leaks error');
    assert(/إذا كان البريد مسجلاً/.test(result.message || ''), 'password reset response is not generic');
  });

  await test('Stage 8 audit trail redacts sensitive metadata before persistence', () => {
    const ctx = backendContext();
    ['Config.gs', 'Contracts.gs', 'Utils.gs', 'Logging.gs'].forEach(file => load(ctx, file));
    let captured = null;
    ctx.auditRepositoryAppend_ = entry => { captured = entry; return true; };
    load(ctx, 'Audit.gs');
    ctx.safeAuditEvent_({
      params: {requestId:'req-audit', action:'login'},
      action: 'login',
      event: 'TEST',
      result: 'SUCCESS',
      metadata: {password:'secret-password', sessionToken:'secret-token', okay:2}
    });
    assert(captured, 'audit event was not persisted');
    assert(!captured.metadataJson.includes('secret-password'), 'password leaked to audit sheet');
    assert(!captured.metadataJson.includes('secret-token'), 'token leaked to audit sheet');
    assert(captured.metadataJson.includes('[REDACTED]'), 'redaction marker missing');
  });



  await test('Stage 8.1 new non-first registration is forced to facility-entry role', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs','Security.gs'].forEach(file => load(ctx, file));
    ctx.validateRegistrationInput_ = () => null;
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.userRepositoryFindByEmail_ = () => null;
    ctx.userRepositoryIsEmpty_ = () => false;
    ctx.entityRepositoryFindById_ = () => ({entity:{entityId:'FAC-1',entityType:'facility',name:'Facility',active:true}});
    let appended = null;
    ctx.userRepositoryAppend_ = input => { appended = input; };
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Auth.gs');
    const result = ctx.register_({fullName:'User',email:'user@example.com',password:'12345678',facilityId:'FAC-1',role:'مدير'});
    assert(result.result === 'success', 'registration failed');
    assert(appended && appended.role === 'مدخل منشأة', 'client-supplied role bypassed default facility-entry role');
    assert(appended.entityId === 'FAC-1' && appended.entityType === 'facility', 'registered facility assignment was not persisted');
  });

  await test('Stage 8.1 admin assigns treatment-entry user to exactly one treatment unit', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    ctx.requireActionAuth_ = () => ({ok:true,user:{email:'admin@example.com',role:'مدير',fullName:'Admin'}});
    ctx.validateRoleUpdateInput_ = () => null;
    ctx.withScriptLock_ = (_name, fn) => fn();
    ctx.userRepositoryFindByEmail_ = () => ({rowNumber:2,user:{role:'مدخل منشأة',entityId:'FAC-OLD',entityType:'facility'}});
    ctx.userRepositoryCountAdmins_ = () => 2;
    ctx.entityRepositoryFindById_ = id => ({entity:{entityId:id,entityType:'treatment_unit',name:'Treatment A',active:true}});
    let saved = null;
    ctx.userRepositoryUpdateAccess_ = (row,role,entityType,entityId,entityName) => { saved={row,role,entityType,entityId,entityName}; };
    ctx.invalidateSessionsForEmail_ = () => {};
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Users.gs');
    const result = ctx.updateRole_({targetEmail:'user@example.com',newRole:'مدخل وحدة المعالجة',entityId:'TRT-A'});
    assert(result.result === 'success', 'treatment access update failed');
    assert(saved && saved.role === 'مدخل وحدة المعالجة' && saved.entityType === 'treatment_unit' && saved.entityId === 'TRT-A', 'treatment-unit assignment was not persisted exactly');
  });

  await test('Stage 8.1 UI exposes dual-entry workflow without treatment-unit selector', () => {
    const indexHtml = read('index.html');
    const registerHtml = read('register.html');
    const viewHtml = read('view.html');
    const reportsHtml = read('reports.html');
    assert(!/id="treatmentUnit"/.test(indexHtml), 'manual treatment-unit selector still exists in intake form');
    assert(!/id="tripReference"/.test(indexHtml), 'manual trip reference input still exists');
    const tripFormJs = fs.readFileSync(path.join(ROOT, 'assets/js/features/trips/trip-form.js'), 'utf8');
    assert(!/currentReference\s*\(/.test(tripFormJs), 'manual reference reader still exists in intake form');
    assert(/id="facilityId"/.test(registerHtml), 'facility assignment missing from registration');
    assert(/data-source="facility"/.test(viewHtml) && /data-source="treatment"/.test(viewHtml), 'view source switch missing');
    assert(/data-source="facility"/.test(reportsHtml) && /data-source="treatment"/.test(reportsHtml), 'reports source switch missing');
    const reconciliationHtml = read('reconciliation.html');
    const claimHtml = read('facility_report.html');
    assert(fs.existsSync(path.join(ROOT, 'reconciliation.html')), 'reconciliation page missing');
    assert(/id="healthAdmin"/.test(reconciliationHtml) && /id="facilityId"/.test(reconciliationHtml), 'reconciliation cascading facility selectors missing');
    assert(!/id="treatmentUnitSelect"/.test(reconciliationHtml), 'reconciliation page exposes a treatment-unit selector');
    assert(!/id="claimScope"/.test(claimHtml) && !/id="treatmentUnitSelect"/.test(claimHtml), 'treatment-unit claim controls still exist');
    assert(/tab-treatment/.test(indexHtml), 'treatment-unit settings tab missing');
  });

  await test('Stage 8.1.2 reconciliation uses the same complete cascading facility lists as intake', () => {
    const js = read('assets/js/pages/reconciliation.js');
    assert(js.includes('settings.healthAdmins') && js.includes('settings.govFacilities') && js.includes('settings.privateFacilities') && js.includes('settings.privateCompanies'), 'reconciliation is not sourcing the same facility lists as intake');
    assert(js.includes("mainType==='إدارات صحية'") && js.includes('healthAdmin'), 'health-administration cascade missing from reconciliation');
    assert(!js.includes('treatmentUnits') && !js.includes('treatmentUnitSelect'), 'reconciliation selector includes treatment units');
  });

  await test('Stage 8.1.2 reconciliation offers whole-administration or single-unit mode', () => {
    const html = read('reconciliation.html');
    const js = read('assets/js/pages/reconciliation.js');
    assert(/name="adminScope"[^>]*value="admin"/.test(html) && /name="adminScope"[^>]*value="unit"/.test(html), 'administration scope selector missing');
    assert(js.includes('Contracts.EntityTypes.HEALTH_ADMIN') && js.includes('isWholeAdminMode'), 'whole-administration comparison request missing');
    assert(js.includes("facilityBox.classList.add('hidden')"), 'unit selector is not hidden for whole-administration mode');
  });

  await test('Stage 8.1.2 claims UI supports administration aggregate and has no treatment-unit billing path', () => {
    const page = read('assets/js/pages/facility_report.js');
    const service = read('assets/js/features/claims/claims.service.js');
    assert(page.includes('authorizeHealthAdmin') && page.includes("mainType === 'إدارات صحية'"), 'aggregated health-administration claim path missing');
    assert(!page.includes('authorizeTreatmentUnit') && !service.includes('authorizeTreatmentUnit'), 'treatment-unit claim path still exists');
    assert(page.includes("r.healthAdmin !== selectedAdmin"), 'administration report does not aggregate records by parent administration');
  });

  await test('Stage 8.1.5 trip references are internal and generated automatically for both sources', () => {
    const service = read('assets/js/features/trips/trips.service.js');
    const form = read('assets/js/features/trips/trip-form.js');
    const html = read('index.html');
    assert(!html.includes('id="tripReference"') && !html.includes('مرجع الرحلة للمطابقة'), 'manual trip-reference input still exists');
    assert(!form.includes('currentReference()') && !form.includes('مرجع الرحلة الصادر من المنشأة مطلوب'), 'treatment form still requires a manual reference');
    assert(service.includes("makeReference(route.reportDate,source)"), 'automatic internal reference generation missing');
  });

  await test('Stage 8.1 backend forces facility identity from authenticated account', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs','Validators.gs'].forEach(file => load(ctx, file));
    ctx.entityRepositoryFindById_ = id => id === 'FAC-OWN' ? {entity:{entityId:'FAC-OWN',entityType:'facility',mainType:'منشأت حكومية',healthAdmin:'',name:'Own Facility',active:true}} : null;
    ctx.entityRepositoryResolveFacility_ = () => null;
    load(ctx, 'Records.gs');
    const auth = {user:{role:'مدخل منشأة',entityType:'facility',entityId:'FAC-OWN',fullName:'Facility User'}};
    const r = ctx.canonicalRecordForActor_({reportDate:'2026-08-12',facilityId:'FAC-HACK',subFacilityName:'Hacked',treatmentUnit:'Other',treatmentUnitId:'TRT-HACK'},auth,'facility',{});
    assert(r.facilityId === 'FAC-OWN' && r.subFacilityName === 'Own Facility', 'facility user could spoof another facility');
    assert(r.treatmentUnitId === '' && r.treatmentUnit === '', 'facility input retained a spoofed treatment unit');
    assert(/^MW-F-20260812-/.test(r.tripReference), 'facility-side internal reference was not generated');
  });

  await test('Stage 8.1.5 backend forces treatment unit and generates its internal reference', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs','Validators.gs'].forEach(file => load(ctx, file));
    ctx.entityRepositoryFindById_ = id => {
      if (id === 'TRT-OWN') return {entity:{entityId:'TRT-OWN',entityType:'treatment_unit',mainType:'وحدات معالجة',healthAdmin:'',name:'Own Unit',active:true}};
      if (id === 'FAC-1') return {entity:{entityId:'FAC-1',entityType:'facility',mainType:'منشأت حكومية',healthAdmin:'',name:'Facility',active:true}};
      return null;
    };
    ctx.entityRepositoryResolveFacility_ = () => null;
    load(ctx, 'Records.gs');
    const auth = {user:{role:'مدخل وحدة المعالجة',entityType:'treatment_unit',entityId:'TRT-OWN',fullName:'Treatment User'}};
    const r = ctx.canonicalRecordForActor_({reportDate:'2026-08-12',facilityId:'FAC-1',treatmentUnit:'Spoofed Unit',treatmentUnitId:'TRT-HACK',tripReference:''},auth,'treatment',{});
    assert(r.treatmentUnitId === 'TRT-OWN' && r.treatmentUnit === 'Own Unit', 'treatment user could spoof another treatment unit');
    const invalid = ctx.validateRecordInput_(Object.assign(r,{driverName:'D',carNumber:'C',visitType:'نقل نفايات',wasteWeight:5,weightUnit:'كجم'}),'treatment');
    assert(invalid === null, 'valid treatment entry was rejected');
    assert(/^MW-T-20260812-/.test(r.tripReference), 'treatment-side internal reference was not generated');
  });

  await test('Stage 8.1.8 full-admin UI uses stable generic reconciliation action', () => {
  const repo = read('assets/js/data/repositories/reconciliation.repository.js');
  assert(repo.includes("Contracts.Actions.GET_RECONCILIATION"));
  const fn = repo.match(/async function compareHealthAdmin\(filters\)\{([^}]|}[^;])*?\}/s);
  assert(repo.includes("entityType:Contracts.EntityTypes.HEALTH_ADMIN"));
  assert(repo.includes("adminScope:'admin'"));
});

test('Stage 8.1.6 dedicated full-admin reconciliation action is explicit and authorized', () => {
    const backendContracts = fs.readFileSync(path.join(ROOT, 'Contracts.gs'), 'utf8');
    const router = fs.readFileSync(path.join(ROOT, 'Router.gs'), 'utf8');
    const frontendContracts = fs.readFileSync(path.join(ROOT, 'assets/js/core/contracts.js'), 'utf8');
    const repo = fs.readFileSync(path.join(ROOT, 'assets/js/data/repositories/reconciliation.repository.js'), 'utf8');
    const page = fs.readFileSync(path.join(ROOT, 'assets/js/pages/reconciliation.js'), 'utf8');
    assert(/GET_HEALTH_ADMIN_RECONCILIATION:\s*'get_health_admin_reconciliation'/.test(backendContracts), 'backend dedicated admin action missing');
    assert(/get_health_admin_reconciliation:\s*\[ROLES\.SUPERVISOR,\s*ROLES\.ADMIN\]/.test(backendContracts), 'admin reconciliation RBAC missing');
    assert(/case API_ACTIONS\.GET_HEALTH_ADMIN_RECONCILIATION:[\s\S]*getHealthAdminReconciliation_\(params\)/.test(router), 'router does not dispatch dedicated admin reconciliation');
    assert(/GET_HEALTH_ADMIN_RECONCILIATION:'get_health_admin_reconciliation'/.test(frontendContracts), 'frontend dedicated admin action missing');
    assert(/compareHealthAdmin/.test(repo), 'reconciliation repository lacks dedicated admin request');
    assert(/wholeAdmin\?Reconciliation\.compareHealthAdmin\(filters\):Reconciliation\.compare\(filters\)/.test(page), 'admin mode still uses generic facility reconciliation request');
  });

  await test('Stage 8.1.5 reconciliation auto-matches different internal references by facility, day and weight', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    load(ctx, 'Reconciliation.gs');
    const result = ctx.buildReconciliationFromRecords_(
      [{recordId:'F1',facilityId:'FAC-1',reportDate:'2026-08-12',tripReference:'MW-F-X',visitType:'نقل نفايات',wasteWeight:10,weightUnit:'كجم'}, {recordId:'F2',facilityId:'FAC-1',reportDate:'2026-08-12',tripReference:'MW-F-Y',visitType:'نقل نفايات',wasteWeight:5,weightUnit:'كجم'}],
      [{recordId:'T1',facilityId:'FAC-1',reportDate:'2026-08-12',tripReference:'MW-T-A',visitType:'نقل نفايات',wasteWeight:5,weightUnit:'كجم'}, {recordId:'T2',facilityId:'FAC-1',reportDate:'2026-08-12',tripReference:'MW-T-B',visitType:'نقل نفايات',wasteWeight:10,weightUnit:'كجم'}]
    );
    assert(result.summary.matched === true && result.days[0].tripMatches.every(x => x.matched), 'automatic one-to-one matching failed');
  });

  await test('Stage 8.1.5 equal daily totals cannot hide different trip weights', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    load(ctx, 'Reconciliation.gs');
    const result = ctx.buildReconciliationFromRecords_(
      [{facilityId:'FAC-1',reportDate:'2026-08-12',visitType:'نقل نفايات',wasteWeight:60,weightUnit:'كجم'}, {facilityId:'FAC-1',reportDate:'2026-08-12',visitType:'نقل نفايات',wasteWeight:40,weightUnit:'كجم'}],
      [{facilityId:'FAC-1',reportDate:'2026-08-12',visitType:'نقل نفايات',wasteWeight:50,weightUnit:'كجم'}, {facilityId:'FAC-1',reportDate:'2026-08-12',visitType:'نقل نفايات',wasteWeight:50,weightUnit:'كجم'}]
    );
    assert(result.summary.differenceKg === 0, 'fixture totals are not equal');
    assert(result.summary.matched === false && result.days[0].status === 'WEIGHT_MISMATCH', 'equal totals bypassed trip-level auto matching');
  });

  await test('Stage 8.1 claim authorization is blocked by reconciliation mismatch', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    ctx.requireActionAuth_ = () => ({ok:true,user:{role:'مدير',email:'admin@example.com',fullName:'Admin'}});
    ctx.safeAuditEvent_ = () => true;
    ctx.recordRepositoryFindScoped_ = () => [];
    ctx.entityRepositoryFindById_ = () => ({entity:{entityId:'FAC-1',entityType:'facility',mainType:'منشأت حكومية',active:true}});
    load(ctx, 'Reconciliation.gs');
    ctx.buildReconciliation_ = () => ({summary:{matched:false,unmatchedDays:1,differenceKg:3,treatmentWeightKg:10},days:[]});
    const result = ctx.authorizeClaim_({entityType:'facility',entityId:'FAC-1'});
    assert(result.result === 'error' && result.code === 'RECONCILIATION_REQUIRED', 'mismatched facility claim was authorized');
  });

  await test('Stage 8.1.2 treatment-unit claims are rejected by backend', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    ctx.requireActionAuth_ = () => ({ok:true,user:{role:'مدير',email:'admin@example.com',fullName:'Admin'}});
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Reconciliation.gs');
    const result = ctx.authorizeClaim_({entityType:'treatment_unit',entityId:'TRT-1'});
    assert(result.result === 'error' && result.code === 'VALIDATION', 'treatment-unit claim was not rejected');
    assert(/لا تُصدر مطالبات لوحدات المعالجة/.test(result.message), 'treatment-unit rejection message is unclear');
  });

  await test('Stage 8.1.2 reconciliation endpoint accepts a full health administration scope', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    load(ctx, 'Reconciliation.gs');
    ctx.requireActionAuth_ = () => ({ok:true,auth:{user:{role:'مشرف'}}});
    ctx.normalizeDate_ = v => String(v||'');
    ctx.isValidIsoDate_ = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v||''));
    ctx.knownHealthAdmin_ = name => name === 'إدارة أ';
    ctx.buildHealthAdminReconciliation_ = (name,start,end) => ({summary:{matched:true,facilitiesCount:2},days:[],marker:[name,start,end]});
    const out = ctx.getReconciliation_({entityType:'health_admin',entityId:'إدارة أ',startDate:'2026-08-01',endDate:'2026-08-31'});
    assert(out.result === 'success', 'full health-administration reconciliation was rejected');
    assert(out.data.scope.entityType === 'health_admin' && out.data.scope.entityId === 'إدارة أ', 'health-administration scope metadata missing');
    assert(out.data.marker[0] === 'إدارة أ', 'health administration was not passed to reconciliation builder');
  });

  await test('Stage 8.1.2 health-administration reconciliation includes every unit and remains strict per facility', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    load(ctx, 'Reconciliation.gs');
    ctx.recordsRevision_ = () => 'test-rev';
    ctx.sha256Hex_ = value => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    ctx.cacheGetJson_ = () => null;
    ctx.cachePutJson_ = () => {};
    ctx.recordRepositoryFindScoped_ = (source, filters) => {
      assert(filters.healthAdmin === 'إدارة أ', 'health administration filter was not passed to repository');
      if (source === 'facility') return [
        {facilityId:'FAC-1',facilityName:'وحدة 1',healthAdmin:'إدارة أ',reportDate:'2026-08-12',tripReference:'MW-1',visitType:'نقل نفايات',wasteWeight:8,weightUnit:'كجم'},
        {facilityId:'FAC-2',facilityName:'وحدة 2',healthAdmin:'إدارة أ',reportDate:'2026-08-12',tripReference:'MW-2',visitType:'نقل نفايات',wasteWeight:12,weightUnit:'كجم'}
      ];
      return [
        {facilityId:'FAC-1',facilityName:'وحدة 1',healthAdmin:'إدارة أ',reportDate:'2026-08-12',tripReference:'MW-1',visitType:'نقل نفايات',wasteWeight:8,weightUnit:'كجم'},
        {facilityId:'FAC-2',facilityName:'وحدة 2',healthAdmin:'إدارة أ',reportDate:'2026-08-12',tripReference:'MW-2',visitType:'نقل نفايات',wasteWeight:11,weightUnit:'كجم'}
      ];
    };
    const result = ctx.buildHealthAdminReconciliation_('إدارة أ','2026-08-12','2026-08-12');
    assert(result.summary.days === 2, 'health administration did not include both units');
    assert(result.summary.matched === false && result.summary.unmatchedDays === 1, 'one unit mismatch did not block aggregate administration reconciliation');
  });

  await test('Stage 8.1.2 health-administration units cannot be claimed individually', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    ctx.requireActionAuth_ = () => ({ok:true,user:{role:'مدير',email:'admin@example.com',fullName:'Admin'}});
    ctx.entityRepositoryFindById_ = () => ({entity:{entityId:'FAC-U1',entityType:'facility',mainType:'إدارات صحية',healthAdmin:'إدارة أ',active:true}});
    ctx.safeAuditEvent_ = () => true;
    load(ctx, 'Reconciliation.gs');
    const result = ctx.authorizeClaim_({entityType:'facility',entityId:'FAC-U1'});
    assert(result.result === 'error' && result.code === 'VALIDATION', 'health-administration unit was allowed an individual claim');
    assert(/الإدارة الصحية كاملة/.test(result.message), 'individual health-unit claim rejection message is unclear');
  });

  await test('Stage 8.1 entity rename preserves existing entity ID', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx, file));
    ctx.cacheRemove_ = () => {};
    ctx.cacheGetJson_ = () => null;
    ctx.cachePutJson_ = () => {};
    load(ctx, 'EntityRepository.gs');
    const operations = [];
    const current = [ctx.ENTITY_HEADERS, ['FAC-PERSIST','facility','منشأت حكومية','','Old Name',true,new Date(),new Date()]];
    const fakeSheet = {
      getDataRange(){ return {getValues(){ return current.map(row => row.slice()); }}; },
      getLastRow(){ return current.length; },
      getRange(row,col,numRows,numCols){ return {
        setValue(value){ operations.push({type:'setValue',row,col,value}); return this; },
        setValues(values){ operations.push({type:'setValues',row,col,numRows,numCols,values}); return this; }
      }; }
    };
    ctx.settingsRepositoryRead_ = () => ({healthAdmins:{},govFacilities:['New Name'],privateFacilities:[],privateCompanies:[],treatmentUnits:[]});
    ctx.entityRepositorySheet_ = () => fakeSheet;
    const result = ctx.entityRepositorySyncFromSettings_();
    assert(result.renamed === 1 && result.added === 0 && result.deactivated === 0, `rename was not recognized: ${JSON.stringify(result)}`);
    const renameWrite = operations.find(op => op.type === 'setValues' && op.row === 2 && op.col === 3);
    assert(renameWrite && renameWrite.values[0][2] === 'New Name', 'existing entity row was not renamed in place');
    assert(!operations.some(op => op.type === 'setValues' && op.col === 1), 'rename inserted a new entity row and therefore changed the ID');
  });

  await test('Stage 8.1.7 backend accepts own administration unit and rejects foreign unit', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs','Validators.gs'].forEach(file => load(ctx,file));
    ctx.entityRepositoryFindById_ = id => {
      if (id === 'ADM-A') return {entity:{entityId:'ADM-A',entityType:'health_admin',name:'إدارة أ',active:true}};
      if (id === 'FAC-A1') return {entity:{entityId:'FAC-A1',entityType:'facility',mainType:'إدارات صحية',healthAdmin:'إدارة أ',name:'وحدة أ1',active:true}};
      if (id === 'FAC-B1') return {entity:{entityId:'FAC-B1',entityType:'facility',mainType:'إدارات صحية',healthAdmin:'إدارة ب',name:'وحدة ب1',active:true}};
      return null;
    };
    ctx.entityRepositoryResolveFacility_ = () => null;
    load(ctx,'Records.gs');
    const auth={user:{role:'مدخل منشأة',entityType:'health_admin',entityId:'ADM-A',fullName:'Admin Entry'}};
    const own=ctx.canonicalRecordForActor_({reportDate:'2026-08-12',facilityId:'FAC-A1'},auth,'facility',{});
    assert(own.facilityId==='FAC-A1'&&own.healthAdmin==='إدارة أ','own administration unit was not canonicalized');
    let rejected=false;
    try{ctx.canonicalRecordForActor_({reportDate:'2026-08-12',facilityId:'FAC-B1'},auth,'facility',{});}catch(err){rejected=err&&err.code==='FORBIDDEN';}
    assert(rejected,'foreign administration unit was accepted');
  });

  await test('Stage 8.1.7 duplicate health-administration registration is rejected', () => {
    const ctx=backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file=>load(ctx,file));
    ctx.validateRegistrationInput_=()=>null;
    ctx.normalizeEmail_=v=>String(v||'').trim().toLowerCase();
    ctx.withScriptLock_=(_n,fn)=>fn();
    ctx.userRepositoryFindByEmail_=()=>null;
    ctx.userRepositoryIsEmpty_=()=>false;
    ctx.entityRepositoryFindById_=()=>({entity:{entityId:'ADM-A',entityType:'health_admin',name:'إدارة أ',active:true}});
    ctx.userRepositoryFindByAssignment_=()=>({user:{email:'old@example.com'}});
    ctx.safeAuditEvent_=()=>{};
    ctx.hashPassword_=v=>'hash:'+v;
    ctx.userRepositoryAppend_=()=>{throw new Error('should not append duplicate admin assignment');};
    load(ctx,'Auth.gs');
    const out=ctx.register_({fullName:'New',email:'new@example.com',password:'12345678',entityId:'ADM-A'});
    assert(out.result==='error'&&out.code==='ASSIGNMENT_CONFLICT','duplicate administration assignment was not rejected');
  });

  await test('Stage 8.1.7 registration offers whole health administrations instead of their units', () => {
    const registerJs = read('assets/js/pages/register.js');
    const entitiesGs = read('Entities.gs');
    assert(registerJs.includes("type==='إدارات صحية'?healthAdmins"), 'registration does not switch to health administration entities');
    assert(entitiesGs.includes("healthAdmins: entityRepositoryList_(ENTITY_TYPES.HEALTH_ADMIN"), 'registration endpoint does not expose health administrations');
    assert(entitiesGs.includes("x.mainType !== 'إدارات صحية'"), 'health-unit facilities are still independently registrable');
  });

  await test('Stage 8.1.7 one account per health administration is enforced server-side', () => {
    const users = read('Users.gs');
    const auth = read('Auth.gs');
    assert(users.includes('userRepositoryFindByAssignment_') && users.includes('ASSIGNMENT_CONFLICT'), 'admin assignment uniqueness is not enforced in user updates');
    assert(auth.includes('userRepositoryFindByAssignment_') && auth.includes('ASSIGNMENT_CONFLICT'), 'admin assignment uniqueness is not enforced during registration');
  });

  await test('Stage 8.1.7 administration account can select only its own units at intake', () => {
    const form = read('assets/js/features/trips/trip-form.js');
    const records = read('Records.gs');
    assert(form.includes('isHealthAdminEntry') && form.includes("getSettings().healthAdmins?.[assignedAdminName()]"), 'administration intake does not restrict the unit list to the assigned administration');
    assert(records.includes("fac.healthAdmin") && records.includes("adminFound.entity.name") && records.includes('FORBIDDEN'), 'backend does not independently enforce administration-unit ownership');
  });

  await test('Stage 8.1 backups keep facility and treatment local stores separate', () => {
    const src = read('assets/js/features/settings/settings.manager.js');
    assert(src.includes('dakahlia_facility_entry_records'), 'facility-entry backup key missing');
    assert(src.includes('dakahlia_treatment_entry_records'), 'treatment-entry backup key missing');
    assert(src.includes('Contracts.EntrySources.FACILITY') && src.includes('Contracts.EntrySources.TREATMENT'), 'backup restore is not source-aware');
  });

  await test('Stage 8.1.9 health administration can never fall through to facility validation', () => {
    const ctx = backendContext();
    ['Config.gs','Contracts.gs','Utils.gs'].forEach(file => load(ctx,file));
    ctx.settingsRepositoryRead_ = () => ({healthAdmins:{'إدارة أ':['وحدة 1']}});
    ctx.requireActionAuth_ = () => ({ok:true,user:{role:'مدير'}});
    ctx.recordsRevision_ = () => 1;
    ctx.cacheGetJson_ = () => null;
    ctx.cachePutJson_ = () => {};
    ctx.sha256Hex_ = () => 'a'.repeat(64);
    ctx.recordRepositoryFindScoped_ = () => [];
    load(ctx,'Reconciliation.gs');
    ctx.buildHealthAdminReconciliation_ = admin => ({summary:{matched:true,facilitiesCount:1},days:[],_admin:admin});
    const variants = [
      {entityType:'health_admin',entityId:'إدارة أ'},
      {entityType:'facility',entityId:'إدارة أ'},
      {healthAdmin:'إدارة أ'},
      {adminScope:'admin',healthAdmin:'إدارة أ'},
      {scopeType:'health_admin',entityId:'إدارة أ'},
      {compareMode:'health_admin',entityId:'إدارة أ'},
      {facilityMainType:'إدارات صحية',entityId:'إدارة أ'}
    ];
    for (const params of variants) {
      const out = ctx.getReconciliation_(params);
      assert(out.result === 'success', `administration scope fell through: ${JSON.stringify(params)} => ${JSON.stringify(out)}`);
      assert(out.data.scope.entityType === 'health_admin', 'administration scope metadata missing');
    }
  });

  await test('backend self-tests', () => {
    const ctx = backendContext();
    [
      'Config.gs', 'Contracts.gs', 'Utils.gs', 'Logging.gs', 'Cache.gs', 'Security.gs', 'Validators.gs',
      'AccessControl.gs', 'Audit.gs', 'RecordMapper.gs', 'UserMapper.gs',
      'EntityRepository.gs', 'Reconciliation.gs', 'Records.gs', 'Idempotency.gs', 'Router.gs', 'SelfTests.gs'
    ].forEach(file => load(ctx, file));
    const result = ctx.runSelfTests();
    assert(result.result === 'success', `backend self-tests failed: ${JSON.stringify(result.tests)}`);
    assert(result.failed === 0, 'backend self-test failures detected');
  });

  await test('doGet health attaches server diagnostics metadata', () => {
    const ctx = backendContext();
    [
      'Config.gs', 'Contracts.gs', 'Utils.gs', 'Validators.gs', 'Logging.gs', 'Router.gs', 'Code.gs'
    ].forEach(file => load(ctx, file));
    const output = ctx.doGet({ parameter: { action: 'health', requestId: 'req-health-test', clientVersion: '8.1.9', contractVersion: '1.10', environment: 'production' } });
    const data = JSON.parse(output.text);
    assert(data.result === 'success', 'health failed');
    assert(data.requestId === 'req-health-test', 'health requestId missing');
    assert(data.version === '8.1.9', 'health version mismatch');
    assert(data.appVersion === '8.1.9', 'response appVersion missing');
    assert(data.contractVersion === '1.10', 'health contract version mismatch');
    assert(data.environment === 'production', 'health environment missing');
    assert(Boolean(data.serverTime), 'health serverTime missing');
  });

  console.log('\n----------------------------------------');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
