import { DoneCount, ItemGrid } from '../../components/ItemTools';
import { loadContent, meta } from '../../lib/content.mjs';

export const metadata = { title: 'Lessons · System Design Manual' };

export default function Page() {
  const { items, modules } = loadContent();
  return (
    <div className="wrap">
      <div className="eyebrow">// concepts</div>
      <h1 className="page-title">Lessons by module</h1>
      <p className="lede">The same lessons as the plan, grouped by topic. Use this view for revision.</p>
      {modules.map(m => {
        const ls = items.filter(i => i.module === m.id && i.type === 'lesson').map(meta);
        return (
          <section key={m.id}>
            <h2 className="section-h" id={`m-${m.id}`}>
              <span className="pill pc" style={{ '--pc': m.color }}>{m.num}</span>{m.title} <DoneCount ids={ls.map(l => l.id)} />
            </h2>
            <p className="muted" style={{ margin: '-6px 0 12px' }}>{m.blurb}</p>
            <ItemGrid items={ls} />
          </section>
        );
      })}
    </div>
  );
}
