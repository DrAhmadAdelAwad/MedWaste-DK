/**
 * Security audit service.
 * Never records passwords, session tokens, medical record contents, or raw request payloads.
 */

function sanitizeAuditMetadata_(value, depth) {
  depth = depth || 0;
  if (depth > 4) return '[TRUNCATED]';
  if (value == null) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 25).map(function (item) { return sanitizeAuditMetadata_(item, depth + 1); });
  }

  if (typeof value === 'object') {
    var out = {};
    for (var key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (/(password|token|secret|authorization|credential|recordData|recordsData|settingsData)/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = sanitizeAuditMetadata_(value[key], depth + 1);
      }
    }
    return out;
  }

  var text = typeof value === 'string' ? value : value;
  if (typeof text === 'string' && text.length > 500) return text.substring(0, 500) + '…';
  return text;
}

function auditMetadataJson_(metadata) {
  var safe = sanitizeAuditMetadata_(metadata || {}, 0);
  var text = JSON.stringify(safe);
  if (text.length > AUDIT_METADATA_MAX_LENGTH) {
    text = JSON.stringify({truncated: true, summary: text.substring(0, AUDIT_METADATA_MAX_LENGTH - 80)});
  }
  return text;
}

function auditActor_(auth, explicit) {
  var user = auth && auth.user ? auth.user : null;
  explicit = explicit || {};
  return {
    email: normalizeEmail_(explicit.email || (user && user.email) || ''),
    name: clean_(explicit.name || (user && user.fullName) || ''),
    role: clean_(explicit.role || (user && user.role) || '')
  };
}

function safeAuditEvent_(options) {
  options = options || {};
  try {
    var params = options.params || {};
    var actor = auditActor_(options.auth, options.actor);
    return auditRepositoryAppend_({
      auditId: Utilities.getUuid(),
      timestamp: new Date(),
      requestId: normalizeRequestId_(params.requestId),
      action: clean_(options.action || params.action),
      event: clean_(options.event),
      result: clean_(options.result || 'SUCCESS'),
      actorEmail: actor.email,
      actorName: actor.name,
      actorRole: actor.role,
      targetType: clean_(options.targetType),
      targetId: clean_(options.targetId),
      metadataJson: auditMetadataJson_(options.metadata)
    });
  } catch (err) {
    logEvent_('ERROR', 'audit_write_failed', {
      action: clean_(options.action || (options.params && options.params.action)),
      event: clean_(options.event),
      error: errorSummary_(err)
    });
    return false;
  }
}

function getAuditLog_(p) {
  var auth = requireActionAuth_(p, API_ACTIONS.GET_AUDIT_LOG);
  if (!auth.ok) return auth.error;
  var result = auditRepositoryFindPage_(p.page, p.pageSize);
  return success_({data: result.items, pagination: result.pagination});
}
