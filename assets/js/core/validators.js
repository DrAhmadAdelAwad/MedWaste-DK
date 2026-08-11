(function (MW) {
  'use strict';

  const { Contracts, Errors } = MW;
  const { Limits, RoleList } = Contracts;

  function clean(value) {
    return String(value == null ? '' : value).trim();
  }

  function isEmail(value) {
    const email = clean(value).toLowerCase();
    return Boolean(email) && email.length <= Limits.EMAIL_MAX_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function assertLogin(email, password) {
    if (!clean(email) || !clean(password)) throw Errors.validation('أدخل الإيميل وكلمة المرور.');
    if (!isEmail(email)) throw Errors.validation('صيغة الإيميل غير صحيحة.');
  }

  function assertRegistration(payload) {
    const fullName = clean(payload?.fullName);
    const email = clean(payload?.email);
    const password = clean(payload?.password);
    if (!fullName || !email || !password) throw Errors.validation('الاسم والإيميل وكلمة المرور مطلوبة.');
    if (!isEmail(email)) throw Errors.validation('صيغة الإيميل غير صحيحة.');
    if (password.length < Limits.PASSWORD_MIN_LENGTH) {
      throw Errors.validation(`كلمة المرور يجب ألا تقل عن ${Limits.PASSWORD_MIN_LENGTH} أحرف.`);
    }
    if (fullName.length > Limits.NAME_MAX_LENGTH) throw Errors.validation('الاسم أطول من الحد المسموح.');
  }

  function assertEmail(email) {
    if (!clean(email)) throw Errors.validation('أدخل الإيميل.');
    if (!isEmail(email)) throw Errors.validation('صيغة الإيميل غير صحيحة.');
  }

  function assertRoute(route) {
    if (!clean(route?.reportDate) || !clean(route?.treatmentUnit) || !clean(route?.driverName) || !clean(route?.carNumber)) {
      throw Errors.validation('برجاء استكمال بيانات خط السير الأساسية (التاريخ، وحدة المعالجة، السائق والسيارة).');
    }
  }

  function assertFacility(facility, requireSelection = true) {
    const mainType = clean(facility?.mainType ?? facility?.facilityMainType);
    const subFacilityName = clean(facility?.subFacilityName ?? facility?.facilityName);
    const visitType = clean(facility?.visitType);
    const wasteWeight = Number(facility?.wasteWeight);
    const weightUnit = clean(facility?.weightUnit);

    if (requireSelection && (!mainType || !subFacilityName)) {
      throw Errors.validation('برجاء اختيار نوع المنشأة واسمها أولاً.');
    }
    if (!visitType) throw Errors.validation('برجاء تحديد طبيعة الزيارة.');
    if (visitType === 'نقل نفايات' && (!Number.isFinite(wasteWeight) || wasteWeight <= 0)) {
      throw Errors.validation('برجاء إدخال الوزن المسجل للمنشأة.');
    }
    if (visitType === 'نقل نفايات' && !weightUnit) {
      throw Errors.validation('برجاء اختيار وحدة الوزن.');
    }
  }

  function assertBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) throw Errors.validation('برجاء إدخال منشأة واحدة على الأقل قبل الحفظ النهائي.');
    if (batch.length > Limits.RECORDS_PER_BATCH) {
      throw Errors.validation(`الحد الأقصى ${Limits.RECORDS_PER_BATCH} منشأة في الرحلة الواحدة.`);
    }
    batch.forEach(item => assertFacility(item, true));
  }

  function assertRole(role) {
    if (!RoleList.includes(clean(role))) throw Errors.validation('الصلاحية غير صالحة.');
  }

  function assertSettings(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Errors.validation('بيانات الإعدادات غير صحيحة.');
    if (data.healthAdmins != null && (typeof data.healthAdmins !== 'object' || Array.isArray(data.healthAdmins))) {
      throw Errors.validation('قائمة الإدارات الصحية غير صحيحة.');
    }
    if (data.healthAdmins) {
      Object.values(data.healthAdmins).forEach(units => {
        if (!Array.isArray(units)) throw Errors.validation('وحدات إحدى الإدارات الصحية ليست في صيغة قائمة صحيحة.');
      });
    }
    ['cars', 'drivers', 'govFacilities', 'privateFacilities', 'privateCompanies'].forEach(key => {
      if (data[key] != null && !Array.isArray(data[key])) throw Errors.validation(`صيغة إعدادات ${key} غير صحيحة.`);
    });
    if (JSON.stringify(data).length > Limits.SETTINGS_JSON_MAX_LENGTH) {
      throw Errors.validation('حجم بيانات الإعدادات أكبر من الحد المسموح.');
    }
  }

  MW.Validators = Object.freeze({
    clean,
    isEmail,
    assertLogin,
    assertRegistration,
    assertEmail,
    assertRoute,
    assertFacility,
    assertBatch,
    assertRole,
    assertSettings
  });
})(window.MedWaste);
