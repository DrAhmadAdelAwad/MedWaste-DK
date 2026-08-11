# MedWaste-DK — Stage 1: HTML / CSS / JavaScript Separation

## الهدف
فصل طبقات الواجهة بدون تغيير منطق العمل الحالي أو عقد الاتصال مع Google Apps Script.

## الهيكل الحالي

```text
MedWaste-DK-main/
├── index.html
├── login.html
├── register.html
├── forgot_password.html
├── view.html
├── reports.html
├── facility_report.html
├── admin_users.html
├── Code.gs
└── assets/
    ├── css/
    │   ├── base.css
    │   └── pages/
    │       └── facility_report.css
    └── js/
        ├── config/
        │   └── app-config.js
        ├── common/
        │   └── access-control.js
        └── pages/
            ├── index.js
            ├── login.js
            ├── register.js
            ├── forgot_password.js
            ├── view.js
            ├── reports.js
            ├── facility_report.js
            └── admin_users.js
```

## ما تم في Stage 1
- إزالة جميع كتل `<style>` الداخلية من صفحات HTML.
- إزالة جميع كتل JavaScript الداخلية من صفحات HTML.
- إزالة جميع `onclick` / `onchange` / `onkeyup` الثابتة من HTML وربطها من JavaScript.
- إنشاء `assets/css/base.css` للقواعد المشتركة.
- إبقاء CSS الخاص بالطباعة في `facility_report.css` فقط.
- نقل إعداد الاتصال إلى `assets/js/config/app-config.js`.
- استخراج طبقة صلاحيات الواجهة المشتركة إلى `assets/js/common/access-control.js`.
- إنشاء ملف JavaScript مستقل لكل صفحة.
- عدم تعديل `Code.gs` أو منطق Google Sheets في هذه المرحلة.

## حدود Stage 1 المتعمدة
لم يتم حتى الآن تقسيم ملفات JavaScript الكبيرة داخلياً إلى Services / Storage / API / Sync / UI Modules. هذا هو نطاق المرحلة التالية حتى لا نمزج الفصل الهيكلي الأول مع إعادة تصميم منطق التطبيق دفعة واحدة.
