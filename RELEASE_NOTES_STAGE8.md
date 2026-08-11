# MedWaste DK 8.0 — Release Notes

Stage 8 focuses on authorization, session security and traceability.

## Added
- Central backend/frontend RBAC action matrix.
- `AccessControl.gs`.
- `RateLimit.gs`.
- `Audit.gs`.
- `AuditRepository.gs`.
- Hidden `_سجل_التدقيق` sheet.
- Admin audit page `admin_audit.html`.
- Audit frontend repository.
- Login and password-recovery throttling.
- 12-hour idle session expiry.
- Five-session-per-user cap.
- Automatic invalidation of sessions after role changes.
- Generic unknown-account password-reset response.
- Contract errors `RATE_LIMITED` and `METHOD_NOT_ALLOWED`.
- Audit pagination limits.

## Changed
- App version 7.0 → 8.0.
- API contract 1.2 → 1.3.
- Protected reads use POST instead of GET.
- Browser token moves from persistent user data to `sessionStorage`.
- Session sheet stores only token hashes.
- Existing plaintext session rows are migrated by `setupSystem()`.
- New registrations require at least 8 password characters.
- Operational and audit metadata redaction is stricter.

## Unchanged
- Medical-waste data columns.
- User table columns.
- Settings table columns.
- Session table column count.
- Idempotency table columns.
- Trip save/sync/delete domain behavior.
