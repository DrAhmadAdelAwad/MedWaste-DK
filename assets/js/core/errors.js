(function (MW) {
  'use strict';

  const { Contracts } = MW;

  class AppError extends Error {
    constructor(message, code = Contracts.ErrorCodes.SERVER_ERROR, details = null, cause = null, requestId = '') {
      super(message || 'حدث خطأ غير متوقع.');
      this.name = 'AppError';
      this.code = code;
      this.details = details;
      this.cause = cause;
      this.requestId = requestId || '';
    }
  }

  function validation(message, details = null) {
    return new AppError(message, Contracts.ErrorCodes.VALIDATION, details);
  }

  function fromApi(payload) {
    return new AppError(
      payload?.message || 'فشلت العملية.',
      payload?.code || Contracts.ErrorCodes.SERVER_ERROR,
      payload?.details ?? null,
      null,
      payload?.requestId || ''
    );
  }

  function fromNetwork(error, requestId = '') {
    if (error instanceof AppError) {
      if (!error.requestId && requestId) error.requestId = requestId;
      return error;
    }
    if (error?.name === 'AbortError') {
      return new AppError(
        'انتهت مهلة الاتصال بالخادم. حاول مرة أخرى.',
        Contracts.ErrorCodes.REQUEST_TIMEOUT,
        null,
        error,
        requestId
      );
    }
    return new AppError(
      'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
      Contracts.ErrorCodes.NETWORK_ERROR,
      null,
      error,
      requestId
    );
  }

  function isRetryable(error) {
    const code = error?.code;
    return [
      Contracts.ErrorCodes.NETWORK_ERROR,
      Contracts.ErrorCodes.REQUEST_TIMEOUT,
      Contracts.ErrorCodes.SERVER_ERROR,
      Contracts.ErrorCodes.INVALID_RESPONSE,
      Contracts.ErrorCodes.BUSY
    ].includes(code);
  }

  MW.Errors = Object.freeze({ AppError, validation, fromApi, fromNetwork, isRetryable });
})(window.MedWaste);
