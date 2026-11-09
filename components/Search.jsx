'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TypePill } from './ItemTools';

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function Snippet({ text, terms }) {
  const i = Math.max(0, text.toLowerCase().indexOf(terms[0]));
  const s = (i > 80 ? '…' : '') + text.slice(Math.max(0, i - 80), i + 160) + '…';
  const parts = s.split(new RegExp('(' + terms.map(reEsc).join('|') + ')', 'gi'));
  return <p>{parts.map((x, k) => terms.includes(x.toLowerCase()) ? <mark key={k}>{x}</mark> : x)}</p>;
}

export default function Search({ index }) {
  const q = (useSearchParams().get('q') || '').trim();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const res = terms.length ? index.filter(it => terms.every(t => it.hay.includes(t)))
    .sort((a, b) => b.title.toLowerCase().includes(terms[0]) - a.title.toLowerCase().includes(terms[0])) : [];
  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="eyebrow">// search</div>
      <h1 className="page-title">{res.length} result{res.length === 1 ? '' : 's'} for “{q}”</h1>
      {res.map(it => (
        <Link key={it.id} className="sr" href={it.href}>
          <div className="row"><TypePill type={it.type} /><span className="pill n">{it.where}</span><b>{it.title}</b></div>
          <Snippet text={it.text} terms={terms} />
        </Link>
      ))}
      {!res.length && <p className="muted">Nothing found. Try one keyword like "kafka", "idempotency" or "shard".</p>}
    </div>
  );
}
