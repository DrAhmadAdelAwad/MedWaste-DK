# MedWaste DK — Architecture Stage 5

## Goal
Stage 5 makes the Stage 4 architecture easier to operate, diagnose, and change safely.

It adds:
- explicit runtime environment configuration
- structured frontend/backend logging
- request correlation IDs
- server/client version metadata
- non-sensitive diagnostics
- repeatable automated regression tests
- safe backend self-tests

No medical-waste business rules or Google Sheets columns are changed in Stage 5.

## Version baseline

```text
Application version: 5.0
API contract version: 1.1
Environment: production
```

Contract 1.1 is backward-compatible with 1.0. Existing action names and business payloads remain unchanged; response metadata was added for diagnostics.

## Frontend configuration

`assets/js/config/app-config.js` is now the single runtime profile file.

It owns:
- application version
- environment name
- Google Apps Script Web App URL
- request timeout
- frontend logging level

Current profiles:

```text
production  -> logLevel: warn
 development -> logLevel: debug
```

Both profiles intentionally use the current Web App URL until a separate development deployment is created.

## Request correlation

Every API request now receives a generated identifier such as:

```text
req-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The frontend sends it as `requestId` together with:
- `clientVersion`
- `contractVersion`
- `environment`

The backend returns diagnostic metadata on every response:

```json
{
  "requestId": "req-...",
  "serverTime": "...",
  "appVersion": "5.0",
  "contractVersion": "1.1",
  "environment": "production"
}
```

Business response fields remain unchanged.

## Structured logging

### Frontend

New file:

```text
assets/js/core/logger.js
```

It provides:
- debug
- info
- warn
- error
- global browser error handler
- unhandled promise rejection handler
- metadata redaction

Sensitive keys such as password, token, secret, and authorization are automatically redacted before logging.

Direct `console.*` calls outside the logger were removed.

### Backend

New file:

```text
Logging.gs
```

Backend request logs contain only operational metadata:
- requestId
- HTTP method
- action
- result/error code
- duration
- client/server contract versions
- app/environment version

Request payloads, passwords, tokens, and medical-waste record contents are not logged.

## Diagnostics API

New frontend module:

```text
assets/js/core/diagnostics.js
```

For troubleshooting from the browser console:

```js
MedWaste.Diagnostics.snapshot()
```

returns safe local runtime information.

```js
await MedWaste.Diagnostics.checkServer()
```

performs the health call and returns:
- latency
- requestId
- client version/environment
- server version/environment
- contract versions
- server time

It intentionally does not expose the session token.

## Health endpoint

The existing public `health` action remains unchanged but now exposes operational metadata.

Expected shape after deployment:

```json
{
  "result": "success",
  "message": "OK",
  "version": "5.0",
  "requestId": "...",
  "serverTime": "...",
  "appVersion": "5.0",
  "contractVersion": "1.1",
  "environment": "production"
}
```

## Automated test gate

New development files:

```text
package.json
tests/run-tests.js
```

Run before a release:

```bash
npm test
```

No third-party npm packages are required.

The suite checks:
- frontend syntax
- Apps Script syntax
- HTML dependency paths
- core dependency order
- architecture boundaries
- frontend/backend contract parity
- logger redaction
- validators/error correlation
- API correlation metadata
- trip regression behavior
- diagnostics token safety
- backend self-tests
- health response metadata

## Backend self-tests

New file:

```text
SelfTests.gs
```

Run manually from Apps Script:

```text
runSelfTests
```

These tests are designed not to read or write Google Sheets. They validate contracts, validators, request IDs, and response metadata.

## Architecture boundary after Stage 5

```text
Browser Page
    ↓
Feature / Page Controller
    ↓
Core API
    ↓
Request ID + Client Metadata
    ↓
Google Apps Script Entry Point
    ↓
Structured Request Context
    ↓
Router / Business Module
    ↓
Sheets Infrastructure
```

Errors can now be correlated across the browser and Apps Script execution logs using the same `requestId`.

## Stage boundary

Stage 5 does not:
- change Google Sheets schema
- add a new business feature
- change roles
- change public API action names
- replace Google Sheets
- add third-party runtime dependencies

It creates a quality and diagnostics gate for the next feature-development stages.
