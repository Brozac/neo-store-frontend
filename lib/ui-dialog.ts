// ═══════════════════════════════════════════════════════════════════════════
// F#72 · MWG dialog — خدمة تنبيه/تأكيد native بـ <dialog> بلاصة alert/confirm
// المرجع: modern-web-guidance → retrieve dialog / light-dismiss-a-dialog
//   - showModal() من السكريبت + <form method="dialog"> للإغلاق بـ returnValue
//   - autofocus على الزر الآمن (Cancel) فالتأكيد الخطير (قاعدة MWG)
//   - ما كاينش role="dialog" ولا aria-modal ولا focus trap يدوي — المتصفح كيوفرهم
//   - overscroll-behavior: contain إلزامي (الـCSS فـ globals.css) باش السكرول
//     مات chainingاش للصفحة من الـdialog ولا الـ::backdrop
//   - closedby="any": click-outside كيسد (تدهور سلس فمتصفحات ما كتعرفوش —
//     Esc وback gesture خدامين ديما بلا closedby)
// ═══════════════════════════════════════════════════════════════════════════

type ConfirmOptions = {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type AlertOptions = {
  title?: string;
  okText?: string;
};

type DlgButton = {
  value: string;
  label: string;
  variant: 'primary' | 'danger' | 'ghost';
  autoFocus?: boolean;
};

function openDialog(opts: { title: string; message: string; buttons: DlgButton[] }): Promise<string> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ui-dlg';
    dlg.setAttribute('aria-labelledby', 'ui-dlg-title');
    dlg.setAttribute('closedby', 'any');

    const h2 = document.createElement('h2');
    h2.id = 'ui-dlg-title';
    h2.className = 'ui-dlg-title';
    h2.textContent = opts.title;
    dlg.appendChild(h2);

    const p = document.createElement('p');
    p.className = 'ui-dlg-msg';
    p.textContent = opts.message; // textContent = آمن ضد XSS — رسائل الأخطاء ديال السيرفر كيدخلو هنا
    dlg.appendChild(p);

    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'ui-dlg-row';
    for (const b of opts.buttons) {
      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.value = b.value;
      btn.className = `ui-dlg-btn ${b.variant}`;
      btn.textContent = b.label;
      if (b.autoFocus) btn.setAttribute('autofocus', '');
      form.appendChild(btn);
    }
    dlg.appendChild(form);

    const finish = (val: string) => {
      dlg.returnValue = ''; // MWG: reset باش القيمة القديمة ما تتسربش للنداء الجاي
      dlg.removeEventListener('close', onClose);
      dlg.remove();
      resolve(val);
    };
    const onClose = () => finish(dlg.returnValue);
    dlg.addEventListener('close', onClose);

    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

/** بديل window.confirm — Promise<boolean>: true غير إلا ضغط المستخدم زر التأكيد */
export function uiConfirm(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
  const { title = 'Please Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = opts;
  return openDialog({
    title,
    message,
    buttons: [
      { value: 'cancel', label: cancelText, variant: 'ghost', autoFocus: true }, // الزر الآمن auto-focus
      { value: 'confirm', label: confirmText, variant: danger ? 'danger' : 'primary' },
    ],
  }).then((v) => v === 'confirm');
}

/** بديل window.alert — كيتحل فالإغلاق */
export function uiAlert(message: string, opts: AlertOptions = {}): Promise<void> {
  const { title = 'Notice', okText = 'OK' } = opts;
  return openDialog({
    title,
    message,
    buttons: [{ value: 'ok', label: okText, variant: 'primary', autoFocus: true }],
  }).then(() => undefined);
}
