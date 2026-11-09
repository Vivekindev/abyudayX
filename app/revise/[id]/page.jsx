import Link from 'next/link';
import { notFound } from 'next/navigation';
import Prose from '../../../components/Prose';
import { loadContent, renderPage, deepSection, slug } from '../../../lib/content.mjs';

export const dynamicParams = false;
export async function generateStaticParams() {
  return loadContent().roadmap.map(p => ({ id: p.id }));
}
export function generateMetadata({ params }) {
  const p = loadContent().roadmap.find(x => x.id === params.id);
  return { title: `Revision · Phase ${p?.num} · System Design Manual` };
}

// One page per phase: every topic's cheat sheet, problems & fixes and interview questions.
export default function Page({ params }) {
  const { roadmap } = loadContent();
  const p = roadmap.find(x => x.id === params.id);
  if (!p) notFound();
  const md = p.sections.map(s => `## ${s.t}\n\n` + s.topics.filter(t => t.deep).map(t => {
    const part = (name, label) => { const b = deepSection(t.deep, name); return b ? `**${label}**\n\n${b}\n\n` : ''; };
    return `### ${t.short}\n\n[Full deep dive →](/topic/${t.id}/)\n\n` + part('Cheat sheet', '⚡ Cheat sheet') + part('Problems & fixes', '🛠 Problems & fixes') + part('Interview questions', '🎯 Interview questions');
  }).join('\n')).join('\n');
  const { html } = renderPage(md);
  const ready = p.sections.reduce((a, s) => a + s.topics.filter(t => t.deep).length, 0);
  const total = p.sections.reduce((a, s) => a + s.topics.length, 0);

  return (
    <div className="reader">
      <article>
        <header className="item-head">
          <div className="eyebrow pc" style={{ '--pc': p.color }}><Link href={`/phase/${p.id}/`}>PHASE {p.num} · {p.title}</Link></div>
          <h1>Revision sheet</h1>
          <p className="sum">Cheat sheets, common problems with their fixes, and scenario interview questions for every topic in this phase. Read it the night before an interview. Open a question to check your answer. {ready < total && `(${ready}/${total} topics written so far.)`}</p>
        </header>
        <div className="revise"><Prose html={html} /></div>
      </article>
      <aside className="toc"><b>Sections</b>{p.sections.map(s => <a key={s.t} href={`#${slug(s.t)}`}>{s.t}</a>)}<a href={`/phase/${p.id}/`}>↩ Phase {p.num}</a></aside>
    </div>
  );
}
