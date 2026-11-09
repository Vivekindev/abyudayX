import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionCount, TopicCard } from '../../../components/Roadmap';
import { loadContent, slug } from '../../../lib/content.mjs';

export const dynamicParams = false;
export async function generateStaticParams() {
  return loadContent().roadmap.map(p => ({ id: p.id }));
}
export function generateMetadata({ params }) {
  const p = loadContent().roadmap.find(x => x.id === params.id);
  return { title: `Phase ${p?.num} · ${p?.title} · System Design Manual` };
}

export default function Page({ params }) {
  const { roadmap, items } = loadContent();
  const idx = roadmap.findIndex(p => p.id === params.id);
  if (idx < 0) notFound();
  const ph = roadmap[idx], prev = roadmap[idx - 1], next = roadmap[idx + 1];
  const lessons = (ph.lessons || []).map(id => items.find(i => i.id === id));
  const total = ph.sections.reduce((a, s) => a + s.topics.length, 0);

  return (
    <div className="reader">
      <article>
        <header className="item-head">
          <div className="eyebrow pc" style={{ '--pc': ph.color }}>PHASE {ph.num} · {ph.est} · {total} topics</div>
          <h1>{ph.title}</h1>
          <p className="sum">{ph.pri}</p>
        </header>

        <div className="row" style={{ marginBottom: 16 }}>
          <Link className="btn primary" href={`/topic/${ph.sections[0].topics[0].id}/`}>📘 Start the deep dives</Link>
          <Link className="btn" href={`/revise/${ph.id}/`}>⚡ Revision sheet: cheat sheets, fixes, interview questions</Link>
        </div>

        {lessons.length > 0 && (
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '.95rem', marginBottom: 8 }}>📘 Deep-dive lessons for this phase (diagrams, worked examples, self-check)</h3>
            <div className="row">{lessons.map(l => <Link key={l.id} className="btn" href={`/item/${l.id}/`}>{l.title}</Link>)}</div>
          </div>
        )}

        {ph.sections.map(s => (
          <section key={s.t}>
            <h2 className="section-h" id={slug(s.t)}>{s.t} <SectionCount ids={s.topics.map(t => t.id)} /></h2>
            {s.topics.map(({ deep, ...t }) => <TopicCard key={t.id} t={t} />)}
          </section>
        ))}

        {ph.note && <blockquote className="phase-note">💡 {ph.note}</blockquote>}

        <nav className="pager">
          {prev && <Link href={`/phase/${prev.id}/`}><small>← PHASE {prev.num}</small>{prev.title}</Link>}
          {next && <Link className="nx" href={`/phase/${next.id}/`}><small>PHASE {next.num} →</small>{next.title}</Link>}
        </nav>
      </article>
      <aside className="toc"><b>Sections</b>{ph.sections.map(s => <a key={s.t} href={`#${slug(s.t)}`}>{s.t}</a>)}<a href="/roadmap/">↩ All phases</a></aside>
    </div>
  );
}
