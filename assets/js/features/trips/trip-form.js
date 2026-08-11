(function (MW) {
  'use strict';

  const { SettingsDefaults, SettingsService, Utils, Trips, Records, UI, Validators } = MW;
  let currentBatch = [];

  function getSettings() {
    return SettingsService.getData();
  }

  function setToday() {
    const dateInput = document.getElementById('reportDate');
    if (!dateInput) return;
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    dateInput.max = today;
  }

  function fillSelect(select, placeholder, items) {
    if (!select) return;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    (items || []).forEach(item => {
      const option = document.createElement('option');
      option.value = item;
      option.textContent = item;
      select.appendChild(option);
    });
  }

  function refreshOptions() {
    const settings = getSettings();
    fillSelect(document.getElementById('treatmentUnit'), '-- اختر وحدة المعالجة --', SettingsDefaults.treatmentUnits);
    fillSelect(document.getElementById('carNumber'), '-- اختر رقم السيارة --', settings.cars);
    fillSelect(document.getElementById('driverName'), '-- اختر اسم السائق --', settings.drivers);
    handleMainTypeChange();
  }

  function handleMainTypeChange() {
    const settings = getSettings();
    const mainType = document.getElementById('facilityMainType')?.value || '';
    const adminContainer = document.getElementById('adminContainer');
    const subFacilitySelect = document.getElementById('subFacilityName');
    const subFacilityLabel = document.getElementById('subFacilityLabel');
    if (!subFacilitySelect || !subFacilityLabel || !adminContainer) return;

    fillSelect(subFacilitySelect, '-- اختر المنشأة / الوحدة --', []);

    if (mainType === 'إدارات صحية') {
      adminContainer.classList.remove('hidden');
      subFacilityLabel.innerText = 'اختر الوحدة الصحية التابعة للإدارة';
      loadAdminSelectOptions();
      loadAdminUnits();
      return;
    }

    adminContainer.classList.add('hidden');
    const healthAdmin = document.getElementById('healthAdmin');
    if (healthAdmin) healthAdmin.value = '';

    let items = [];
    if (mainType === 'منشأت حكومية') {
      subFacilityLabel.innerText = 'اختر المستشفى أو المركز الحكومي';
      items = settings.govFacilities;
    } else if (mainType === 'منشأت خاصة') {
      subFacilityLabel.innerText = 'اختر المنشأة الخاصة';
      items = settings.privateFacilities;
    } else if (mainType === 'شركات خاصة') {
      subFacilityLabel.innerText = 'اختر الشركة الخاصة';
      items = settings.privateCompanies;
    } else if (mainType === 'وحدات معالجة') {
      subFacilityLabel.innerText = 'اختر وحدة المعالجة المحول منها/إليها';
      items = SettingsDefaults.treatmentUnits;
    } else {
      subFacilityLabel.innerText = 'اختر المنشأة / الوحدة';
    }

    fillSelect(subFacilitySelect, '-- اختر المنشأة / الوحدة --', items);
  }

  function loadAdminSelectOptions() {
    const settings = getSettings();
    fillSelect(
      document.getElementById('healthAdmin'),
      '-- اختر الإدارة الصحية --',
      Object.keys(settings.healthAdmins || {})
    );
  }

  function loadAdminUnits() {
    const settings = getSettings();
    const selectedAdmin = document.getElementById('healthAdmin')?.value || '';
    fillSelect(
      document.getElementById('subFacilityName'),
      '-- اختر الوحدة الصحية --',
      settings.healthAdmins?.[selectedAdmin] || []
    );
  }

  function toggleWeightSection() {
    const visitType = document.querySelector('input[name="visitType"]:checked')?.value;
    const weightSection = document.getElementById('weightSection');
    const weightInput = document.getElementById('wasteWeight');
    if (!weightSection || !weightInput) return;

    if (visitType === 'زيارة فقط بدون نقل') {
      weightSection.classList.add('hidden');
      weightInput.value = '0';
    } else {
      weightSection.classList.remove('hidden');
      if (weightInput.value === '0') weightInput.value = '';
    }
  }

  function collectFacilityFromForm() {
    const mainType = document.getElementById('facilityMainType')?.value || '';
    const subFacilityName = document.getElementById('subFacilityName')?.value || '';
    const visitType = document.querySelector('input[name="visitType"]:checked')?.value || '';
    const wasteWeight = document.getElementById('wasteWeight')?.value || '';
    const weightUnit = document.getElementById('weightUnit')?.value || '';
    const healthAdmin = document.getElementById('healthAdmin')?.value || 'جهات مباشرة';

    return { mainType, subFacilityName, visitType, wasteWeight, weightUnit, healthAdmin };
  }

  function validateFacility(facility, requireSelection = true) {
    try {
      Validators.assertFacility(facility, requireSelection);
      return '';
    } catch (error) {
      return error.message || 'بيانات المنشأة غير صحيحة.';
    }
  }

  function addFacilityToBatch() {
    const facility = collectFacilityFromForm();
    const error = validateFacility(facility, true);
    if (error) return alert(error);

    currentBatch.push({
      id: Utils.generateId('item-'),
      facilityMainType: facility.mainType,
      healthAdmin: facility.healthAdmin,
      subFacilityName: facility.subFacilityName,
      visitType: facility.visitType,
      wasteWeight: facility.visitType === 'زيارة فقط بدون نقل' ? '0' : facility.wasteWeight,
      weightUnit: facility.visitType === 'زيارة فقط بدون نقل' ? '-' : facility.weightUnit
    });

    renderBatch();
    resetFacilityForm();
  }

  function renderBatch() {
    const tbody = document.getElementById('batchTableBody');
    const container = document.getElementById('batchContainer');
    const countSpan = document.getElementById('batchCount');
    if (!tbody || !container || !countSpan) return;

    tbody.innerHTML = '';
    countSpan.innerText = currentBatch.length;
    container.classList.toggle('hidden', currentBatch.length === 0);

    currentBatch.forEach((item, index) => {
      const tr = document.createElement('tr');
      const weightDisplay = item.visitType === 'زيارة فقط بدون نقل'
        ? '<span class="text-amber-600 font-semibold">زيارة فقط</span>'
        : `${item.wasteWeight} ${item.weightUnit}`;
      tr.innerHTML = `
        <td class="p-2 font-medium text-slate-800">${item.subFacilityName}</td>
        <td class="p-2">${item.visitType}</td>
        <td class="p-2 font-bold">${weightDisplay}</td>
        <td class="p-2 text-center">
          <button type="button" data-batch-action="remove" data-index="${index}" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 bg-rose-50 rounded">حذف</button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  function resetFacilityForm() {
    const mainType = document.getElementById('facilityMainType');
    if (mainType) mainType.value = '';
    document.getElementById('adminContainer')?.classList.add('hidden');
    const healthAdmin = document.getElementById('healthAdmin');
    if (healthAdmin) healthAdmin.value = '';
    fillSelect(document.getElementById('subFacilityName'), '-- برجاء اختيار نوع المنشأة الرئيسية أولاً --', []);
    const transferRadio = document.querySelector('input[name="visitType"][value="نقل نفايات"]');
    if (transferRadio) transferRadio.checked = true;
    const weight = document.getElementById('wasteWeight');
    if (weight) weight.value = '';
    toggleWeightSection();
  }

  function updateLocalCount() {
    const counter = document.getElementById('local-count');
    if (counter) counter.innerText = `محفوظ محلياً: ${Records.getLocal().length}`;
  }

  async function submitTrip(event) {
    event.preventDefault();

    const route = {
      reportDate: document.getElementById('reportDate')?.value || '',
      treatmentUnit: document.getElementById('treatmentUnit')?.value || '',
      driverName: document.getElementById('driverName')?.value || '',
      carNumber: document.getElementById('carNumber')?.value || ''
    };

    try {
      Validators.assertRoute(route);
    } catch (error) {
      alert(error.message);
      return;
    }

    const facility = collectFacilityFromForm();
    if (facility.mainType && facility.subFacilityName) {
      const error = validateFacility(facility, true);
      if (error) return alert('برجاء إدخال الوزن للمنشأة الحالية المكتوبة في النموذج.');

      const alreadyAdded = currentBatch.some(item => item.subFacilityName === facility.subFacilityName);
      if (!alreadyAdded) {
        currentBatch.push({
          id: Utils.generateId('item-'),
          facilityMainType: facility.mainType,
          healthAdmin: facility.healthAdmin,
          subFacilityName: facility.subFacilityName,
          visitType: facility.visitType,
          wasteWeight: facility.visitType === 'زيارة فقط بدون نقل' ? '0' : facility.wasteWeight,
          weightUnit: facility.visitType === 'زيارة فقط بدون نقل' ? '-' : facility.weightUnit
        });
      }
    }

    if (currentBatch.length === 0) {
      alert('برجاء إدخال منشأة واحدة على الأقل قبل الضغط على الحفظ النهائي.');
      return;
    }

    const submitButton = document.getElementById('submitBtn');
    const originalButtonText = submitButton?.innerText || '✅ حفظ وإرسال كافة المنشآت بالسحابة';
    if (submitButton?.disabled) return;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerText = 'جاري الحفظ والمزامنة...';
    }

    const status = document.getElementById('statusMessage');
    try {
      const result = await Trips.save(route, currentBatch);
      updateLocalCount();

      if (result.cloudSaved) {
        UI.setStatus(status, `تم حفظ ومزامنة إجمالي (${result.records.length}) منشأة للرحلة بنجاح.`, 'success');
      } else {
        UI.setStatus(status, `تم حفظ (${result.records.length}) منشأة محلياً، لكن تعذر تأكيد الحفظ في Google Sheets. ستتم إعادة المحاولة تلقائياً.`, 'error');
      }

      currentBatch = [];
      renderBatch();
      document.getElementById('wasteForm')?.reset();
      setToday();
      refreshOptions();
      resetFacilityForm();
      updateLocalCount();
    } catch (error) {
      UI.setStatus(status, error.message || 'تعذر حفظ الرحلة. راجع البيانات وحاول مرة أخرى.', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerText = originalButtonText;
      }
    }
  }

  function bindEvents() {
    document.getElementById('facilityMainType')?.addEventListener('change', handleMainTypeChange);
    document.getElementById('healthAdmin')?.addEventListener('change', loadAdminUnits);
    document.getElementById('toggleWeightSectionControl')?.addEventListener('change', toggleWeightSection);
    document.getElementById('toggleWeightSection2Control')?.addEventListener('change', toggleWeightSection);
    document.getElementById('addFacilityToBatchControl')?.addEventListener('click', addFacilityToBatch);
    document.getElementById('wasteForm')?.addEventListener('submit', submitTrip);
    document.getElementById('batchTableBody')?.addEventListener('click', event => {
      const button = event.target.closest('[data-batch-action="remove"]');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (!Number.isInteger(index)) return;
      currentBatch.splice(index, 1);
      renderBatch();
    });
  }

  function init() {
    setToday();
    refreshOptions();
    toggleWeightSection();
    renderBatch();
    updateLocalCount();
    bindEvents();
  }

  MW.TripForm = Object.freeze({ init, refreshOptions, updateLocalCount });
})(window.MedWaste);
