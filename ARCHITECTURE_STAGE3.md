# MedWaste DK — Architecture Stage 3

## Goal
Stage 3 modularizes the Google Apps Script backend while preserving the public API used by the Stage 2 frontend.

No frontend behavior or API action names were intentionally changed in this stage.

## Backend structure

```text
Code.gs       -> Google Apps Script entry points: doGet, doPost, setupSystem
Config.gs     -> Sheet names, headers, session lifetime, settings keys
Router.gs     -> Maps public HTTP actions to backend use cases
Auth.gs       -> Register, login, logout, password recovery, current user
Users.gs      -> User listing and role management
Records.gs    -> Record retrieval, batch insert, trip deletion
Settings.gs   -> Read/write application settings
Sheets.gs     -> Spreadsheet access, schema creation and legacy migrations
Sessions.gs   -> Session creation, validation, authorization and cleanup
Security.gs   -> Password hashing/verification and temporary passwords
Utils.gs      -> JSON response, normalization and generic helpers
```

## Request flow

```text
Frontend
   ↓
Google Apps Script Web App
   ↓
Code.gs
   ↓
Router.gs
   ↓
Feature service
(Auth / Users / Records / Settings)
   ↓
Infrastructure
(Sheets / Sessions / Security / Utils)
   ↓
Google Sheets / MailApp
```

## Public API compatibility

### POST
- register
- login
- logout
- forgot_password
- update_role
- save_settings
- add_record
- add_records_batch
- delete_trip

### GET
- get_records
- get_settings
- get_users
- get_me
- health

The Stage 2 frontend actions are all present in the Stage 3 router.

## Design rules established

1. `Code.gs` contains entry points only.
2. HTTP action dispatch belongs only to `Router.gs`.
3. Feature/business logic belongs in its feature file.
4. Direct `SpreadsheetApp` access is centralized in `Sheets.gs`.
5. Password digest logic is centralized in `Security.gs`.
6. Session authorization is centralized in `Sessions.gs`.
7. Shared normalization/response helpers are centralized in `Utils.gs`.
8. Unknown actions return an explicit `UNKNOWN_ACTION` error.
9. Existing migration behavior and spreadsheet schemas are preserved.

## Adding a future backend feature

For example, an Inventory feature should normally be added as:

```text
Inventory.gs
```

Then add only its public action(s) to `Router.gs`. It should reuse existing infrastructure modules rather than duplicating authentication, spreadsheet helpers, or response logic.

## Stage boundary

Stage 3 intentionally does not redesign the data model or replace Google Sheets. It modularizes the stable backend created in the earlier repair phase so that future feature development can happen without returning to a monolithic `Code.gs`.
