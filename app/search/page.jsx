import { Suspense } from 'react';
import Search from '../../components/Search';
import { loadContent } from '../../lib/content.mjs';

export const metadata = { title: 'Search · System Design Manual' };

const plain = s => s.replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ').replace(/[#*`>|_\-]/g, ' ').replace(/\s+/g, ' ').trim();

export default function Page() {
  const { items, roadmap } = loadContent();
  // shortcut: whole-text index shipped to this page (~1 MB); switch to a prebuilt index (e.g. MiniSearch) if content grows a lot
  const index = [
    ...items.map(it => ({ id: it.id, type: it.type, where: `Day ${it.day}`, title: it.title, href: `/item/${it.id}/`, text: plain(it.body), extra: it.summary + ' ' + it.tags.join(' ') })),
    ...roadmap.flatMap(p => p.sections.flatMap(s => s.topics.map(t => ({
      id: t.id, type: 'topic', where: `Phase ${p.num}`, title: t.title, href: `/topic/${t.id}/`, text: plain(t.html), extra: s.t,
    })))),
  ].map(x => ({ ...x, hay: (x.title + ' ' + x.extra + ' ' + x.text).toLowerCase() }));
  return <Suspense><Search index={index} /></Suspense>;
}
