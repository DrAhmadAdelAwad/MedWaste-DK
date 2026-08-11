# MedWaste DK — Stage 8 Security Architecture

**Application:** 8.0  
**API Contract:** 1.3  
**Stage:** Security Hardening + RBAC + Audit Trail

## 1. Objective

Stage 8 hardens the Stage 7 production foundation without changing the medical-waste data schema or the core trip workflow.

The security model is now:

```text
Browser
  ↓
Session token kept in sessionStorage
  ↓
Protected API reads/writes via POST body
  ↓
Central Action Authorization
  ↓
Feature Use Case
  ↓
Repository / Mapper
  ↓
Google Sheets
           ↘
            Security Audit Trail
```

## 2. Central RBAC Matrix

Authorization is defined once in `Contracts.gs` / `assets/js/core/contracts.js`.

| Action | Data Entry | Supervisor | Admin |
|---|---:|---:|---:|
| Add records | ✓ | ✓ | ✓ |
| Read central settings | ✓ | ✓ | ✓ |
| Read trip records/reports | ✗ | ✓ | ✓ |
| Delete trip | ✗ | ✗ | ✓ |
| Save settings | ✗ | ✗ | ✓ |
| View users | ✗ | ✗ | ✓ |
| Change roles | ✗ | ✗ | ✓ |
| View audit trail | ✗ | ✗ | ✓ |

Public actions are limited to registration, login, password recovery and health.

The backend is authoritative. Frontend hiding/redirects are only usability controls.

## 3. Session Hardening

Stage 8 changes the session lifecycle:

- Raw session tokens are returned to the browser only at login.
- The browser keeps the raw token in `sessionStorage`, not `localStorage`.
- Existing Stage 7 persisted tokens are migrated once when loaded.
- Google Sheets stores only `tok$<SHA-256>` lookup hashes.
- `setupSystem()` proactively migrates existing plaintext session rows to hashes.
- Absolute session life remains 7 days.
- A session expires after 12 hours of inactivity.
- Maximum active sessions per user: 5.
- Role changes invalidate all sessions for the affected user.
- Password reset invalidates previous sessions.

## 4. Protected Transport

Only `health` is intended to use GET.

All authenticated reads now use POST:

- `get_records`
- `get_settings`
- `get_users`
- `get_me`
- `get_audit_log`

This prevents session tokens from being placed in query strings, browser history, referrer data or URL-oriented logs.

## 5. Login / Recovery Abuse Controls

Cache-backed throttling is implemented in `RateLimit.gs`:

- Login: 5 failed attempts / 15 minutes per normalized email.
- Password recovery: 3 requests / hour per normalized email.
- Rate-limit responses use `RATE_LIMITED` and include a retry hint.
- Password recovery uses a generic response for unknown accounts to reduce account enumeration.

## 6. Audit Trail

A hidden sheet is created:

```text
_سجل_التدقيق
```

It stores security/administrative events such as:

- user registration;
- login success/failure/rate limiting;
- logout;
- password reset outcomes;
- denied access;
- user-list access;
- role changes;
- settings changes;
- record batch additions;
- trip deletions.

The audit record includes:

- audit ID;
- timestamp;
- request ID;
- API action/event/result;
- actor email/name/role when known;
- target type/ID;
- safe metadata.

It explicitly does **not** persist passwords, raw session tokens, settings payloads, record payloads or medical record contents.

Audit metadata and structured logs are independently redacted.

Retention controls:

- maximum rows: 20,000;
- target retention: 365 days;
- oldest rows are removed first.

## 7. Admin Audit UI

`admin_audit.html` provides an admin-only paginated view of the audit trail.

Pagination defaults:

- 100 events/page;
- maximum 500 events/page.

## 8. Google Sheets Schema Impact

The following existing schemas are unchanged from Stage 7:

- `DATA_HEADERS` — unchanged (14 columns)
- `USER_HEADERS` — unchanged (8 columns)
- `SETTINGS_HEADERS` — unchanged (3 columns)
- `SESSION_HEADERS` — unchanged (4 columns)
- `IDEMPOTENCY_HEADERS` — unchanged (7 columns)

Stage 8 adds only the hidden audit infrastructure sheet `_سجل_التدقيق`.

## 9. Security Boundaries

- `AccessControl.gs` owns authorization rules.
- `RateLimit.gs` owns abuse throttling.
- `Security.gs` owns password/token cryptographic helpers.
- `SessionRepository.gs` owns session persistence.
- `Audit.gs` owns audit sanitization/event construction.
- `AuditRepository.gs` owns audit persistence.
- `Logging.gs` owns operational log redaction.
- Feature use cases do not directly access sheet rows.

## 10. Compatibility Note

Stage 8 changes protected reads from GET to POST and bumps the API contract from 1.2 to 1.3.

Deploy Stage 8 frontend and backend in the same release window. A Stage 7 frontend connected to a Stage 8 backend will receive `METHOD_NOT_ALLOWED` for protected GET requests by design.
