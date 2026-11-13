import Home from '../components/Home';
import { loadContent, meta, phaseSummaries } from '../lib/content.mjs';

export default function Page() {
  const { items, modules, cards, roadmap } = loadContent();
  return <Home items={items.map(meta)} modules={modules} cardCount={cards.length} phases={phaseSummaries(roadmap)}
    mustTopics={roadmap.flatMap(p => p.sections.flatMap(s => s.topics.filter(t => t.tier === 'must').map(t => ({ id: t.id, title: t.title, where: `Phase ${p.num} · ${s.t}` }))))} />;
}
