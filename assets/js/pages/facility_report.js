(function (MW) {
  'use strict';

  const { Records, SettingsService, UI, Contracts, EntitiesRepository, Claims, Utils } = MW;
  const Logger = MW.Logger || { warn() {}, error() {} };

  let allRecords = [];
  let sysAdmins = {};
  let filteredRecords = [];
  let facilityDirectory = [];

  function applySettings(settings) {
    sysAdmins = settings.healthAdmins || {};
  }

  function fillSelect(select, placeholder, items) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    (items || []).forEach(item => {
      const option = document.createElement('option');
      option.value = item.value;
      option.textContent = item.label;
      select.appendChild(option);
    });
  }

  function initHealthAdminDropdown() {
    fillSelect(
      document.getElementById('healthAdminSelect'),
      '-- اختر الإدارة الصحية --',
      Object.keys(sysAdmins).sort((a, b) => a.localeCompare(b, 'ar')).map(name => ({ value: name, label: name }))
    );
  }

  function isHealthAdministrationClaim() {
    return document.getElementById('facilityMainType')?.value === 'إدارات صحية';
  }

  function eligibleStandaloneFacilities(mainType) {
    return facilityDirectory.filter(item => {
      if (item.mainType === 'إدارات صحية') return false;
      if (mainType && item.mainType !== mainType) return false;
      return true;
    });
  }

  function populateSubFacilitiesDropdown() {
    const mainType = document.getElementById('facilityMainType')?.value || '';
    const subSelect = document.getElementById('subFacilitySelect');
    const subLabel = document.getElementById('subFacilityLabel');
    if (!subSelect || !subLabel) return;

    if (mainType === 'إدارات صحية') {
      subSelect.innerHTML = '<option value="">-- المطالبة تصدر للإدارة الصحية كاملة --</option>';
      subLabel.textContent = 'المنشأة';
      document.getElementById('facilitySelectBox')?.classList.add('hidden');
      return;
    }

    document.getElementById('facilitySelectBox')?.classList.remove('hidden');
    subLabel.textContent = mainType === 'منشأت حكومية'
      ? 'المستشفى / المنشأة الحكومية'
      : mainType === 'منشأت خاصة'
        ? 'المنشأة الخاصة'
        : mainType === 'شركات خاصة'
          ? 'الشركة الخاصة'
          : 'المنشأة';

    const list = eligibleStandaloneFacilities(mainType)
      .slice()
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'))
      .map(item => ({ value: item.entityId, label: `${item.name} [${item.entityId}]` }));
    fillSelect(subSelect, '-- اختر المنشأة --', list);
  }

  function refreshClaimModeUI() {
    const mainType = document.getElementById('facilityMainType')?.value || '';
    const adminBox = document.getElementById('adminFilterBox');
    const status = document.getElementById('claimMatchStatus');

    if (mainType === 'إدارات صحية') {
      adminBox?.classList.remove('hidden');
      document.getElementById('facilitySelectBox')?.classList.add('hidden');
      if (status) status.textContent = '⚖️ مطالبة الإدارة الصحية تكون مجمعة لكل وحداتها. سيتم السماح بالإصدار فقط إذا كانت كل الوحدات الداخلة في الفترة متطابقة رحلة برحلة.';
    } else {
      adminBox?.classList.add('hidden');
      const adminSelect = document.getElementById('healthAdminSelect');
      if (adminSelect) adminSelect.value = '';
      document.getElementById('facilitySelectBox')?.classList.remove('hidden');
      if (status) status.textContent = '⚖️ المستشفيات والمنشآت المستقلة تُطالب منفردة. اختر منشأة واحدة وسيتم التحقق من المطابقة الكاملة قبل الإصدار.';
    }
    populateSubFacilitiesDropdown();
  }

  function handleMainTypeFilterChange() {
    refreshClaimModeUI();
    generateFacilityReport();
  }

  function resetFilters() {
    document.getElementById('facilityMainType').value = '';
    document.getElementById('healthAdminSelect').value = '';
    document.getElementById('subFacilitySelect').value = '';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    refreshClaimModeUI();
    generateFacilityReport();
  }

  function calculateFinancials(record) {
    let w = record.visitType === 'زيارة فقط بدون نقل' ? 0 : parseFloat(record.wasteWeight || 0);
    w = Number.isFinite(w) ? w : 0;

    let transRate = 0;
    let treatRate = 0;
    if (record.facilityMainType === 'منشأت خاصة') {
      transRate = 9;
      treatRate = 26;
    } else if (record.facilityMainType === 'شركات خاصة') {
      transRate = 0;
      treatRate = 26;
    } else {
      transRate = 5;
      treatRate = 10;
    }

    let transCost = w * transRate;
    let treatCost = w * treatRate;
    const calculatedTotal = transCost + treatCost;
    let minDiff = 0;
    let finalTotal = 0;

    if (record.visitType === 'زيارة فقط بدون نقل') {
      minDiff = 60;
      finalTotal = 60;
      transCost = 0;
      treatCost = 0;
    } else if (calculatedTotal < 60 && w > 0) {
      minDiff = 60 - calculatedTotal;
      finalTotal = 60;
    } else if (w > 0) {
      finalTotal = calculatedTotal;
    }

    return { weight: w, transCost, treatCost, minDiff, finalTotal };
  }

  function currentClaimTarget() {
    const mainType = document.getElementById('facilityMainType')?.value || '';
    if (mainType === 'إدارات صحية') {
      return {
        entityType: Contracts.EntityTypes.HEALTH_ADMIN,
        entityId: document.getElementById('healthAdminSelect')?.value || '',
        label: document.getElementById('healthAdminSelect')?.selectedOptions?.[0]?.textContent || ''
      };
    }
    return {
      entityType: Contracts.EntityTypes.FACILITY,
      entityId: document.getElementById('subFacilitySelect')?.value || '',
      label: document.getElementById('subFacilitySelect')?.selectedOptions?.[0]?.textContent || ''
    };
  }

  function generateFacilityReport() {
    const mainType = document.getElementById('facilityMainType')?.value || '';
    const selectedAdmin = document.getElementById('healthAdminSelect')?.value || '';
    const selectedFacility = document.getElementById('subFacilitySelect')?.value || '';
    const startDate = document.getElementById('startDate')?.value || '';
    const endDate = document.getElementById('endDate')?.value || '';

    filteredRecords = allRecords.filter(r => {
      if (startDate && r.reportDate < startDate) return false;
      if (endDate && r.reportDate > endDate) return false;
      if (mainType && r.facilityMainType !== mainType) return false;
      if (mainType === 'إدارات صحية') {
        if (selectedAdmin && r.healthAdmin !== selectedAdmin) return false;
        return true;
      }
      if (selectedFacility && r.facilityId !== selectedFacility) return false;
      return true;
    });
    renderTableAndKPIs();
  }

  function renderTableAndKPIs() {
    const tbody = document.getElementById('reportTableBody');
    const noRecords = document.getElementById('noRecordsMsg');
    tbody.innerHTML = '';

    let totalWeight = 0, totalTrans = 0, totalTreat = 0, totalMinDiff = 0, totalAmount = 0;
    noRecords.classList.toggle('hidden', filteredRecords.length !== 0);

    filteredRecords.forEach((r, idx) => {
      const fin = calculateFinancials(r);
      totalWeight += fin.weight;
      totalTrans += fin.transCost;
      totalTreat += fin.treatCost;
      totalMinDiff += fin.minDiff;
      totalAmount += fin.finalTotal;

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="p-2.5 font-semibold text-slate-500">${idx + 1}</td>
        <td class="p-2.5 font-medium text-slate-800">${Utils.escapeHtml(r.reportDate || '-')}</td>
        <td class="p-2.5 font-bold text-slate-800">${Utils.escapeHtml(r.subFacilityName || r.facilityName || '-')}</td>
        <td class="p-2.5"><span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${r.facilityMainType === 'منشأت خاصة' || r.facilityMainType === 'شركات خاصة' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${Utils.escapeHtml(r.facilityMainType || 'حكومي/إدارة')}</span></td>
        <td class="p-2.5 text-slate-600">${Utils.escapeHtml(r.treatmentUnit || '-')}</td>
        <td class="p-2.5 text-center font-bold text-emerald-700">${fin.weight > 0 ? fin.weight.toFixed(2) : '-'}</td>
        <td class="p-2.5 text-center font-semibold text-slate-600">${fin.transCost > 0 ? fin.transCost.toFixed(2) : '-'}</td>
        <td class="p-2.5 text-center font-semibold text-slate-600">${fin.treatCost > 0 ? fin.treatCost.toFixed(2) : '-'}</td>
        <td class="p-2.5 text-center font-semibold text-amber-600">${fin.minDiff > 0 ? fin.minDiff.toFixed(2) : '-'}</td>
        <td class="p-2.5 text-center font-bold text-blue-700">${fin.finalTotal.toFixed(2)}</td>
        <td class="p-2.5 text-center text-[10px] font-bold text-slate-500">${Utils.escapeHtml(r.createdBy || 'غير مسجل')}</td>`;
      tbody.appendChild(tr);
    });

    document.getElementById('statWeight').innerText = `${totalWeight.toFixed(2)} كجم`;
    document.getElementById('statVisits').innerText = filteredRecords.length;
    document.getElementById('statMinDiff').innerText = `${totalMinDiff.toFixed(2)} جنية`;
    document.getElementById('statTotalAmount').innerText = `${totalAmount.toFixed(2)} جنية`;
    document.getElementById('footTotalWeight').innerText = `${totalWeight.toFixed(2)} كجم`;
    document.getElementById('footTotalTrans').innerText = totalTrans.toFixed(2);
    document.getElementById('footTotalTreat').innerText = totalTreat.toFixed(2);
    document.getElementById('footTotalMin').innerText = totalMinDiff.toFixed(2);
    document.getElementById('footTotalAmount').innerText = `${totalAmount.toFixed(2)} جنية`;

    const mainType = document.getElementById('facilityMainType')?.value || '';
    const target = currentClaimTarget();
    let titleText = 'كشف حركة ومطالبة رفع النفايات الطبية';
    if (mainType === 'إدارات صحية' && target.entityId) titleText += ` - الإدارة الصحية: ${target.label}`;
    else if (target.entityId) titleText += ` - ${target.label}`;
    else if (mainType) titleText += ` - (${mainType})`;
    document.getElementById('reportTitle').innerText = titleText;

    const startDate = document.getElementById('startDate')?.value || '';
    const endDate = document.getElementById('endDate')?.value || '';
    document.getElementById('reportPeriodText').innerText = (startDate || endDate)
      ? `الفترة من: ${startDate || 'بداية السجلات'} إلى: ${endDate || 'اليوم'}`
      : 'الفترة: كافة السجلات المسجلة';
  }

  async function authorizeClaimOrExplain() {
    const target = currentClaimTarget();
    const status = document.getElementById('claimMatchStatus');
    const mainType = document.getElementById('facilityMainType')?.value || '';

    if (!target.entityId) {
      status.className = 'no-print bg-amber-50 border border-amber-300 text-amber-800 rounded-2xl p-4 text-xs font-bold';
      status.textContent = mainType === 'إدارات صحية'
        ? '⚠️ اختر الإدارة الصحية. المطالبة ستشمل كل وحداتها مجمعة ولا تحتاج اختيار وحدة منفردة.'
        : '⚠️ اختر منشأة واحدة لإصدار المطالبة.';
      return false;
    }

    status.className = 'no-print bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-2xl p-4 text-xs font-bold';
    status.textContent = mainType === 'إدارات صحية'
      ? '⏳ جاري التحقق من مطابقة كل وحدات الإدارة الصحية الداخلة في المطالبة...'
      : '⏳ جاري التحقق من المطابقة رحلة برحلة للمنشأة...';

    try {
      const start = document.getElementById('startDate').value;
      const end = document.getElementById('endDate').value;
      const result = target.entityType === Contracts.EntityTypes.HEALTH_ADMIN
        ? await Claims.authorizeHealthAdmin(target.entityId, start, end)
        : await Claims.authorizeFacility(target.entityId, start, end);
      status.className = 'no-print bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl p-4 text-xs font-bold';
      status.textContent = target.entityType === Contracts.EntityTypes.HEALTH_ADMIN
        ? '✅ كل وحدات الإدارة الداخلة في الفترة متطابقة. تم السماح بإصدار المطالبة المجمعة للإدارة.'
        : '✅ بيانات المنشأة متطابقة رحلة برحلة من الجانبين. تم السماح بإصدار المطالبة.';
      return result.authorized === true;
    } catch (error) {
      const reconciliation = error?.details?.reconciliation;
      const rec = reconciliation?.summary;
      const badItems = (reconciliation?.days || []).filter(day => !day.matched).slice(0, 8);
      const badLabels = badItems.map(day => `${day.facilityName || day.facilityId || 'منشأة'} (${day.reportDate || '-'})`);
      status.className = 'no-print bg-rose-50 border border-rose-300 text-rose-800 rounded-2xl p-4 text-xs font-bold';
      status.textContent = `❌ تم منع المطالبة لعدم التطابق.${rec ? ` حالات غير مطابقة: ${rec.unmatchedDays} | فرق الوزن الإجمالي: ${rec.differenceKg} كجم.` : ''}${badLabels.length ? ` راجع: ${badLabels.join('، ')}.` : ''} افتح صفحة المطابقة لمعالجة الفروق قبل الإصدار.`;
      return false;
    }
  }

  async function exportReportToExcel() {
    if (!(await authorizeClaimOrExplain())) return;
    if (!filteredRecords.length) return alert('لا توجد بيانات متاحة للتصدير.');

    const excelRows = filteredRecords.map((r, i) => {
      const fin = calculateFinancials(r);
      return {
        'م': i + 1,
        'تاريخ البلاغ': r.reportDate || '',
        'التصنيف الرئيسي': r.facilityMainType || '',
        'الإدارة الصحية': r.healthAdmin || '',
        'اسم المنشأة / الوحدة': r.subFacilityName || r.facilityName || '',
        'وحدة المعالجة': r.treatmentUnit || '',
        'طبيعة الزيارة': r.visitType || '',
        'الوزن (كجم)': fin.weight,
        'تكلفة النقل (جنية)': fin.transCost,
        'تكلفة المعالجة (جنية)': fin.treatCost,
        'فرق الحد الأدنى (جنية)': fin.minDiff,
        'المبلغ الإجمالي المستحق (جنية)': fin.finalTotal,
        'اسم السائق': r.driverName || '',
        'رقم السيارة': r.carNumber || '',
        'بواسطة': r.createdBy || 'غير مسجل',
        'توقيت التسجيل': r.timestamp || ''
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'مطالبة النفايات الطبية');
    XLSX.writeFile(workbook, 'بيان_مطالبة_النفايات_الطبية.xlsx');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    SettingsService.reloadFromLocal();
    applySettings(SettingsService.getData());
    allRecords = Records.getLocal(Contracts.EntrySources.TREATMENT);

    try {
      const directory = await EntitiesRepository.list();
      facilityDirectory = directory.facilities || [];
    } catch (_) {
      facilityDirectory = [];
    }

    initHealthAdminDropdown();
    refreshClaimModeUI();
    generateFacilityReport();
    UI.setSyncBadge('جاري تحديث البيانات والقوائم... ⏳', 'loading');

    try {
      try {
        await SettingsService.refreshFromCloud();
        applySettings(SettingsService.getData());
        initHealthAdminDropdown();
      } catch (settingsError) {
        Logger.warn('facility_report_settings_refresh_failed', { error: settingsError });
      }
      try {
        const directory = await EntitiesRepository.list();
        facilityDirectory = directory.facilities || facilityDirectory;
        populateSubFacilitiesDropdown();
      } catch (_) {}
      allRecords = await Records.fetchMerged(Contracts.EntrySources.TREATMENT);
      generateFacilityReport();
      UI.setSyncBadge('✅ تم تحديث البيانات والقوائم', 'success', 2000);
    } catch (error) {
      Logger.error('facility_report_records_load_failed', { error });
      UI.setSyncBadge('❌ عرض البيانات المحلية فقط (تعذر الاتصال)', 'error', 3000);
    }
  });

  document.getElementById('facilityMainType')?.addEventListener('change', handleMainTypeFilterChange);
  document.getElementById('healthAdminSelect')?.addEventListener('change', generateFacilityReport);
  document.getElementById('subFacilitySelect')?.addEventListener('change', generateFacilityReport);
  document.getElementById('startDate')?.addEventListener('change', generateFacilityReport);
  document.getElementById('endDate')?.addEventListener('change', generateFacilityReport);
  document.getElementById('resetFiltersControl')?.addEventListener('click', resetFilters);
  document.getElementById('printControl')?.addEventListener('click', async () => { if (await authorizeClaimOrExplain()) window.print(); });
  document.getElementById('exportReportToExcelControl')?.addEventListener('click', exportReportToExcel);
})(window.MedWaste);
