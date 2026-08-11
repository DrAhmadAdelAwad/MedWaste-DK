(function (MW) {
  'use strict';

  const { Records, Trips, UI, Utils } = MW;
  const Logger = MW.Logger || { error() {} };
  let allRecords = [];
  let visibleTrips = [];

  function totalTripWeight(trip) {
    return trip.facilities.reduce((sum, facility) => {
      const weight = facility.visitType === 'زيارة فقط بدون نقل' ? 0 : Number.parseFloat(facility.wasteWeight || 0);
      return sum + (Number.isNaN(weight) ? 0 : weight);
    }, 0);
  }

  function renderTrips(records) {
    const tableBody = document.getElementById('tripsTableBody');
    const noDataMessage = document.getElementById('noDataMessage');
    const badge = document.getElementById('tripsCountBadge');
    if (!tableBody || !noDataMessage || !badge) return;

    visibleTrips = Trips.group(records);
    tableBody.innerHTML = '';
    badge.innerText = `إجمالي الرحلات: ${visibleTrips.length}`;
    noDataMessage.classList.toggle('hidden', visibleTrips.length > 0);

    visibleTrips.forEach((trip, index) => {
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-50 transition duration-150';
      row.innerHTML = `
        <td class="p-3 font-medium text-slate-800">${Utils.escapeHtml(trip.reportDate)}</td>
        <td class="p-3 text-slate-700">${Utils.escapeHtml(trip.treatmentUnit)}</td>
        <td class="p-3 text-slate-700">${Utils.escapeHtml(trip.driverName)}</td>
        <td class="p-3 text-slate-700 font-semibold">${Utils.escapeHtml(trip.carNumber)}</td>
        <td class="p-3 text-center"><span class="bg-teal-50 text-teal-700 font-bold px-2.5 py-1 rounded-lg text-xs border border-teal-200">${trip.facilities.length} منشأة</span></td>
        <td class="p-3 text-center font-bold text-emerald-700">${totalTripWeight(trip).toFixed(2)} كجم</td>
        <td class="p-3 text-center text-xs font-bold text-slate-500">${Utils.escapeHtml(trip.createdBy)}</td>
        <td class="p-3 text-center flex justify-center gap-2">
          <button type="button" data-trip-action="details" data-index="${index}" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-emerald-200">👁️ التفاصيل</button>
          <button type="button" data-trip-action="delete" data-trip-id="${Utils.escapeHtml(trip.tripId)}" class="delete-trip-btn bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-rose-200">🗑️ حذف</button>
        </td>`;
      tableBody.appendChild(row);
    });
  }

  function filterTrips() {
    const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const filtered = allRecords.filter(record =>
      (record.reportDate && String(record.reportDate).toLowerCase().includes(query)) ||
      (record.driverName && String(record.driverName).toLowerCase().includes(query)) ||
      (record.treatmentUnit && String(record.treatmentUnit).toLowerCase().includes(query)) ||
      (record.carNumber && String(record.carNumber).toLowerCase().includes(query))
    );
    renderTrips(filtered);
  }

  function showTripDetails(trip) {
    const modal = document.getElementById('detailsModal');
    const info = document.getElementById('modalTripInfo');
    const tableBody = document.getElementById('modalFacilitiesBody');
    if (!modal || !info || !tableBody) return;

    info.innerHTML = `
      📅 تاريخ البلاغ: <span class="text-slate-800 font-bold">${Utils.escapeHtml(trip.reportDate)}</span> |
      🏥 وحدة المعالجة: <span class="text-slate-800 font-bold">${Utils.escapeHtml(trip.treatmentUnit)}</span><br>
      👨‍✈️ السائق: <span class="text-slate-800 font-bold">${Utils.escapeHtml(trip.driverName)}</span> |
      🚚 السيارة: <span class="text-slate-800 font-bold">${Utils.escapeHtml(trip.carNumber)}</span>`;

    tableBody.innerHTML = '';
    trip.facilities.forEach(facility => {
      const row = document.createElement('tr');
      const weightDisplay = facility.visitType === 'زيارة فقط بدون نقل'
        ? '<span class="text-amber-600 font-semibold">زيارة فقط (بدون نقل)</span>'
        : `<span class="font-bold">${Utils.escapeHtml(facility.wasteWeight)} ${Utils.escapeHtml(facility.weightUnit)}</span>`;
      row.innerHTML = `
        <td class="p-2.5 font-medium text-slate-800">${Utils.escapeHtml(facility.subFacilityName || facility.facilityName)}</td>
        <td class="p-2.5 text-slate-600">${Utils.escapeHtml(facility.visitType)}</td>
        <td class="p-2.5 text-center">${weightDisplay}</td>`;
      tableBody.appendChild(row);
    });

    modal.classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('detailsModal')?.classList.add('hidden');
  }

  async function deleteTrip(tripId) {
    if (!confirm('هل أنت متأكد من حذف هذه الرحلة بالكامل وكافة المنشآت التابعة لها من النظام (السحابة)؟')) return;
    const badge = document.getElementById('tripsCountBadge');
    const originalText = badge?.innerText || '';
    if (badge) badge.innerText = 'جاري الحذف من السحابة... ⏳';

    try {
      allRecords = await Trips.deleteTrip(tripId);
      renderTrips(allRecords);
    } catch (error) {
      alert(error.message || 'حدث خطأ أثناء حذف الرحلة من Google Sheets. لم يتم حذف النسخة المحلية.');
      if (badge) badge.innerText = originalText;
    }
  }

  function clearLocalStorage() {
    if (!confirm('تحذير: سيتم مسح السجلات محلياً. السحابة لن تتأثر. هل أنت متأكد؟')) return;
    Records.clearLocal();
    allRecords = [];
    renderTrips(allRecords);
  }

  function bindEvents() {
    document.getElementById('searchInput')?.addEventListener('keyup', filterTrips);
    document.getElementById('clearLocalStorageButton')?.addEventListener('click', clearLocalStorage);
    document.getElementById('closeModalControl')?.addEventListener('click', closeModal);
    document.getElementById('closeModal2Control')?.addEventListener('click', closeModal);
    document.getElementById('tripsTableBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-trip-action]');
      if (!button) return;
      if (button.dataset.tripAction === 'details') {
        const trip = visibleTrips[Number(button.dataset.index)];
        if (trip) showTripDetails(trip);
      } else if (button.dataset.tripAction === 'delete') {
        deleteTrip(button.dataset.tripId);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    allRecords = Records.getLocal();
    renderTrips(allRecords);
    UI.setSyncBadge('جاري تحديث السجلات... ⏳', 'loading');
    try {
      allRecords = await Records.fetchMerged();
      renderTrips(allRecords);
      UI.setSyncBadge('✅ تم تحديث السجلات', 'success', 2000);
    } catch (error) {
      Logger.error('trip_history_load_failed', { error });
      UI.setSyncBadge('❌ تعذر الاتصال بالسحابة (عرض محلي)', 'error', 3000);
    }
  });
})(window.MedWaste);
