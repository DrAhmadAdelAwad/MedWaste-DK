(function (MW) {
  'use strict';

  const { Records, UI, Session, Contracts } = MW;
  const currentUser = Session.getUser();
  let currentSource = currentUser?.role === Contracts.Roles.FACILITY_ENTRY ? Contracts.EntrySources.FACILITY : Contracts.EntrySources.TREATMENT;
  const canSwitchSource = currentUser?.role === Contracts.Roles.SUPERVISOR || currentUser?.role === Contracts.Roles.ADMIN;
  let unitsChartInstance = null;
  let typesChartInstance = null;
  let currentFilteredRecords = [];

  document.addEventListener('DOMContentLoaded', async () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('endDate').value = today;
    const firstDay = new Date();
    firstDay.setDate(1);
    document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];

    bindSourceToggle();
    generateReports();
    UI.setSyncBadge('جاري تحديث السجلات... ⏳', 'loading');
    try {
      await Records.fetchMerged(currentSource);
      generateReports();
      UI.setSyncBadge('✅ تم تحديث السجلات', 'success', 2000);
    } catch (error) {
      UI.setSyncBadge('❌ تعذر الاتصال (عرض محلي)', 'error', 3000);
    }
  });

        function bindSourceToggle() {
            const container = document.getElementById('reportsSourceToggle');
            if (!container) return;
            const paint = () => container.querySelectorAll('[data-source]').forEach(btn => {
                const active = btn.dataset.source === currentSource;
                btn.className = `source-toggle px-4 py-2 rounded-lg transition ${active ? 'bg-white text-emerald-800 shadow' : 'text-slate-600'}`;
                if (!canSwitchSource && !active) btn.classList.add('hidden');
            });
            paint();
            container.addEventListener('click', async event => {
                const btn = event.target.closest('[data-source]');
                if (!btn || !canSwitchSource || btn.dataset.source === currentSource) return;
                currentSource = btn.dataset.source;
                paint();
                document.getElementById('primaryChartTitle').textContent = currentSource === Contracts.EntrySources.FACILITY
                    ? 'الأوزان المسجلة حسب المنشأة (كجم)'
                    : 'الأوزان الموردة لكل وحدة معالجة (كجم)';
                generateReports();
                UI.setSyncBadge('عرض فوري من الذاكرة المحلية — جاري تحديث المصدر... ⏳', 'loading');
                try { await Records.fetchMerged(currentSource); generateReports(); UI.setSyncBadge('✅ تم تحديث البيانات', 'success', 1500); }
                catch (_) { generateReports(); UI.setSyncBadge('❌ عرض البيانات المحلية', 'error', 2200); }
            });
            document.getElementById('primaryChartTitle').textContent = currentSource === Contracts.EntrySources.FACILITY
                ? 'الأوزان المسجلة حسب المنشأة (كجم)'
                : 'الأوزان الموردة لكل وحدة معالجة (كجم)';
        }

        function resetFilters() {
            document.getElementById('startDate').value = '';
            document.getElementById('endDate').value = '';
            generateReports();
        }

        function generateReports() {
            const allRecords = Records.getLocal(currentSource);
            
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            currentFilteredRecords = allRecords.filter(record => {
                if (!record.reportDate) return false;
                if (startDate && record.reportDate < startDate) return false;
                if (endDate && record.reportDate > endDate) return false;
                return true;
            });

            calculateKPIs(currentFilteredRecords);
            drawCharts(currentFilteredRecords);
        }

        function calculateKPIs(records) {
            let totalWeight = 0;
            let tripsSet = new Set();
            
            records.forEach(r => {
                let w = r.visitType === 'زيارة فقط بدون نقل' ? 0 : parseFloat(r.wasteWeight || 0);
                totalWeight += isNaN(w) ? 0 : w;

                let tripKey = r.tripId || `${r.reportDate}_${r.treatmentUnit}_${r.driverName}_${r.carNumber}`;
                tripsSet.add(tripKey);
            });

            animateValue("totalWeight", totalWeight);
            animateValue("totalFacilities", records.length);
            animateValue("totalTrips", tripsSet.size);
        }

        function drawCharts(records) {
            const unitsData = {};
            const typesData = {};

            records.forEach(r => {
                let w = r.visitType === 'زيارة فقط بدون نقل' ? 0 : parseFloat(r.wasteWeight || 0);
                w = isNaN(w) ? 0 : w;
                
                const primaryLabel = currentSource === Contracts.EntrySources.FACILITY
                    ? (r.subFacilityName || r.facilityName || 'منشأة غير محددة')
                    : (r.treatmentUnit || 'وحدة غير محددة');
                unitsData[primaryLabel] = (unitsData[primaryLabel] || 0) + w;

                if (r.facilityMainType) {
                    typesData[r.facilityMainType] = (typesData[r.facilityMainType] || 0) + 1;
                }
            });

            const unitsCtx = document.getElementById('treatmentUnitsChart').getContext('2d');
            if (unitsChartInstance) unitsChartInstance.destroy();
            
            unitsChartInstance = new Chart(unitsCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(unitsData),
                    datasets: [{
                        label: 'إجمالي الوزن (كجم)',
                        data: Object.values(unitsData),
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: 'rgba(5, 150, 105, 1)',
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, title: { display: true, text: 'الوزن (كجم)' } }
                    }
                }
            });

            const typesCtx = document.getElementById('facilitiesTypeChart').getContext('2d');
            if (typesChartInstance) typesChartInstance.destroy();

            typesChartInstance = new Chart(typesCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(typesData),
                    datasets: [{
                        data: Object.values(typesData),
                        backgroundColor: [
                            '#0ea5e9',
                            '#f59e0b',
                            '#10b981',
                            '#8b5cf6',
                            '#64748b'
                        ],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { family: 'Segoe UI' } } }
                    }
                }
            });
        }

        function animateValue(id, end, duration = 1000) {
            const obj = document.getElementById(id);
            const start = 0;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const currentVal = progress * (end - start) + start;
                obj.innerHTML = currentVal.toLocaleString('en-US', {maximumFractionDigits: 1}) + (id === 'totalWeight' ? ' <span class="text-lg text-slate-500 font-normal">كجم</span>' : '');
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        }

        function exportToExcel() {
            if (!currentFilteredRecords || currentFilteredRecords.length === 0) {
                alert('لا توجد بيانات متاحة للتصدير في الفترة المحددة.');
                return;
            }

            const formattedData = currentFilteredRecords.map((item, index) => ({
                "م": index + 1,
                "تاريخ البلاغ": item.reportDate || '',
                "وحدة المعالجة": item.treatmentUnit || '',
                "اسم السائق": item.driverName || '',
                "رقم السيارة": item.carNumber || '',
                "نوع المنشأة الرئيسية": item.facilityMainType || '',
                "الإدارة الصحية": item.healthAdmin || '',
                "اسم المنشأة / الوحدة": item.subFacilityName || item.facilityName || '',
                "طبيعة الزيارة": item.visitType || '',
                "الوزن المسجل": item.visitType === 'زيارة فقط بدون نقل' ? 0 : parseFloat(item.wasteWeight || 0),
                "وحدة القياس": item.visitType === 'زيارة فقط بدون نقل' ? '-' : (item.weightUnit || 'كيلوجرام'),
                "تاريخ وقت التسجيل": item.timestamp || ''
            }));

            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "تقرير النفايات الطبية");

            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            let fileName = 'تقرير_النفايات_الطبية';
            if (startDate || endDate) {
                fileName += `_${startDate || 'البداية'}_إلى_${endDate || 'النهاية'}`;
            }
            fileName += '.xlsx';

            XLSX.writeFile(workbook, fileName);
        }

// Static DOM event bindings (moved out of HTML in Stage 1)
document.getElementById('generateReportsControl')?.addEventListener('click', (event) => {
    generateReports();
});
document.getElementById('resetFiltersControl')?.addEventListener('click', (event) => {
    resetFilters();
});
document.getElementById('exportToExcelControl')?.addEventListener('click', (event) => {
    exportToExcel();
});

})(window.MedWaste);
