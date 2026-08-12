(function (MW) {
  'use strict';
  const { Session, Auth, Contracts } = MW;
  const user = Session.getUser();
  if (!user || !Session.getToken()) return;

  const page = (window.location.pathname.split('/').pop() || 'home.html').toLowerCase();
  const actionForPage = {
    'index.html': Contracts.Actions.ADD_RECORD,
    'view.html': Contracts.Actions.GET_RECORDS,
    'reports.html': Contracts.Actions.GET_RECORDS,
    'facility_report.html': Contracts.Actions.AUTHORIZE_CLAIM,
    'reconciliation.html': Contracts.Actions.GET_RECONCILIATION,
    'admin_users.html': Contracts.Actions.GET_USERS,
    'admin_audit.html': Contracts.Actions.GET_AUDIT_LOG
  };

  const links = [
    ['home.html','الرئيسية','home'],
    ['index.html','تسجيل إدخال','plus'],
    ['view.html','سجل الرحلات','list'],
    ['reports.html','التقارير','chart'],
    ['reconciliation.html','المطابقة','balance'],
    ['facility_report.html','المطالبات','invoice'],
    ['admin_users.html','المستخدمون','users'],
    ['admin_audit.html','التدقيق','shield']
  ];

  function icon(name) {
    const paths = {
      home:'<path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
      balance:'<path d="M12 3v18M5 6h14M6 6l-4 7h8L6 6Zm12 0-4 7h8l-4-7ZM8 21h8"/>',
      invoice:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h4"/>',
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.home}</svg>`;
  }

  function allowed(href) {
    const action = actionForPage[href];
    return !action || Contracts.canRole(user.role, action);
  }

  function buildNav() {
    const nav = document.createElement('header');
    nav.className = 'app-navbar';
    nav.innerHTML = `
      <div class="app-navbar-inner">
        <a class="app-brand" href="home.html" aria-label="الصفحة الرئيسية">
          <span class="app-brand-mark">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M20 5h8v11h11v8H28v11h-8V24H9v-8h11z" fill="currentColor"/><path d="M24 3C12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21S35.6 3 24 3Z" fill="none" stroke="currentColor" stroke-width="2.2" opacity=".45"/></svg>
          </span>
          <span><strong>MedWaste-DK</strong><small>إدارة النفايات الطبية الخطرة</small></span>
        </a>
        <button class="app-nav-toggle" type="button" aria-expanded="false" aria-controls="appNavLinks"><span></span><span></span><span></span></button>
        <nav class="app-nav-links" id="appNavLinks" aria-label="التنقل الرئيسي">
          ${links.filter(([href])=>allowed(href)).map(([href,label,ico])=>`<a href="${href}" class="app-nav-link ${page===href?'is-active':''}">${icon(ico)}<span>${label}</span></a>`).join('')}
        </nav>
        <div class="app-user-area">
          <button type="button" class="app-user-chip" id="appUserChip" aria-expanded="false">
            <span class="app-avatar">${String(user.fullName||'م').trim().charAt(0)||'م'}</span>
            <span class="app-user-text"><strong>${escapeHtml(user.fullName||'مستخدم')}</strong><small>${escapeHtml(user.role||'')}</small></span>
            <span class="app-chevron">⌄</span>
          </button>
          <div class="app-user-menu" id="appUserMenu">
            <div><strong>${escapeHtml(user.entityName||'')}</strong><small>${escapeHtml(user.email||'')}</small></div>
            <button type="button" id="appLogoutButton">تسجيل الخروج</button>
          </div>
        </div>
      </div>`;
    document.body.prepend(nav);
    const toggle = nav.querySelector('.app-nav-toggle');
    const linksBox = nav.querySelector('#appNavLinks');
    toggle.addEventListener('click',()=>{
      const open = nav.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded',String(open));
      linksBox?.setAttribute('data-open',String(open));
    });
    nav.querySelectorAll('.app-nav-link').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('nav-open')));
    const chip=nav.querySelector('#appUserChip'),menu=nav.querySelector('#appUserMenu');
    chip?.addEventListener('click',(e)=>{e.stopPropagation();const open=menu.classList.toggle('is-open');chip.setAttribute('aria-expanded',String(open));});
    document.addEventListener('click',()=>{menu?.classList.remove('is-open');chip?.setAttribute('aria-expanded','false');});
    nav.querySelector('#appLogoutButton')?.addEventListener('click',()=>Auth.logout());
  }

  function buildFooter() {
    if (document.querySelector('.app-footer')) return;
    const footer=document.createElement('footer');
    footer.className='app-footer';
    footer.innerHTML=`
      <div class="app-footer-inner">
        <div class="app-footer-brand"><span class="footer-dot"></span><div><strong>منظومة إدارة النفايات الطبية الخطرة</strong><small>مديرية الشؤون الصحية بالدقهلية — وحدة إدارة النفايات</small></div></div>
        <div class="app-footer-meta"><span>فكرة وتطوير <strong dir="ltr">Dr Ahmad Adel</strong></span><span class="footer-divider"></span><span>مدير الوحدة: <strong>د. محمد البدوى</strong></span><a href="tel:01002876061" dir="ltr">01002876061</a></div>
      </div>`;
    document.body.appendChild(footer);
  }

  function hideLegacyNav() {
    document.querySelectorAll('.flex.flex-wrap.gap-2.justify-center').forEach(el=>el.classList.add('legacy-nav-strip'));
    document.querySelectorAll('div[class*="bg-gradient-to-r"]').forEach(header=>{
      const anchors=[...header.querySelectorAll('a[href$=".html"]')];
      if(anchors.length>=2){
        const parent=anchors[0].parentElement;
        if(parent&&anchors.every(a=>a.parentElement===parent))parent.classList.add('legacy-nav-strip');
      }
    });
  }

  function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}

  document.addEventListener('DOMContentLoaded',()=>{buildNav();hideLegacyNav();buildFooter();document.body.classList.add('has-app-shell');});
})(window.MedWaste);
