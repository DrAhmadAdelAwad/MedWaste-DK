(function (MW) {
  'use strict';

  const { Api, Contracts } = MW;

  async function list(page = 1, pageSize = Contracts.Limits.AUDIT_PAGE_SIZE_DEFAULT) {
    const response = await Api.read(Contracts.Actions.GET_AUDIT_LOG, { page, pageSize });
    return {
      items: Array.isArray(response.data) ? response.data : [],
      pagination: response.pagination || { page: 1, pageSize, total: 0, totalPages: 0, hasMore: false }
    };
  }

  MW.AuditRepository = Object.freeze({ list });
})(window.MedWaste);
