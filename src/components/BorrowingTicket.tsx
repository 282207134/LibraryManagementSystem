import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { useLanguage } from '../contexts/LanguageContext';

export function BorrowingTicket({ code }: { code: string }) {
  const { language } = useLanguage();
  const barcode = useRef<SVGSVGElement>(null);
  const [copied, setCopied] = useState(false);
  const t = {
    zh: { title: '借阅凭证', hint: '到馆出示此码，由管理员核对后确认借出；归还时也可使用。', copy: '复制数字码', copied: '已复制', select: '请长按或选中数字复制' },
    en: { title: 'Library pass', hint: 'Show this pass at the library. Staff confirm checkout and return.', copy: 'Copy code', copied: 'Copied', select: 'Select the number to copy it' },
    ja: { title: '貸出受付コード', hint: '来館時に提示してください。職員が確認して貸出・返却を行います。', copy: 'コードをコピー', copied: 'コピー済み', select: '数字を選択してコピーしてください' },
  }[language];
  useEffect(() => {
    if (barcode.current) JsBarcode(barcode.current, code, {
      format: 'CODE128', width: 2, height: 48, displayValue: false, margin: 12,
      background: '#ffffff', lineColor: '#000000',
    });
  }, [code]);
  return (
    <section className="borrowing-ticket mt-4 rounded-xl border border-slate-300 p-4" aria-label={t.title}>
      <p className="font-semibold">{t.title}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div className="scan-code-paper rounded-lg p-2">
          <QRCodeSVG value={code} size={120} marginSize={4} title={t.title} bgColor="#ffffff" fgColor="#000000" />
        </div>
        <div className="min-w-0 max-w-full">
          <svg ref={barcode} className="scan-code-paper max-w-full h-auto" role="img" aria-label={`${t.title} ${code}`} />
          <p className="mt-1 font-mono text-2xl font-bold tracking-[0.18em] select-all" data-testid="pickup-code">{code}</p>
          <button type="button" className="mt-2 text-sm underline" onClick={async () => {
            try { await navigator.clipboard.writeText(code); setCopied(true); }
            catch { alert(t.select); }
          }}>{copied ? t.copied : t.copy}</button>
        </div>
      </div>
      <p className="mt-3 text-sm opacity-80">{t.hint}</p>
    </section>
  );
}
