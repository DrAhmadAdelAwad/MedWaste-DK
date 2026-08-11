(function (MW) {
  'use strict';

  const { Auth } = MW;

  document.getElementById('registerForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('submitBtn');
    const message = document.getElementById('statusMsg');
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      message.innerText = 'كلمتا المرور غير متطابقتين';
      message.classList.remove('hidden');
      return;
    }

    button.innerText = 'جاري تسجيل البيانات...';
    button.disabled = true;

    try {
      await Auth.register({
        fullName: document.getElementById('fullName').value,
        jobTitle: document.getElementById('jobTitle').value,
        workplace: document.getElementById('workplace').value,
        mobile: document.getElementById('mobile').value,
        email: document.getElementById('email').value,
        password
      });
      alert('تم التسجيل بنجاح! يمكنك الآن تسجيل الدخول.');
      window.location.href = 'login.html';
    } catch (error) {
      message.innerText = error.message || 'خطأ في الاتصال بالخادم';
      message.classList.remove('hidden');
      button.innerText = 'تأكيد وإنشاء الحساب';
      button.disabled = false;
    }
  });
})(window.MedWaste);
