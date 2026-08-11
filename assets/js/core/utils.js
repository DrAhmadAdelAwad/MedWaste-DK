(function (MW) {
  'use strict';

  function parseMaybeJson(value) {
    if (value == null || typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch (_) { return value; }
  }

  function generateId(prefix = '') {
    const rawId = window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}${rawId}`;
  }

  function toDateInputValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).trim();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function toArabicDateTime(value) {
    if (!value) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('ar-EG', { hour12: true });
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  MW.Utils = Object.freeze({
    parseMaybeJson,
    generateId,
    toDateInputValue,
    toArabicDateTime,
    clone,
    escapeHtml
  });
})(window.MedWaste);
