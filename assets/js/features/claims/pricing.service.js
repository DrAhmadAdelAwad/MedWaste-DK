(function (MW) {
  'use strict';

  /**
   * Central pricing rules for facility claims.
   * All amounts are EGP and weights are kilograms.
   * "Minimum charge" is an ADDITIONAL accounting line item, not a floor/cap on the invoice total.
   */
  const RULES = Object.freeze({
    GOVERNMENT_MIN_THRESHOLD_KG: 4,
    GOVERNMENT_MINIMUM_CHARGE: 60,
    GOVERNMENT_TRANSPORT_RATE: 5,
    GOVERNMENT_TREATMENT_RATE: 10,

    PRIVATE_MIN_THRESHOLD_KG: 1.72,
    PRIVATE_MINIMUM_CHARGE: 60,
    PRIVATE_TRANSPORT_RATE: 9,
    PRIVATE_TREATMENT_RATE: 26,

    COMPANY_TREATMENT_RATE: 26
  });

  function safeWeight(record) {
    if (record?.visitType === 'زيارة فقط بدون نقل') return 0;
    const value = Number.parseFloat(record?.wasteWeight ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function facilityClass(record) {
    const type = String(record?.facilityMainType || '').trim();
    if (type === 'منشأت خاصة') return 'private';
    if (type === 'شركات خاصة') return 'company';
    return 'government'; // government facilities + health-administration units + legacy government records.
  }

  function calculate(record) {
    const weight = safeWeight(record);
    const kind = facilityClass(record);

    let transportRate = 0;
    let treatmentRate = 0;
    let transportCost = 0;
    let treatmentCost = 0;
    let minimumCharge = 0;
    let finalTotal = 0;
    let ruleCode = '';
    let ruleLabel = '';

    if (kind === 'private' && weight < RULES.PRIVATE_MIN_THRESHOLD_KG) {
      // Private facilities below 1.72 kg:
      // no transport charge + treatment at 26 EGP/kg + an ADDITIONAL 60 EGP minimum-charge line item.
      transportRate = 0;
      treatmentRate = RULES.PRIVATE_TREATMENT_RATE;
      transportCost = 0;
      treatmentCost = weight * treatmentRate;
      minimumCharge = RULES.PRIVATE_MINIMUM_CHARGE;
      finalTotal = treatmentCost + minimumCharge;
      ruleCode = 'PRIVATE_UNDER_1_72KG_TREATMENT_PLUS_MIN_60';
      ruleLabel = 'منشأة خاصة أقل من 1.72 كجم: نقل صفر + معالجة 26 ج/كجم + بند حد أدنى 60 ج';
    } else if (kind === 'private') {
      transportRate = RULES.PRIVATE_TRANSPORT_RATE;
      treatmentRate = RULES.PRIVATE_TREATMENT_RATE;
      transportCost = weight * transportRate;
      treatmentCost = weight * treatmentRate;
      finalTotal = transportCost + treatmentCost;
      ruleCode = 'PRIVATE_1_72KG_PLUS_35_PER_KG';
      ruleLabel = 'منشأة خاصة من 1.72 كجم فأكثر: نقل 9 ج/كجم + معالجة 26 ج/كجم';
    } else if (kind === 'company') {
      transportRate = 0;
      treatmentRate = RULES.COMPANY_TREATMENT_RATE;
      transportCost = 0;
      treatmentCost = weight * treatmentRate;
      finalTotal = treatmentCost;
      ruleCode = 'COMPANY_TREATMENT_ONLY_26_PER_KG';
      ruleLabel = 'شركة خاصة: معالجة فقط 26 ج/كجم بدون نقل';
    } else if (weight < RULES.GOVERNMENT_MIN_THRESHOLD_KG) {
      // Government facilities and health-administration units below 4 kg:
      // no transport charge + treatment at 10 EGP/kg + an ADDITIONAL 60 EGP minimum-charge line item.
      transportRate = 0;
      treatmentRate = RULES.GOVERNMENT_TREATMENT_RATE;
      transportCost = 0;
      treatmentCost = weight * treatmentRate;
      minimumCharge = RULES.GOVERNMENT_MINIMUM_CHARGE;
      finalTotal = treatmentCost + minimumCharge;
      ruleCode = 'GOVERNMENT_UNDER_4KG_TREATMENT_PLUS_MIN_60';
      ruleLabel = 'حكومي/وحدة إدارة أقل من 4 كجم: نقل صفر + معالجة 10 ج/كجم + بند حد أدنى 60 ج';
    } else {
      transportRate = RULES.GOVERNMENT_TRANSPORT_RATE;
      treatmentRate = RULES.GOVERNMENT_TREATMENT_RATE;
      transportCost = weight * transportRate;
      treatmentCost = weight * treatmentRate;
      finalTotal = transportCost + treatmentCost;
      ruleCode = 'GOVERNMENT_4KG_PLUS_15_PER_KG';
      ruleLabel = 'حكومي/وحدة إدارة من 4 كجم فأكثر: نقل 5 ج/كجم + معالجة 10 ج/كجم';
    }

    return Object.freeze({
      weight,
      facilityClass: kind,
      transportRate,
      treatmentRate,
      transportCost,
      treatmentCost,
      minimumCharge,
      finalTotal,
      ruleCode,
      ruleLabel
    });
  }

  MW.Pricing = Object.freeze({ RULES, calculate });
})(window.MedWaste);
