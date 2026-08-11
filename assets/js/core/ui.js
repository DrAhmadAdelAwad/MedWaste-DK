(function (MW) {
  'use strict';

  const SYNC_CLASSES = Object.freeze({
    loading: 'fixed bottom-4 left-4 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg z-50 transition-opacity duration-300',
    success: 'fixed bottom-4 left-4 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg z-50 transition-opacity duration-300',
    error: 'fixed bottom-4 left-4 bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg z-50 transition-opacity duration-300'
  });

  function setSyncBadge(text, type = 'loading', hideAfterMs = 0) {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;

    badge.className = SYNC_CLASSES[type] || SYNC_CLASSES.loading;
    badge.innerText = text;
    badge.classList.remove('hidden');

    if (hideAfterMs > 0) {
      window.setTimeout(() => badge.classList.add('hidden'), hideAfterMs);
    }
  }

  function hideSyncBadge() {
    document.getElementById('syncBadge')?.classList.add('hidden');
  }

  function setStatus(element, text, type = 'success', hideAfterMs = 6000) {
    if (!element) return;
    element.innerText = text;
    element.className = `block text-center text-sm font-bold p-3 rounded-xl mt-4 ${
      type === 'success'
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-rose-50 text-rose-700 border border-rose-200'
    }`;
    if (hideAfterMs > 0) {
      window.setTimeout(() => element.classList.add('hidden'), hideAfterMs);
    }
  }

  MW.UI = Object.freeze({ setSyncBadge, hideSyncBadge, setStatus });
})(window.MedWaste);
