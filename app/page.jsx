import Home from '../components/Home';
import { loadContent, meta, phaseSummaries } from '../lib/content.mjs';

export default function Page() {
  const { items, modules, cards, roadmap } = loadContent();
  return <Home items={items.map(meta)} modules={modules} cardCount={cards.length} phases={phaseSummaries(roadmap)} />;
}
