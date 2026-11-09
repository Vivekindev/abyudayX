'use client';
import Link from 'next/link';
import { useProgress } from './Progress';

const TYPE = { lesson: ['Lesson', ''], case: ['HLD case', 'w'], lld: ['LLD', 'g'], topic: ['Roadmap topic', 'n'] };
export const TypePill = ({ type }) => <span className={'pill ' + TYPE[type][1]}>{TYPE[type][0]}</span>;

export function DoneBar({ id }) {
  const p = useProgress();
  const done = !!p.done[id];
  return (
    <div className="done-bar">
      <div><b>Finished reading?</b><div className="muted">Tick it off after you've answered the self-check out loud.</div></div>
      <button className={'btn ' + (done ? 'ok' : 'primary')} onClick={() => p.toggleDone(id)}>{done ? '✓ Done' : 'Mark done'}</button>
    </div>
  );
}

export function Notes({ id }) {
  const p = useProgress();
  return (
    <div className="notes"><b>My notes</b> <span className="muted">(saved automatically in this browser)</span>
      <textarea value={p.notes[id] || ''} onChange={e => p.setNote(id, e.target.value)} disabled={!p.ready}
        placeholder="Write the 3 things you'd say in an interview about this…" />
    </div>
  );
}

export function ItemCard({ it }) {
  const p = useProgress();
  return (
    <Link className={'card' + (p.done[it.id] ? ' done' : '')} href={`/item/${it.id}/`}>
      <div className="meta"><span className="pill n">Day {it.day}</span><TypePill type={it.type} /><span className="pill n">{it.minutes}m</span></div>
      <h3>{it.title}</h3><p>{it.summary}</p>
    </Link>
  );
}

export const ItemGrid = ({ items }) => <div className="grid">{items.map(it => <ItemCard key={it.id} it={it} />)}</div>;

export function DoneCount({ ids }) {
  const p = useProgress();
  return <span className="muted">{ids.filter(id => p.done[id]).length}/{ids.length}</span>;
}

export function PlanList({ items }) {
  const p = useProgress();
  const weeks = [];
  items.forEach(it => { const w = Math.ceil(it.day / 7) - 1; (weeks[w] ||= []).push(it); });
  return weeks.map((w, i) => (
    <section className="week" key={i}>
      <h2>WEEK {i + 1} · {w.filter(it => p.done[it.id]).length}/{w.length} done</h2>
      {w.map(it => (
        <div key={it.id} className={'dayrow' + (p.done[it.id] ? ' done' : '')}>
          <button className={'chk' + (p.done[it.id] ? ' on' : '')} onClick={() => p.toggleDone(it.id)} aria-label={`Toggle done for ${it.title}`}>✓</button>
          <span className="dn">DAY {it.day}</span>
          <Link href={`/item/${it.id}/`}>{it.tags.includes('star') ? '⭐ ' : ''}{it.title}</Link>
          <span className="typ"><TypePill type={it.type} /></span><span className="pill n mins">{it.minutes}m</span>
        </div>
      ))}
    </section>
  ));
}
