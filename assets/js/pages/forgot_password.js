(function (MW) {
  'use strict';

  const { Auth } = MW;

  document.getElementById('resetForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('submitBtn');
    const message = document.getElementById('statusMsg');
    button.innerText = 'جاري الإرسال...';
    button.disabled = true;

    try {
      await Auth.forgotPassword(document.getElementById('email').value);
      message.classList.remove('hidden', 'text-rose-700', 'bg-rose-50', 'text-emerald-700', 'bg-emerald-50');
      message.innerText = 'تم إرسال كلمة مرور مؤقتة جديدة إلى بريدك الإلكتروني بنجاح.';
      message.classList.add('text-emerald-700', 'bg-emerald-50');
    } catch (error) {
      message.classList.remove('hidden', 'text-emerald-700', 'bg-emerald-50');
      message.innerText = error.message || 'خطأ في الاتصال.';
      message.classList.add('text-rose-700', 'bg-rose-50');
    } finally {
      button.innerText = 'إرسال كلمة المرور';
      button.disabled = false;
    }
  });
})(window.MedWaste);
