# MedWaste DK — Architecture Stage 6

## Goal
Stage 6 introduces an explicit Domain Model and Data Access Layer so business logic no longer depends directly on browser storage, HTTP transport, or Google Sheets row positions.

The public API contract remains `1.1` and the Google Sheets schema remains unchanged.

## Version baseline

```text
Application version: 6.0
API contract version: 1.1
Environment: production
```

## Frontend flow

```text
Page / UI
   ↓
Feature Service
   ↓
Domain Entity
   ↓
Repository
   ↓
Mapper
   ↓
API / Local Storage
```

### Domain layer

```text
assets/js/domain/
├── record.entity.js
├── trip.entity.js
├── user.entity.js
└── settings.entity.js
```

Responsibilities:
- canonical record shape
- stable record signature
- trip creation and grouping
- user normalization
- settings normalization

Domain files do not call `fetch`, `Api`, `Storage`, or `localStorage`.

### Mapper layer

```text
assets/js/data/mappers/
├── record.mapper.js
├── user.mapper.js
└── settings.mapper.js
```

Mappers translate external/storage representations into domain objects and back.
Local-only `_syncStatus` is removed before records are sent to the API.

### Repository layer

```text
assets/js/data/repositories/
├── records.repository.js
├── auth.repository.js
├── settings.repository.js
└── users.repository.js
```

Repositories own data-source decisions:
- HTTP API calls
- LocalStorage access through `core/storage.js`
- cloud/local record merge
- pending settings payload
- backup compatibility mapping

Feature services and pages no longer call `Api` or `Storage` directly.

## Backend flow

```text
HTTP Entry Point
    ↓
Router
    ↓
Use Case
    ↓
Repository
    ↓
Mapper
    ↓
Sheets Infrastructure
    ↓
Google Sheets
```

### Backend mappers

```text
RecordMapper.gs
UserMapper.gs
```

They define the translation between domain objects and spreadsheet rows.
The record mapper preserves the existing 14-column schema, including:
- column M: recordId
- column N: tripId

### Backend repositories

```text
RecordRepository.gs
UserRepository.gs
SettingsRepository.gs
SessionRepository.gs
```

They own spreadsheet persistence for their domains.

The following use-case files no longer contain row-level spreadsheet operations:

```text
Auth.gs
Records.gs
Users.gs
Settings.gs
Sessions.gs
```

`Sheets.gs` remains responsible for spreadsheet acquisition, schema creation, and legacy migration.

## Stable external contract

Stage 6 does not change:
- API action names
- roles
- error codes
- API contract version
- Google Sheets columns
- existing record/trip identifiers
- local backup key format

This makes Stage 6 an architectural refactor rather than a data migration.

## Migration strategy

No new migration is required.
`setupSystem()` can still be run safely after uploading the new backend files, but it does not add Stage 6 columns or rewrite existing records.

## Why this matters

A future replacement of Google Sheets with another persistence technology can be implemented primarily inside repositories/mappers while preserving feature services and page behavior.

The same separation also makes domain rules testable without a browser or a real spreadsheet.
