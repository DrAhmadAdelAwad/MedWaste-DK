# Stage 2 — Modular Frontend Architecture

## Goal
Stage 2 converts the separated JavaScript from Stage 1 into a layered, feature-oriented architecture while preserving the current application behavior and Google Apps Script contract.

## Layers

### Configuration
- `assets/js/config/app-config.js`
- Contains the Google Apps Script Web App URL only.

### Core
- `core/namespace.js` — creates the single `window.MedWaste` namespace.
- `core/storage.js` — the only layer allowed to access `localStorage` directly.
- `core/session.js` — current user/session token access.
- `core/utils.js` — IDs, date normalization, JSON parsing, escaping.
- `core/api.js` — the only layer that performs HTTP requests to Apps Script.
- `core/ui.js` — shared status/sync badge behavior.

### Features
- `features/auth/auth.service.js` — login, registration, password reset, logout.
- `features/records/records.service.js` — local records, cloud merge, normalization, sync state.
- `features/trips/trips.service.js` — trip creation, grouping, cloud save, pending sync, deletion.
- `features/trips/trip-form.js` — trip form UI and batch UI.
- `features/settings/settings.defaults.js` — default cars, drivers, treatment units, facilities and health administrations.
- `features/settings/settings.service.js` — settings state, local persistence and cloud synchronization.
- `features/settings/settings.manager.js` — settings manager modal and backup UI.

### Page Controllers
The files under `assets/js/pages/` are now page controllers. They orchestrate features and render page-specific UI instead of containing storage/API infrastructure.

## Dependency direction

`Page Controller -> Feature -> Core -> Google Apps Script`

Pages no longer call `fetch()` or `localStorage` directly.

## Compatibility decision
Native ES Modules were intentionally not introduced in this stage. The application may be opened from local files, and browsers commonly block `file://` ES-module imports because of CORS. Instead, all modules expose themselves through one controlled namespace: `window.MedWaste`.

This gives modular separation without changing the current hosting/deployment requirement.

## Cleanup completed
- No direct `localStorage` usage outside `core/storage.js`.
- No legacy global `apiGet/apiPost/getStoredUser/getSessionToken` helpers.
- No static or dynamically generated `onclick/onchange/onkeyup/oninput` handlers.
- Dynamic table actions use event delegation and `data-*` attributes.
- Removed duplicate HTML IDs found during refactoring.
- The report trip KPI now prefers `tripId` and falls back to the legacy composite key.

## Backend
`Code.gs` was intentionally not changed in Stage 2. The stable backend from the previous repair remains intact. Backend modularization should be a separate stage after the frontend architecture is stabilized.
