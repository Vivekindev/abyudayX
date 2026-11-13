'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useProgress } from './Progress';

const NAV = [
  ['/', '🏠 Today'], ['/roadmap/', '📍 Roadmap (654 topics)'], ['/ref/interview/', '🎯 Interview prep'],
  ['/plan/', '🗓️ Day-by-day plan'], ['/learn/', '📘 Deep-dive lessons'],
  ['/cases/', '🏗️ HLD case studies'], ['/lld/', '🧩 LLD problems'], ['/cards/', '🃏 Flashcards & review'],
];
const REF = [['/ref/cheatsheet/', '⚡ Cheat sheet'], ['/ref/companies/', '🏢 Company playbook'],
  ['/ref/resources/', '📚 Resources & GitHub'], ['/ref/changes/', '🔁 What changed vs v1']];

export default function Shell({ planIds, children }) {
  const p = useProgress();
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const qRef = useRef(null);
  const pct = Math.round(planIds.filter(id => p.done[id]).length / planIds.length * 100);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); qRef.current?.focus(); } };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, []);

  const search = e => { e.preventDefault(); if (q.trim()) router.push('/search/?q=' + encodeURIComponent(q.trim())); };
  const toggleTheme = () => {
    const t = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('sdm_theme', t); } catch {}
    dispatchEvent(new Event('themechange'));
  };
  const exportProgress = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ done: p.done, notes: p.notes, known: p.known, rev: p.rev }, null, 2)], { type: 'application/json' }));
    a.download = 'sysdesign-progress.json'; a.click();
  };
  const importProgress = async e => {
    try {
      const d = JSON.parse(await e.target.files[0].text());
      if (!d || typeof d.done !== 'object') throw new Error();
      p.replaceAll(d); alert('Progress imported');
    } catch { alert('That file is not a progress export'); }
    e.target.value = '';
  };
  const link = ([href, label]) => <Link key={href} href={href} className={path === href ? 'active' : ''}>{label}</Link>;

  return (
    <>
      <header className="top">
        <button className="icon-btn only-mobile" onClick={() => setOpen(o => !o)} aria-label="Open menu">☰</button>
        <Link href="/" className="brand">sys<span>://</span>manual<small>.sde2</small></Link>
        <form className="top-search" onSubmit={search} role="search">
          <input ref={qRef} type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search lessons, case studies…  ( / )" aria-label="Search" />
        </form>
        <div className="top-progress" title="Day-by-day plan progress"><div className="bar"><div style={{ width: pct + '%' }} /></div><span>{pct}%</span></div>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle theme">◐</button>
      </header>
      <div className="layout">
        <nav className={'side' + (open ? ' open' : '')} aria-label="Main">
          {NAV.map(link)}
          <div className="side-h">Reference</div>
          {REF.map(link)}
          <div className="side-h">Data</div>
          <button className="side-btn" onClick={exportProgress}>⬇ Export progress</button>
          <label className="side-btn">⬆ Import progress<input type="file" accept="application/json" hidden onChange={importProgress} /></label>
        </nav>
        <div className={'scrim' + (open ? ' open' : '')} onClick={() => setOpen(false)} />
        <main id="main">{children}</main>
      </div>
    </>
  );
}
