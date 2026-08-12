(function (MW) {
  'use strict';

  const { Session, Contracts, AuditRepository } = MW;
  const currentUser = Session.getUser();

  if (!currentUser || !Session.getToken() || !Contracts.canRole(currentUser.role, Contracts.Actions.GET_AUDIT_LOG)) {
    alert('عفواً، هذه الصفحة مخصصة للمدير فقط.');
    window.location.href = 'home.html';
    return;
  }

  let currentPage = 1;
  const pageSize = Contracts.Limits.AUDIT_PAGE_SIZE_DEFAULT;

  function cell(text, className = 'p-3 text-xs text-slate-700 align-top') {
    const td = document.createElement('td');
    td.className = className;
    td.textContent = text == null ? '' : String(text);
    return td;
  }

  function formatTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value || '') : d.toLocaleString('ar-EG');
  }

  function safeMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') return '';
    try { return JSON.stringify(metadata); } catch (_) { return ''; }
  }

  async function loadAudit(page = currentPage) {
    const table = document.getElementById('auditTable');
    const count = document.getElementById('auditCount');
    const info = document.getElementById('auditPageInfo');
    const prev = document.getElementById('prevAuditPage');
    const next = document.getElementById('nextAuditPage');

    table.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">جاري التحميل...</td></tr>';

    try {
      const result = await AuditRepository.list(page, pageSize);
      const items = result.items;
      const pagination = result.pagination;
      currentPage = Number(pagination.page || 1);
      table.innerHTML = '';

      if (!items.length) {
        table.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-slate-500">لا توجد أحداث مسجلة بعد.</td></tr>';
      } else {
        items.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'hover:bg-slate-50';
          row.appendChild(cell(formatTime(item.timestamp)));
          row.appendChild(cell(item.event, 'p-3 text-xs font-bold text-slate-800 align-top'));
          row.appendChild(cell(item.result));
          row.appendChild(cell(`${item.actorName || '—'}\n${item.actorEmail || ''}\n${item.actorRole || ''}`, 'p-3 text-xs text-slate-700 whitespace-pre-line align-top'));
          row.appendChild(cell(item.action));
          row.appendChild(cell(`${item.targetType || ''}${item.targetId ? ': ' + item.targetId : ''}`));
          row.appendChild(cell(item.requestId, 'p-3 text-[11px] font-mono text-slate-500 align-top'));
          row.appendChild(cell(safeMetadata(item.metadata), 'p-3 text-[11px] text-slate-500 max-w-xs break-all align-top'));
          table.appendChild(row);
        });
      }

      count.textContent = `إجمالي الأحداث: ${Number(pagination.total || 0)}`;
      info.textContent = pagination.totalPages ? `صفحة ${currentPage} من ${pagination.totalPages}` : 'لا توجد صفحات';
      prev.disabled = currentPage <= 1;
      next.disabled = !pagination.hasMore;
    } catch (error) {
      table.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-rose-600">تعذر تحميل سجل التدقيق.</td></tr>';
      count.textContent = error.message || 'فشل التحميل';
    }
  }

  document.getElementById('refreshAuditButton')?.addEventListener('click', () => loadAudit(currentPage));
  document.getElementById('prevAuditPage')?.addEventListener('click', () => { if (currentPage > 1) loadAudit(currentPage - 1); });
  document.getElementById('nextAuditPage')?.addEventListener('click', () => loadAudit(currentPage + 1));
  document.addEventListener('DOMContentLoaded', () => loadAudit(1));
})(window.MedWaste);
