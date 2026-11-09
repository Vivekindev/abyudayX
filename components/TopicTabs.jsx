'use client';
// Tab bar for a topic page. Panels are server-rendered <section data-tab> elements; this only toggles them.
// The active tab lives in the URL hash (#deep, #fixes, #test) so links and the back button work.
import { useEffect, useRef, useState } from 'react';

export default function TopicTabs({ tabs }) {
  const [active, setActive] = useState(tabs[0].key);
  const bar = useRef(null);
  // When switching tabs from far down a long panel, bring the start of the new panel into view (below topbar + tab bar).
  const toTop = () => { const y = document.querySelector('.deep')?.getBoundingClientRect().top ?? 0; if (y < 0) scrollBy({ top: y - 120 }); };

  useEffect(() => {
    const fromHash = () => {
      const k = location.hash.slice(1);
      setActive(tabs.some(t => t.key === k) ? k : tabs[0].key);
      toTop();
    };
    fromHash();
    addEventListener('hashchange', fromHash);
    return () => removeEventListener('hashchange', fromHash);
  }, [tabs]);

  useEffect(() => {
    document.querySelectorAll('section[data-tab]').forEach(s => { s.hidden = s.dataset.tab !== active; });
  }, [active]);

  const go = k => {
    history.replaceState(null, '', k === tabs[0].key ? location.pathname : `#${k}`);
    setActive(k);
    toTop();
  };
  const onKey = (e, i) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    go(n.key);
    bar.current.querySelector(`[aria-controls="${n.key}"]`).focus();
  };

  return (
    <div className="tabs" role="tablist" aria-label="Topic layers" ref={bar}>
      {tabs.map((t, i) => (
        <button key={t.key} role="tab" aria-selected={active === t.key} aria-controls={t.key} tabIndex={active === t.key ? 0 : -1}
          onClick={() => go(t.key)} onKeyDown={e => onKey(e, i)}>
          {t.label}{t.badge && <small>{t.badge}</small>}
        </button>
      ))}
    </div>
  );
}
