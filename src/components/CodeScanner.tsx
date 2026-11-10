import { useEffect, useRef, useState } from 'react';
import { normalizePickupCode } from '../lib/borrowing';
import { useLanguage } from '../contexts/LanguageContext';

export function CodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState('');
  const { language } = useLanguage();
  const t = {
    zh: { title: '扫描借阅凭证', hint: '对准二维码或条形码，识别后会显示申请供你核对。', unavailable: '无法打开摄像头，请允许摄像头权限，或使用扫码枪、手动输入数字码。', invalid: '此码不是 8 位借阅数字码，请扫描借阅凭证。', close: '关闭摄像头' },
    en: { title: 'Scan library pass', hint: 'Scan a QR code or barcode to review the request.', unavailable: 'Camera unavailable. Allow access, use a scanner, or enter the code.', invalid: 'Scan an 8-digit library pass.', close: 'Close camera' },
    ja: { title: 'コードを読み取る', hint: 'QRコードまたはバーコードを読み取り、内容を確認してください。', unavailable: 'カメラを利用できません。権限を許可するか、スキャナー・数字入力をご利用ください。', invalid: '8桁の貸出受付コードを読み取ってください。', close: 'カメラを閉じる' },
  }[language];
  useEffect(() => {
    let cancelled = false;
    let finished = false;
    let controls: { stop: () => void } | undefined;
    const element = video.current;
    const stop = () => {
      controls?.stop();
      const stream = element?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach(track => track.stop());
      if (element) element.srcObject = null;
    };
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !element) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, element, (result, _error, scannerControls) => {
          if (!result || cancelled || finished) return;
          const code = normalizePickupCode(result.getText());
          if (!code) { setError(t.invalid); return; }
          finished = true;
          scannerControls.stop();
          onCodeRef.current(code);
        });
        if (cancelled || finished) stop();
      } catch { if (!cancelled) setError(t.unavailable); }
    })();
    return () => { cancelled = true; stop(); };
  }, [t.invalid, t.unavailable]);
  return (
    <section aria-label={t.title} className="mt-4 rounded-xl border border-slate-400 p-4">
      <div className="flex justify-between items-center gap-3">
        <h3 className="font-semibold">{t.title}</h3>
        <button type="button" onClick={onClose} className="border rounded-lg px-3 py-2">{t.close}</button>
      </div>
      <p className="my-2 text-sm">{t.hint}</p>
      <video ref={video} muted playsInline className="w-full max-w-md aspect-video rounded-lg bg-black" />
      {error && <p role="alert" className="mt-3 text-rose-500">{error}</p>}
    </section>
  );
}
