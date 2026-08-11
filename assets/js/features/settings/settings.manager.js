(function (MW) {
  'use strict';

  const { SettingsService, Records, UI } = MW;
  let activeTab = 'cars';

  function data() {
    return SettingsService.getData();
  }

  function refreshDependentForms() {
    MW.TripForm?.refreshOptions();
  }

  async function saveAll() {
    SettingsService.persistLocal();
    UI.setSyncBadge('جاري حفظ القوائم (سيارات، سائقين، منشآت) في السحابة... ⏳', 'loading');
    try {
      await SettingsService.save();
      UI.setSyncBadge('✅ تم تحديث وتعميم القوائم للجميع', 'success', 3000);
    } catch (error) {
      UI.setSyncBadge('❌ فشل الحفظ بالسحابة (تم محلياً فقط)', 'error', 3000);
    }
    refreshDependentForms();
  }

  function toggleModal() {
    const modal = document.getElementById('managerModal');
    if (!modal) return;
    modal.classList.toggle('hidden');
    if (!modal.classList.contains('hidden')) switchTab('cars');
    else refreshDependentForms();
  }

  function switchTab(tabKey) {
    activeTab = tabKey;
    ['cars', 'drivers', 'admins', 'gov', 'priv', 'comp', 'backup'].forEach(key => {
      const button = document.getElementById(`tab-${key}`);
      if (!button) return;
      button.className = key === tabKey
        ? 'px-4 py-2 font-bold rounded-xl bg-teal-50 text-teal-800 border border-teal-200'
        : 'px-4 py-2 font-bold rounded-xl bg-slate-100 text-slate-600';
    });

    const adminsSection = document.getElementById('section-admins');
    const genericSection = document.getElementById('section-generic');
    const backupSection = document.getElementById('section-backup');

    adminsSection?.classList.toggle('hidden', tabKey !== 'admins');
    backupSection?.classList.toggle('hidden', tabKey !== 'backup');
    genericSection?.classList.toggle('hidden', tabKey === 'admins' || tabKey === 'backup');

    if (tabKey === 'admins') populateAdminsSelect();
    else if (tabKey !== 'backup') renderGenericList();
  }

  function populateAdminsSelect() {
    const select = document.getElementById('manageAdminSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختر الإدارة الصحية --</option>';
    Object.keys(data().healthAdmins || {}).forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    document.getElementById('adminUnitsSubSection')?.classList.add('hidden');
  }

  async function addHealthAdmin() {
    const input = document.getElementById('newAdminName');
    const name = input?.value.trim() || '';
    if (!name) return alert('برجاء كتابة اسم الإدارة الجديدة');
    if (data().healthAdmins[name]) return alert('الإدارة موجودة بالفعل');
    data().healthAdmins[name] = [];
    if (input) input.value = '';
    populateAdminsSelect();
    await saveAll();
    alert('تمت إضافة الإدارة الصحية بنجاح');
  }

  async function renameSelectedAdmin() {
    const select = document.getElementById('manageAdminSelect');
    const oldName = select?.value || '';
    if (!oldName) return alert('برجاء اختيار إدارة أولاً');
    const newName = prompt('ادخل الاسم الجديد للإدارة الصحية:', oldName);
    if (!newName || !newName.trim() || newName === oldName) return;
    data().healthAdmins[newName.trim()] = data().healthAdmins[oldName];
    delete data().healthAdmins[oldName];
    populateAdminsSelect();
    await saveAll();
  }

  async function deleteSelectedAdmin() {
    const select = document.getElementById('manageAdminSelect');
    const name = select?.value || '';
    if (!name) return alert('برجاء اختيار إدارة أولاً');
    if (!confirm(`هل أنت متأكد من حذف ${name} بالكامل وكافة وحداتها؟`)) return;
    delete data().healthAdmins[name];
    populateAdminsSelect();
    await saveAll();
  }

  function renderAdminUnits() {
    const adminName = document.getElementById('manageAdminSelect')?.value || '';
    const section = document.getElementById('adminUnitsSubSection');
    const list = document.getElementById('adminUnitsList');
    if (!section || !list) return;

    if (!adminName) {
      section.classList.add('hidden');
      return;
    }

    section.classList.remove('hidden');
    list.innerHTML = '';
    (data().healthAdmins[adminName] || []).forEach((unit, index) => {
      const item = document.createElement('li');
      item.className = 'flex justify-between items-center p-2 text-xs hover:bg-slate-50';
      item.innerHTML = `
        <span class="font-semibold"></span>
        <div class="flex gap-1">
          <button type="button" data-admin-action="edit" data-index="${index}" class="text-amber-600 hover:text-amber-800 font-bold px-2 py-0.5 bg-amber-50 rounded">تعديل</button>
          <button type="button" data-admin-action="delete" data-index="${index}" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 bg-rose-50 rounded">حذف</button>
        </div>`;
      item.querySelector('span').textContent = unit;
      list.appendChild(item);
    });
  }

  async function addUnit() {
    const adminName = document.getElementById('manageAdminSelect')?.value || '';
    const input = document.getElementById('newUnitName');
    const unitName = input?.value.trim() || '';
    if (!adminName) return alert('اختر الإدارة أولاً');
    if (!unitName) return alert('اكتب اسم الوحدة الجديدة');
    data().healthAdmins[adminName].push(unitName);
    if (input) input.value = '';
    renderAdminUnits();
    await saveAll();
  }

  async function editUnit(index) {
    const adminName = document.getElementById('manageAdminSelect')?.value || '';
    if (!adminName || !data().healthAdmins[adminName]?.[index]) return;
    const updated = prompt('تعديل اسم الوحدة الصحية:', data().healthAdmins[adminName][index]);
    if (!updated || !updated.trim()) return;
    data().healthAdmins[adminName][index] = updated.trim();
    renderAdminUnits();
    await saveAll();
  }

  async function deleteUnit(index) {
    const adminName = document.getElementById('manageAdminSelect')?.value || '';
    if (!adminName || !data().healthAdmins[adminName]?.[index]) return;
    if (!confirm('هل أنت متأكد من حذف هذه الوحدة؟')) return;
    data().healthAdmins[adminName].splice(index, 1);
    renderAdminUnits();
    await saveAll();
  }

  function getGenericArray() {
    if (activeTab === 'cars') return data().cars;
    if (activeTab === 'drivers') return data().drivers;
    if (activeTab === 'gov') return data().govFacilities;
    if (activeTab === 'priv') return data().privateFacilities;
    return data().privateCompanies;
  }

  function renderGenericList() {
    const title = document.getElementById('genericTitle');
    const list = document.getElementById('genericItemsList');
    if (!title || !list) return;

    const titles = {
      cars: 'إدارة قائمة سيارات النفايات',
      drivers: 'إدارة قائمة السائقين',
      gov: 'إدارة قائمة المنشآت الحكومية',
      priv: 'إدارة قائمة المنشآت الخاصة',
      comp: 'إدارة قائمة الشركات الخاصة'
    };
    title.innerText = titles[activeTab] || 'إدارة العناصر';
    list.innerHTML = '';

    getGenericArray().forEach((value, index) => {
      const item = document.createElement('li');
      item.className = 'flex justify-between items-center p-2 text-xs hover:bg-slate-50';
      item.innerHTML = `
        <span class="font-semibold"></span>
        <div class="flex gap-1">
          <button type="button" data-generic-action="edit" data-index="${index}" class="text-amber-600 hover:text-amber-800 font-bold px-2 py-0.5 bg-amber-50 rounded">تعديل</button>
          <button type="button" data-generic-action="delete" data-index="${index}" class="text-rose-600 hover:text-rose-800 font-bold px-2 py-0.5 bg-rose-50 rounded">حذف</button>
        </div>`;
      item.querySelector('span').textContent = value;
      list.appendChild(item);
    });
  }

  async function addGenericItem() {
    const input = document.getElementById('genericInputName');
    const value = input?.value.trim() || '';
    if (!value) return alert('ادخل الاسم أولاً');
    getGenericArray().push(value);
    if (input) input.value = '';
    renderGenericList();
    await saveAll();
  }

  async function editGenericItem(index) {
    const array = getGenericArray();
    if (!array[index]) return;
    const updated = prompt('تعديل الاسم/الرقم:', array[index]);
    if (!updated || !updated.trim()) return;
    array[index] = updated.trim();
    renderGenericList();
    await saveAll();
  }

  async function deleteGenericItem(index) {
    const array = getGenericArray();
    if (!array[index] || !confirm('هل أنت متأكد من الحذف؟')) return;
    array.splice(index, 1);
    renderGenericList();
    await saveAll();
  }

  function exportBackup() {
    const backupData = Object.assign({
      dakahlia_waste_records: Records.getLocal(),
      export_date: new Date().toISOString()
    }, SettingsService.exportBackupSettings());

    const dataUrl = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `backup_waste_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => {
      try {
        const backup = JSON.parse(loadEvent.target.result);
        if (!confirm('هل أنت متأكد من استرجاع هذه النسخة الاحتياطية؟ سيتم تحديث كافة السجلات والقوائم المعتمدة.')) return;
        if (backup.dakahlia_waste_records) Records.saveLocal(backup.dakahlia_waste_records);
        SettingsService.replaceLocalSettings(backup);
        alert('تم استرجاع النسخة الاحتياطية بنجاح!');
        location.reload();
      } catch (_) {
        alert('حدث خطأ أثناء قراءة الملف. تأكد من اختيار ملف JSON صحيح.');
      }
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    document.getElementById('managerControlsButton')?.addEventListener('click', toggleModal);
    document.getElementById('toggleManagerModalControl')?.addEventListener('click', toggleModal);
    document.getElementById('toggleManagerModal2Control')?.addEventListener('click', toggleModal);
    ['cars', 'drivers', 'admins', 'gov', 'priv', 'comp', 'backup'].forEach(key => {
      document.getElementById(`tab-${key}`)?.addEventListener('click', () => switchTab(key));
    });
    document.getElementById('addHealthAdminControl')?.addEventListener('click', addHealthAdmin);
    document.getElementById('manageAdminSelect')?.addEventListener('change', renderAdminUnits);
    document.getElementById('renameSelectedAdminControl')?.addEventListener('click', renameSelectedAdmin);
    document.getElementById('deleteSelectedAdminControl')?.addEventListener('click', deleteSelectedAdmin);
    document.getElementById('addUnitToSelectedAdminControl')?.addEventListener('click', addUnit);
    document.getElementById('addGenericFacilityControl')?.addEventListener('click', addGenericItem);
    document.getElementById('exportBackupControl')?.addEventListener('click', exportBackup);
    document.getElementById('backupImportInput')?.addEventListener('change', importBackup);

    document.getElementById('adminUnitsList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-admin-action]');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (button.dataset.adminAction === 'edit') editUnit(index);
      if (button.dataset.adminAction === 'delete') deleteUnit(index);
    });

    document.getElementById('genericItemsList')?.addEventListener('click', event => {
      const button = event.target.closest('[data-generic-action]');
      if (!button) return;
      const index = Number(button.dataset.index);
      if (button.dataset.genericAction === 'edit') editGenericItem(index);
      if (button.dataset.genericAction === 'delete') deleteGenericItem(index);
    });
  }

  function refresh() {
    if (!document.getElementById('managerModal')?.classList.contains('hidden')) switchTab(activeTab);
  }

  function init() {
    bindEvents();
  }

  MW.SettingsManager = Object.freeze({ init, refresh });
})(window.MedWaste);
