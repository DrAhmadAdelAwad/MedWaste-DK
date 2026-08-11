(function (MW) {
  'use strict';

  const { Records, SettingsService, SettingsDefaults, UI } = MW;
  const Logger = MW.Logger || { warn() {}, error() {} };
  let allRecords = [];
  let sysAdmins = {};
  let govFacilities = [];
  let privFacilities = [];
  let privCompanies = [];
  const defaultTreatmentUnits = SettingsDefaults.treatmentUnits;
  let filteredRecords = [];

  function applySettings(settings) {
    sysAdmins = settings.healthAdmins || {};
    govFacilities = settings.govFacilities || [];
    privFacilities = settings.privateFacilities || [];
    privCompanies = settings.privateCompanies || [];
  }

  document.addEventListener('DOMContentLoaded', async () => {
    SettingsService.reloadFromLocal();
    applySettings(SettingsService.getData());
    allRecords = Records.getLocal();

    initHealthAdminDropdown();
    populateSubFacilitiesDropdown();
    generateFacilityReport();
    UI.setSyncBadge('جاري تحديث البيانات والقوائم... ⏳', 'loading');

    try {
      try {
        await SettingsService.refreshFromCloud();
        applySettings(SettingsService.getData());
        initHealthAdminDropdown();
        populateSubFacilitiesDropdown();
      } catch (settingsError) {
        Logger.warn('facility_report_settings_refresh_failed', { error: settingsError });
      }

      allRecords = await Records.fetchMerged();
      generateFacilityReport();
      UI.setSyncBadge('✅ تم تحديث البيانات والقوائم', 'success', 2000);
    } catch (error) {
      Logger.error('facility_report_records_load_failed', { error });
      UI.setSyncBadge('❌ عرض البيانات المحلية فقط (تعذر الاتصال)', 'error', 3000);
    }
  });

        function initHealthAdminDropdown() {
            const adminSelect = document.getElementById('healthAdminSelect');
            adminSelect.innerHTML = '<option value="">-- جميع الإدارات الصحية --</option>';
            Object.keys(sysAdmins).forEach(adm => {
                let opt = document.createElement('option');
                opt.value = adm;
                opt.textContent = adm;
                adminSelect.appendChild(opt);
            });
        }

        function handleMainTypeFilterChange() {
            const mainType = document.getElementById('facilityMainType').value;
            const adminBox = document.getElementById('adminFilterBox');
            
            if (mainType === 'إدارات صحية') {
                adminBox.classList.remove('hidden');
            } else {
                adminBox.classList.add('hidden');
                document.getElementById('healthAdminSelect').value = '';
            }

            populateSubFacilitiesDropdown();
            generateFacilityReport();
        }

        function handleAdminFilterChange() {
            populateSubFacilitiesDropdown();
            generateFacilityReport();
        }

        function populateSubFacilitiesDropdown() {
            const mainType = document.getElementById('facilityMainType').value;
            const selectedAdmin = document.getElementById('healthAdminSelect').value;
            const subSelect = document.getElementById('subFacilitySelect');
            const subLabel = document.getElementById('subFacilityLabel');

            subSelect.innerHTML = '<option value="">-- جميع المنشآت --</option>';

            let itemsList = [];

            if (!mainType) {
                let set = new Set();
                allRecords.forEach(r => { if(r.subFacilityName || r.facilityName) set.add(r.subFacilityName || r.facilityName); });
                itemsList = Array.from(set);
                subLabel.innerText = 'المنشأة / الوحدة الفرعية';
            } else if (mainType === 'إدارات صحية') {
                subLabel.innerText = 'الوحدة الصحية التابعة للإدارة';
                if (selectedAdmin && sysAdmins[selectedAdmin]) {
                    itemsList = sysAdmins[selectedAdmin];
                } else {
                    let set = new Set();
                    Object.values(sysAdmins).forEach(arr => arr.forEach(u => set.add(u)));
                    itemsList = Array.from(set);
                }
            } else if (mainType === 'منشأت حكومية') {
                subLabel.innerText = 'المستشفى / المركز الحكومي';
                itemsList = govFacilities;
            } else if (mainType === 'منشأت خاصة') {
                subLabel.innerText = 'المنشأة الطبية الخاصة';
                itemsList = privFacilities;
            } else if (mainType === 'شركات خاصة') {
                subLabel.innerText = 'الشركة الخاصة';
                itemsList = privCompanies;
            } else if (mainType === 'وحدات معالجة') {
                subLabel.innerText = 'وحدة المعالجة';
                itemsList = defaultTreatmentUnits;
            }

            itemsList.sort().forEach(item => {
                let opt = document.createElement('option');
                opt.value = item;
                opt.textContent = item;
                subSelect.appendChild(opt);
            });
        }

        function resetFilters() {
            document.getElementById('facilityMainType').value = '';
            document.getElementById('healthAdminSelect').value = '';
            document.getElementById('adminFilterBox').classList.add('hidden');
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            populateSubFacilitiesDropdown();
            generateFacilityReport();
        }

        // محرك الحسابات المالي الجديد
        function calculateFinancials(record) {
            let w = record.visitType === 'زيارة فقط بدون نقل' ? 0 : parseFloat(record.wasteWeight || 0);
            w = isNaN(w) ? 0 : w;

            let transRate = 0;
            let treatRate = 0;

            if (record.facilityMainType === 'منشأت خاصة') {
                transRate = 9;
                treatRate = 26;
            } else if (record.facilityMainType === 'شركات خاصة') {
                transRate = 0;
                treatRate = 26;
            } else {
                // إدارات صحية ومنشأت حكومية
                transRate = 5;
                treatRate = 10;
            }

            let transCost = w * transRate;
            let treatCost = w * treatRate;
            let calculatedTotal = transCost + treatCost;

            let minDiff = 0;
            let finalTotal = 0;

            if (record.visitType === 'زيارة فقط بدون نقل') {
                minDiff = 60;
                finalTotal = 60;
                transCost = 0;
                treatCost = 0;
            } else {
                if (calculatedTotal < 60 && w > 0) {
                    minDiff = 60 - calculatedTotal;
                    finalTotal = 60;
                } else if (w > 0) {
                    finalTotal = calculatedTotal;
                } else {
                    finalTotal = 0;
                }
            }

            return {
                weight: w,
                transCost: transCost,
                treatCost: treatCost,
                minDiff: minDiff,
                finalTotal: finalTotal
            };
        }

        function generateFacilityReport() {
            const mainType = document.getElementById('facilityMainType').value;
            const selectedAdmin = document.getElementById('healthAdminSelect').value;
            const selectedFacility = document.getElementById('subFacilitySelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            filteredRecords = allRecords.filter(r => {
                if (startDate && r.reportDate < startDate) return false;
                if (endDate && r.reportDate > endDate) return false;
                if (mainType && r.facilityMainType !== mainType) return false;

                if (mainType === 'إدارات صحية' && selectedAdmin) {
                    if (r.healthAdmin !== selectedAdmin) return false;
                }

                if (selectedFacility) {
                    let facName = r.subFacilityName || r.facilityName;
                    if (facName !== selectedFacility) return false;
                }

                return true;
            });

            renderTableAndKPIs();
        }

        function renderTableAndKPIs() {
            const tbody = document.getElementById('reportTableBody');
            const noRecords = document.getElementById('noRecordsMsg');
            
            tbody.innerHTML = '';

            let totalWeight = 0;
            let totalTrans = 0;
            let totalTreat = 0;
            let totalMinDiff = 0;
            let totalAmount = 0;

            if (filteredRecords.length === 0) {
                noRecords.classList.remove('hidden');
            } else {
                noRecords.classList.add('hidden');
            }

            filteredRecords.forEach((r, idx) => {
                let fin = calculateFinancials(r);

                totalWeight += fin.weight;
                totalTrans += fin.transCost;
                totalTreat += fin.treatCost;
                totalMinDiff += fin.minDiff;
                totalAmount += fin.finalTotal;

                let nameDisplay = r.subFacilityName || r.facilityName || '-';

                let tr = `
                    <tr class="hover:bg-slate-50 transition">
                        <td class="p-2.5 font-semibold text-slate-500">${idx + 1}</td>
                        <td class="p-2.5 font-medium text-slate-800">${r.reportDate || '-'}</td>
                        <td class="p-2.5 font-bold text-slate-800">${nameDisplay}</td>
                        <td class="p-2.5"><span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${r.facilityMainType === 'منشأت خاصة' || r.facilityMainType === 'شركات خاصة' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">${r.facilityMainType || 'حكومي/إدارة'}</span></td>
                        <td class="p-2.5 text-slate-600">${r.treatmentUnit || '-'}</td>
                        <td class="p-2.5 text-center font-bold text-emerald-700">${fin.weight > 0 ? fin.weight.toFixed(2) : '-'}</td>
                        <td class="p-2.5 text-center font-semibold text-slate-600">${fin.transCost > 0 ? fin.transCost.toFixed(2) : '-'}</td>
                        <td class="p-2.5 text-center font-semibold text-slate-600">${fin.treatCost > 0 ? fin.treatCost.toFixed(2) : '-'}</td>
                        <td class="p-2.5 text-center font-semibold text-amber-600">${fin.minDiff > 0 ? fin.minDiff.toFixed(2) : '-'}</td>
                        <td class="p-2.5 text-center font-bold text-blue-700">${fin.finalTotal.toFixed(2)}</td>
                        <td class="p-2.5 text-center text-[10px] font-bold text-slate-500">${r.createdBy || 'غير مسجل'}</td>
                    </tr>
                `;
                tbody.innerHTML += tr;
            });

            document.getElementById('statWeight').innerText = `${totalWeight.toFixed(2)} كجم`;
            document.getElementById('statVisits').innerText = filteredRecords.length;
            document.getElementById('statMinDiff').innerText = `${totalMinDiff.toFixed(2)} جنية`;
            document.getElementById('statTotalAmount').innerText = `${totalAmount.toFixed(2)} جنية`;

            document.getElementById('footTotalWeight').innerText = `${totalWeight.toFixed(2)} كجم`;
            document.getElementById('footTotalTrans').innerText = `${totalTrans.toFixed(2)}`;
            document.getElementById('footTotalTreat').innerText = `${totalTreat.toFixed(2)}`;
            document.getElementById('footTotalMin').innerText = `${totalMinDiff.toFixed(2)}`;
            document.getElementById('footTotalAmount').innerText = `${totalAmount.toFixed(2)} جنية`;

            const mainType = document.getElementById('facilityMainType').value;
            const selectedAdmin = document.getElementById('healthAdminSelect').value;
            const selectedFacility = document.getElementById('subFacilitySelect').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            let titleText = "كشف حركة ومطالبة رفع النفايات الطبية";
            if (selectedFacility) titleText += ` - ${selectedFacility}`;
            else if (selectedAdmin) titleText += ` - ${selectedAdmin}`;
            else if (mainType) titleText += ` - (${mainType})`;

            document.getElementById('reportTitle').innerText = titleText;

            let periodText = "الفترة: كافة السجلات المسجلة";
            if (startDate || endDate) {
                periodText = `الفترة من: ${startDate || 'بداية السجلات'} إلى: ${endDate || 'اليوم'}`;
            }
            document.getElementById('reportPeriodText').innerText = periodText;
        }

        function exportReportToExcel() {
            if (!filteredRecords || filteredRecords.length === 0) {
                alert('لا توجد بيانات متاحة للتصدير.');
                return;
            }

            const excelRows = filteredRecords.map((r, i) => {
                let fin = calculateFinancials(r);
                return {
                    "م": i + 1,
                    "تاريخ البلاغ": r.reportDate || '',
                    "التصنيف الرئيسي": r.facilityMainType || '',
                    "الإدارة الصحية": r.healthAdmin || '',
                    "اسم المنشأة / الوحدة": r.subFacilityName || r.facilityName || '',
                    "وحدة المعالجة": r.treatmentUnit || '',
                    "طبيعة الزيارة": r.visitType || '',
                    "الوزن (كجم)": fin.weight,
                    "تكلفة النقل (جنية)": fin.transCost,
                    "تكلفة المعالجة (جنية)": fin.treatCost,
                    "فرق الحد الأدنى (جنية)": fin.minDiff,
                    "المبلغ الإجمالي المستحق (جنية)": fin.finalTotal,
                    "اسم السائق": r.driverName || '',
                    "رقم السيارة": r.carNumber || '',
                    "بواسطة": r.createdBy || 'غير مسجل',
                    "توقيت التسجيل": r.timestamp || ''
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelRows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "مطالبة النفايات الطبية");
            XLSX.writeFile(workbook, "بيان_مطالبة_النفايات_الطبية.xlsx");
        }

// Static DOM event bindings (moved out of HTML in Stage 1)
document.getElementById('facilityMainType')?.addEventListener('change', (event) => {
    handleMainTypeFilterChange();
});
document.getElementById('healthAdminSelect')?.addEventListener('change', (event) => {
    handleAdminFilterChange();
});
document.getElementById('subFacilitySelect')?.addEventListener('change', (event) => {
    generateFacilityReport();
});
document.getElementById('startDate')?.addEventListener('change', (event) => {
    generateFacilityReport();
});
document.getElementById('endDate')?.addEventListener('change', (event) => {
    generateFacilityReport();
});
document.getElementById('resetFiltersControl')?.addEventListener('click', (event) => {
    resetFilters();
});
document.getElementById('printControl')?.addEventListener('click', (event) => {
    window.print();
});
document.getElementById('exportReportToExcelControl')?.addEventListener('click', (event) => {
    exportReportToExcel();
});

})(window.MedWaste);
