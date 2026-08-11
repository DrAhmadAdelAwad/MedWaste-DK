# MedWaste DK — Architecture Stage 4

## Goal
Stage 4 hardens the modular frontend/backend created in Stages 2–3 by introducing a stable API contract, centralized validation, normalized errors, and explicit retry behavior.

The public API action names and Google Sheets schema remain compatible with Stage 3.

## New frontend core

```text
assets/js/core/
├── contracts.js   -> API actions, roles, error codes, limits, contract version
├── errors.js      -> AppError, API/network error normalization, retry classification
└── validators.js  -> Login, registration, route, facility, batch, role, settings validation
```

Existing boundaries remain:

```text
fetch()       -> core/api.js only
localStorage  -> core/storage.js only
```

## New backend core

```text
Contracts.gs   -> API actions, roles, error codes, limits, contract version
Validators.gs  -> server-side validation for all externally supplied business data
Utils.gs       -> success_() / failure_() normalized response builders
```

## Contract

Frontend and backend now share the same logical contract:

```text
Contract version: 1.0
Application version: 4.0
```

### POST actions
- register
- login
- logout
- forgot_password
- update_role
- save_settings
- add_record
- add_records_batch
- delete_trip

### GET actions
- get_records
- get_settings
- get_users
- get_me
- health

The action strings are no longer repeated in feature files. They are referenced through `Contracts.Actions` on the frontend and `API_ACTIONS` on the backend.

## Validation boundary

Validation now exists at two levels:

```text
User input
   ↓
Frontend Validators
   ↓
Feature Service
   ↓
API
   ↓
Backend Validators  ← authoritative validation
   ↓
Business Logic
   ↓
Google Sheets
```

Frontend validation improves UX. Backend validation is authoritative and prevents malformed requests, old clients, or manual requests from writing invalid data to Sheets.

Validated domains include:
- Login email/password presence and email format
- Registration required fields, email format, password minimum length and field limits
- User role updates
- Trip route required fields
- Medical-waste facility/visit fields
- Positive waste weight and weight unit for waste-transfer visits
- Maximum batch size
- Settings object structure
- Settings payload size

## Error contract

Backend responses are now built centrally:

```js
success_({ data: ... })
failure_(ERROR_CODES.VALIDATION, '...')
```

No feature module manually constructs `{result: ...}` responses anymore.

Frontend converts failures into `AppError` with:
- `message`
- `code`
- `details`
- optional `cause`

Network failures, request timeout, invalid server responses, and API business errors are therefore distinguishable.

## Retry rules

Retryable failures include:
- network unavailable
- request timeout
- server error
- invalid/transient server response
- expired authentication session

Permanent validation/business failures are not treated as connectivity failures.

For a newly entered trip:
- A transient cloud failure leaves the records locally as `pending`.
- A permanent rejection rolls back the newly created local records and keeps the current form batch available so the user can correct it.

This prevents permanently invalid records from entering an endless sync loop.

## Duplicate-submit protection

The final trip-save button is disabled while the save operation is running. This prevents accidental duplicate trips caused by repeated clicks while Google Apps Script is still responding.

## Health endpoint

After deploying Stage 4:

```text
?action=health
```

returns the application and contract versions, for example:

```json
{
  "result": "success",
  "message": "OK",
  "version": "4.0",
  "contractVersion": "1.0"
}
```

## Stage boundary

Stage 4 does not replace Google Sheets, redesign the medical-waste data model, or add new business features. It establishes a reliable contract and quality boundary so future features can be added without duplicating validation, roles, actions, or error handling.
