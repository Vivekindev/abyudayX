'use client';
import Link from 'next/link';
import { useProgress } from './Progress';
import { PhaseCards, RoadmapTotal } from './Roadmap';

export default function Home({ items, modules, cardCount, phases }) {
  const p = useProgress();
  const next = items.find(i => !p.done[i.id]);
  const done = items.filter(i => p.done[i.id]).length;
  const count = t => items.filter(i => i.type === t).length;
  const modName = it => it.type === 'lesson' ? modules.find(m => m.id === it.module).title : it.type === 'case' ? 'HLD Case Study' : 'LLD Problem';

  return (
    <div className="wrap">
      <section className="hero">
        <div className="eyebrow">// SDE-2 System Design Companion · Bangalore 2026</div>
        <h1>Read one page a day. Walk into the round ready.</h1>
        <p className="lede" style={{ margin: 0 }}>Your full roadmap of {phases.reduce((a, p) => a + p.topicIds.length, 0)} topics, each explained, plus a {items.length}-day guided plan of deep-dive lessons with diagrams, worked HLD case studies (Uber, WhatsApp, Payments…), LLD in Java, flashcards, and hand-picked videos and GitHub repos. Built for product companies and banks like Visa, JPMorgan, Morgan Stanley and Goldman Sachs.</p>
        <div className="stats">
          <div className="stat"><b>{phases.reduce((a, ph) => a + ph.topicIds.filter(id => p.done[id]).length, 0)}</b><span>roadmap topics done</span></div>
          <div className="stat"><b>{done}/{items.length}</b><span>plan days completed</span></div>
          <div className="stat"><b>{count('lesson')}</b><span>lessons</span></div>
          <div className="stat"><b>{count('case')}</b><span>HLD case studies</span></div>
          <div className="stat"><b>{count('lld')}</b><span>LLD problems</span></div>
          <div className="stat"><b>{cardCount}</b><span>flashcards</span></div>
        </div>
        {next ? (
          <div className="today">
            <div className="grow">
              <div className="d">TODAY · DAY {next.day} · {next.minutes} min · {modName(next)}</div>
              <h2>{next.title}</h2><p>{next.summary}</p>
            </div>
            <Link className="btn primary" href={`/item/${next.id}/`}>Start Day {next.day} →</Link>
          </div>
        ) : (
          <div className="today"><div className="grow"><h2>🎉 All {items.length} days done.</h2><p>Now do flashcards and timed mocks from the case-study list.</p></div>
            <Link className="btn primary" href="/cards/">Flashcards →</Link></div>
        )}
      </section>

      <h2 className="section-h">How to use each day (≈ 60 min)</h2>
      <div className="steps">
        <div><b>Read (25–35 min).</b> Read the day's page top to bottom. Diagrams first, then text.</div>
        <div><b>Self-check (10 min).</b> Answer every <b>Q</b> box <i>out loud</i> before opening it.</div>
        <div><b>Watch (optional, 15 min).</b> One video from the "Watch" box if a concept didn't click.</div>
        <div><b>Write 3 lines.</b> Put your own summary in the notes box, then tick <b>Mark done</b>.</div>
        <div><b>Weekend.</b> Redo the week's flashcards. Draw one case study on paper from memory.</div>
      </div>

      <h2 className="section-h">📍 Roadmap: your 12 phases + Fintech + LLD</h2>
      <RoadmapTotal ids={phases.flatMap(ph => ph.topicIds)} />
      <div style={{ height: 14 }} />
      <PhaseCards phases={phases} />

      <h2 className="section-h">📘 Deep-dive lesson modules</h2>
      <div className="grid">
        {modules.map(m => {
          const ls = items.filter(i => i.module === m.id && i.type === 'lesson');
          const pct = Math.round(ls.filter(i => p.done[i.id]).length / ls.length * 100) || 0;
          return (
            <Link key={m.id} className="card" href={`/learn/#m-${m.id}`} style={{ borderTop: `3px solid ${m.color}` }}>
              <div className="meta"><span className="pill n">{m.num}</span><span className="pill n">{ls.length} lessons</span></div>
              <h3>{m.title}</h3><p>{m.blurb}</p>
              <div className="progress"><div style={{ width: pct + '%', background: m.color }} /></div>
            </Link>
          );
        })}
      </div>
      <p className="muted" style={{ marginTop: 28 }}>Progress is saved in this browser. Use <b>Export progress</b> in the sidebar to move it to another device.</p>
    </div>
  );
}
