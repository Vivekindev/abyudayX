import { ItemGrid } from '../../components/ItemTools';
import { loadContent, meta } from '../../lib/content.mjs';

export const metadata = { title: 'HLD case studies · System Design Manual' };
const TIER = { 1: 'Tier 1 — Warm-up (build confidence)', 2: 'Tier 2 — Core SDE-2 (most asked)', 3: 'Tier 3 — Advanced & fintech (stand out)' };

export default function Page() {
  const cs = loadContent().items.filter(i => i.type === 'case').map(meta);
  return (
    <div className="wrap">
      <div className="eyebrow">// high-level design</div>
      <h1 className="page-title">HLD case studies</h1>
      <p className="lede">Every case follows the same interview flow: requirements → estimates → API → data model → architecture → deep dives and trade-offs. To practise, draw your own diagram first, then read the page.</p>
      {[1, 2, 3].map(t => (
        <section key={t}><h2 className="section-h">{TIER[t]}</h2><ItemGrid items={cs.filter(c => c.tier === t)} /></section>
      ))}
    </div>
  );
}
