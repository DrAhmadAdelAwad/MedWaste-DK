(function (MW) {
  'use strict';

  const { SettingsService, TripForm, SettingsManager, Trips, UI, EntitiesRepository } = MW;
  const Logger = MW.Logger || { warn() {}, error() {} };

  document.addEventListener('DOMContentLoaded', async () => {
    SettingsService.reloadFromLocal();
    TripForm.init();
    SettingsManager.init();

    UI.setSyncBadge('جاري تحديث القوائم من السحابة... ⏳', 'loading');
    try {
      try { await SettingsService.retryPending(); } catch (error) {
        Logger.warn('pending_settings_retry_failed', { error });
      }

      await SettingsService.refreshFromCloud({maxAgeMs:1800000});
      TripForm.refreshOptions();
      SettingsManager.refresh();
      UI.setSyncBadge('✅ تم مزامنة القوائم والسيارات والسائقين', 'success', 2500);
    } catch (error) {
      Logger.error('settings_sync_failed', { error });
      UI.hideSyncBadge();
    }

    try {
      const result = await Trips.syncPending();
      if (result.synced > 0) TripForm.updateLocalCount();
    } catch (error) {
      Logger.warn('pending_records_sync_failed', { error });
    }
  });
})(window.MedWaste);
