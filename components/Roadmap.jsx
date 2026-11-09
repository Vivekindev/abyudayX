'use client';
import Link from 'next/link';
import { useProgress } from './Progress';

const count = (done, ids) => ids.filter(id => done[id]).length;

export function PhaseCards({ phases }) {
  const p = useProgress();
  return (
    <div className="phase-list">
      {phases.map(ph => {
        const d = count(p.done, ph.topicIds), pct = Math.round(d / ph.topicIds.length * 100);
        return (
          <Link key={ph.id} href={`/phase/${ph.id}/`} className={'phase-card' + (pct === 100 ? ' done' : '')} style={{ borderLeftColor: ph.color }}>
            <div className="phase-num pc" style={{ '--pc': ph.color }}>{ph.num}</div>
            <div className="phase-info">
              <div className="meta"><span className="pill n">{ph.est}</span><span className="pill pc" style={{ '--pc': ph.color }}>{ph.badge}</span></div>
              <h3>{ph.title}</h3>
              <p>{ph.pri}</p>
            </div>
            <div className="phase-prog"><b>{d}/{ph.topicIds.length}</b><div className="progress"><div style={{ width: pct + '%', background: ph.color }} /></div></div>
          </Link>
        );
      })}
    </div>
  );
}

export function RoadmapTotal({ ids }) {
  const p = useProgress();
  const d = count(p.done, ids), pct = Math.round(d / ids.length * 100);
  return (
    <div className="stat" style={{ maxWidth: 420 }}>
      <b>{d}/{ids.length}</b><span>roadmap topics done · {pct}%</span>
      <div className="progress"><div style={{ width: pct + '%' }} /></div>
    </div>
  );
}

export function SectionCount({ ids }) {
  const p = useProgress();
  return <span className="muted">{count(p.done, ids)}/{ids.length}</span>;
}

export function TopicCard({ t }) {
  const p = useProgress();
  const done = !!p.done[t.id];
  return (
    <div className={'topic' + (done ? ' done' : '')} id={t.id}>
      <div className="topic-head">
        <button className={'chk' + (done ? ' on' : '')} onClick={() => p.toggleDone(t.id)} aria-label={`Mark "${t.short}" done`}>✓</button>
        <h3>{t.title}</h3>
      </div>
      <div className="topic-body prose" dangerouslySetInnerHTML={{ __html: t.html }} />
      <div className="topic-foot"><Link className="deep-link" href={`/topic/${t.id}/`}>📘 Deep dive: theory, diagram, example →</Link><a href={t.yt} target="_blank" rel="noopener">▶ Videos on this topic</a></div>
    </div>
  );
}
