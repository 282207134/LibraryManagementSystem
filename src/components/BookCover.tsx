import { useEffect, useState } from 'react';
import { resolveCoverImageUrl } from '../lib/storageHelper';

export function BookCover({ source, title, className = 'w-16 h-24' }: { source?: string | null; title: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setUrl(null);
    setFailed(false);
    void resolveCoverImageUrl(source).then(value => { if (active) setUrl(value); });
    return () => { active = false; };
  }, [source]);
  return <div className={`${className} shrink-0 overflow-hidden rounded-lg bg-slate-200 flex items-center justify-center`}>
    {url && !failed ? <img src={url} alt={title} className="w-full h-full object-cover" onError={() => setFailed(true)} /> : <span aria-label={title}>📖</span>}
  </div>;
}
