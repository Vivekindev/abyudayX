import Link from 'next/link';
import { notFound } from 'next/navigation';
import Prose from '../../../components/Prose';
import { DoneBar, Notes } from '../../../components/ItemTools';
import TopicTabs from '../../../components/TopicTabs';
import { loadContent, topicLayers, topicSources, readMinutes } from '../../../lib/content.mjs';

// Every roadmap topic in order, with its phase and section.
const flat = roadmap => roadmap.flatMap(p => p.sections.flatMap(s => s.topics.map(t => ({ t, p, s }))));

export const dynamicParams = false;
export async function generateStaticParams() {
  return flat(loadContent().roadmap).map(x => ({ id: x.t.id }));
}
export function generateMetadata({ params }) {
  const x = flat(loadContent().roadmap).find(x => x.t.id === params.id);
  return { title: `${x?.t.short} · System Design Manual` };
}

export default function Page({ params }) {
  const { roadmap, items } = loadContent();
  const all = flat(roadmap);
  const idx = all.findIndex(x => x.t.id === params.id);
  if (idx < 0) notFound();
  const { t, p, s } = all[idx], prev = all[idx - 1], next = all[idx + 1];
  const layers = topicLayers(t), sources = topicSources(t);
  const tabs = layers.map(({ key, label, badge }) => ({ key, label, badge }));
  const lessons = (p.lessons || []).map(id => items.find(i => i.id === id));

  return (
    <div className="reader">
      <article>
        <header className="item-head">
          <div className="eyebrow pc" style={{ '--pc': p.color }}>
            <Link href={`/phase/${p.id}/`}>PHASE {p.num} · {p.title}</Link> · {s.t}
          </div>
          <h1>{t.title}</h1>
          <p className="read-time">⏱ {readMinutes(t)} min read · start with the 2-min layer, go deeper when you need to</p>
        </header>
        <TopicTabs tabs={tabs} />
        <div className="deep"><Prose html={layers.map(l => l.html).join('')} /></div>
        <div className="links-box">
          {sources && <div className="card"><h3>📚 Sources & further reading</h3><div className="prose src" dangerouslySetInnerHTML={{ __html: sources }} /></div>}
          <div className="card"><h3>▶ Watch</h3><ul><li><a href={t.yt} target="_blank" rel="noopener">Search YouTube for this topic</a></li></ul></div>
          {lessons.length > 0 && <div className="card"><h3>📘 Related lessons</h3>
            <ul>{lessons.map(l => <li key={l.id}><Link href={`/item/${l.id}/`}>{l.title}</Link></li>)}</ul></div>}
        </div>
        <DoneBar id={t.id} />
        <Notes id={t.id} />
        <nav className="pager">
          {prev && <Link href={`/topic/${prev.t.id}/`}><small>← PREVIOUS</small>{prev.t.title}</Link>}
          {next && <Link className="nx" href={`/topic/${next.t.id}/`}><small>NEXT →</small>{next.t.title}</Link>}
        </nav>
      </article>
      <aside className="toc"><b>Layers</b>{tabs.map(l => <a key={l.key} className="tab-link" href={`#${l.key}`}>{l.label}{l.badge && <small>{l.badge}</small>}</a>)}<a href={`/phase/${p.id}/#${t.id}`}>↩ Back to phase {p.num}</a></aside>
    </div>
  );
}
