'use client';
import Link from 'next/link';
import { isDue, useProgress } from './Progress';
import { PhaseCards, RoadmapTotal } from './Roadmap';

export default function Home({ items, modules, cardCount, phases, mustTopics }) {
  const p = useProgress();
  const next = items.find(i => !p.done[i.id]);
  const done = items.filter(i => p.done[i.id]).length;
  const nextMust = mustTopics.find(t => !p.done[t.id]), mustDone = mustTopics.filter(t => p.done[t.id]).length;
  const due = [...items.map(i => i.id), ...phases.flatMap(ph => ph.topicIds)].filter(id => isDue(p, id)).length;
  const count = t => items.filter(i => i.type === t).length;
  const modName = it => it.type === 'lesson' ? modules.find(m => m.id === it.module).title : it.type === 'case' ? 'HLD Case Study' : 'LLD Problem';

  return (
    <div className="wrap">
      <section className="hero">
        <div className="eyebrow">// SDE-2 System Design Companion · Bangalore 2026</div>
        <h1>Read one page a day. Walk into the round ready.</h1>
        <p className="lede">Your full roadmap of {phases.reduce((a, p) => a + p.topicIds.length, 0)} topics, each explained, plus a {items.length}-day guided plan of deep-dive lessons with diagrams, worked HLD case studies (Uber, WhatsApp, Payments…), LLD in Java, flashcards, and hand-picked videos and GitHub repos. Built for product companies and banks like Visa, JPMorgan, Morgan Stanley and Goldman Sachs.</p>
        <h2 className="section-h" style={{ margin: '0 0 2px' }}>What to do today</h2>
        <p className="muted">Interview in under a month? Do 1 and 2 daily. More time? Add 3 for the full lessons and case studies.</p>
        <div className="next-steps">
          <div className="today" style={{ borderLeftColor: 'var(--warn)' }}>
            <div className="grow">
              <div className="d">1 · 🔥 FAST TRACK · {mustDone}/{mustTopics.length} must-know topics</div>
              {nextMust ? <><h2>{nextMust.title}</h2><p>{nextMust.where} · about 2 minutes each, most-asked topics first</p></>
                : <><h2>All must-know topics done 🎉</h2><p>Now fill in the rest of each phase.</p></>}
            </div>
            <Link className="btn primary" href={nextMust ? `/topic/${nextMust.id}/` : '/roadmap/'}>{nextMust ? 'Continue →' : 'Open roadmap →'}</Link>
          </div>
          <div className="today" style={{ borderLeftColor: 'var(--ok)' }}>
            <div className="grow">
              <div className="d">2 · 🔁 REVIEW · spaced repetition</div>
              <h2>{due ? `${due} due today` : 'Nothing due today'}</h2>
              <p>Whatever you mark done comes back after 1, 4, 11 and 27 days, one question each, so it sticks until the interview.</p>
            </div>
            <Link className={'btn' + (due ? ' primary' : '')} href="/cards/#due">{due ? 'Review now →' : 'Open review'}</Link>
          </div>
          {next ? (
            <div className="today">
              <div className="grow">
                <div className="d">3 · 🗓️ GUIDED PLAN · DAY {next.day} of {items.length} · {next.minutes} min · {modName(next)}</div>
                <h2>{next.title}</h2><p>{next.summary}</p>
              </div>
              <Link className="btn primary" href={`/item/${next.id}/`}>Start Day {next.day} →</Link>
            </div>
          ) : (
            <div className="today"><div className="grow"><div className="d">3 · 🗓️ GUIDED PLAN</div><h2>🎉 All {items.length} days done.</h2><p>Now do timed mocks from the case-study list.</p></div>
              <Link className="btn primary" href="/cases/">Case studies →</Link></div>
          )}
        </div>
        <div className="stats">
          <div className="stat"><b>{mustDone}/{mustTopics.length}</b><span>🔥 must-know topics done</span></div>
          <div className="stat"><b>{done}/{items.length}</b><span>plan days completed</span></div>
          <div className="stat"><b>{count('lesson')}</b><span>lessons</span></div>
          <div className="stat"><b>{count('case')}</b><span>HLD case studies</span></div>
          <div className="stat"><b>{count('lld')}</b><span>LLD problems</span></div>
          <div className="stat"><b>{cardCount}</b><span>flashcards</span></div>
        </div>
      </section>

      <h2 className="section-h">How to use each day (≈ 60 min)</h2>
      <div className="steps">
        <div><b>Read (25–35 min).</b> Read the day's page top to bottom. Diagrams first, then text.</div>
        <div><b>Self-check (10 min).</b> Answer every <b>Q</b> box <i>out loud</i> before opening it.</div>
        <div><b>Watch (optional, 15 min).</b> One video from the "Watch" box if a concept didn't click.</div>
        <div><b>Write 3 lines.</b> Put your own summary in the notes box, then tick <b>Mark done</b>.</div>
        <div><b>Next day.</b> Open <b>Review</b>: yesterday's topics come back as one question each. Weekends, draw one case study on paper from memory.</div>
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
