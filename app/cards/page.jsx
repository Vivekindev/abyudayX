import Flashcards from '../../components/Flashcards';
import { loadContent } from '../../lib/content.mjs';

export const metadata = { title: 'Flashcards · System Design Manual' };

export default function Page() {
  const { cards, modules, roadmap } = loadContent();
  return <Flashcards cards={cards} modules={modules} phases={roadmap.map(p => ({ id: p.id, num: p.num, title: p.title }))} />;
}
