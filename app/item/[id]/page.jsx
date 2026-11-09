import Link from 'next/link';
import { notFound } from 'next/navigation';
import Prose from '../../../components/Prose';
import { DoneBar, Notes } from '../../../components/ItemTools';
import { loadContent, renderItem } from '../../../lib/content.mjs';

export const dynamicParams = false;
export async function generateStaticParams() {
  return loadContent().items.map(i => ({ id: i.id }));
}
export function generateMetadata({ params }) {
  const it = loadContent().items.find(i => i.id === params.id);
  return { title: `${it?.title} · System Design Manual`, description: it?.summary };
}

export default function Page({ params }) {
  const { items, modules } = loadContent();
  const idx = items.findIndex(i => i.id === params.id);
  if (idx < 0) notFound();
  const it = items[idx], prev = items[idx - 1], next = items[idx + 1];
  const { html, toc } = renderItem(it);
  const where = it.type === 'lesson' ? modules.find(m => m.id === it.module).title : it.type === 'case' ? 'HLD Case Study' : 'LLD Problem';

  return (
    <div className="reader">
      <article>
        <header className="item-head">
          <div className="eyebrow">DAY {it.day} · {where} · {it.minutes} min read</div>
          <h1>{it.title}</h1>
          <p className="sum">{it.summary}</p>
        </header>
        <Prose html={html} />
        {(it.videos.length > 0 || it.read.length > 0) && (
          <div className="links-box">
            {it.videos.length > 0 && <div className="card"><h3>▶ Watch (opens a YouTube search, so you pick the newest upload)</h3>
              <ul>{it.videos.map(v => <li key={v.url}><a href={v.url} target="_blank" rel="noopener">{v.label}</a></li>)}</ul></div>}
            {it.read.length > 0 && <div className="card"><h3>📖 Read deeper</h3>
              <ul>{it.read.map(v => <li key={v.url}><a href={v.url} target="_blank" rel="noopener">{v.label}</a></li>)}</ul></div>}
          </div>
        )}
        <DoneBar id={it.id} />
        <Notes id={it.id} />
        <nav className="pager">
          {prev && <Link href={`/item/${prev.id}/`}><small>← DAY {prev.day}</small>{prev.title}</Link>}
          {next && <Link className="nx" href={`/item/${next.id}/`}><small>DAY {next.day} →</small>{next.title}</Link>}
        </nav>
      </article>
      {toc.length > 2 && <aside className="toc"><b>On this page</b>{toc.map(h => <a key={h.id} href={`#${h.id}`}>{h.text}</a>)}</aside>}
    </div>
  );
}
