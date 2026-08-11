# MedWaste DK — Stage 6 Test Report

## Automated result

```text
Passed: 20
Failed: 0
```

Run with:

```bash
npm test
```

## Coverage

- Frontend JavaScript syntax
- Backend Apps Script syntax
- HTML local dependency integrity
- Core script dependency order
- Domain/data script dependency order
- Frontend architecture boundaries
- Backend architecture boundaries
- Frontend/backend API contract parity
- Sensitive logger metadata redaction
- Validators and requestId propagation
- API correlation/client metadata
- Trip save regression: cloud success
- Trip save regression: offline pending
- Trip save regression: permanent validation rollback
- Domain/data boundary: no Api/Storage in feature/page/domain layers
- Backend use-case boundary: no row operations in use cases
- Record domain normalization/signature
- Cloud/local records repository merge and duplicate prevention
- Backend record/user mapper column integrity
- Diagnostics token safety
- Backend safe self-tests
- Health response metadata/version

## Important regression guarantees

The Stage 5 behavior remains intact:

```text
Cloud save                 PASS
Offline -> pending         PASS
Permanent error rollback   PASS
Duplicate cloud/local merge PASS
requestId correlation      PASS
```

## Data compatibility

Google Sheets data headers are unchanged from Stage 5.
API contract remains `1.1`.
No Stage 6 data migration is required.

## Backend self-tests

`runSelfTests()` now also checks the pure record and user row mappers without reading or writing Google Sheets.
