(function (MW) {
  'use strict';

  const { Session, Auth } = MW;
  if (Session.isLoggedIn()) {
    window.location.href = 'home.html';
    return;
  }

  /* Warm the Apps Script runtime while the user is typing. */
  window.setTimeout(()=>{try{MW.Api?.health?.().catch(()=>{});}catch(_){}},50);

  document.getElementById('loginForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.getElementById('submitBtn');
    const message = document.getElementById('statusMsg');
    button.innerText = 'جاري تسجيل الدخول...';
    button.disabled = true;

    try {
      await Auth.login(
        document.getElementById('email').value,
        document.getElementById('password').value
      );
      window.location.href = 'home.html';
    } catch (error) {
      message.innerText = error.message || 'خطأ في الاتصال بالخادم';
      message.classList.remove('hidden');
      button.innerText = 'دخول';
      button.disabled = false;
    }
  });
})(window.MedWaste);
