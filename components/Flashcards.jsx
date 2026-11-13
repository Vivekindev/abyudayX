'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { isDue, useProgress } from './Progress';

const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default function Flashcards({ cards, modules, phases }) {
  const p = useProgress();
  const [filter, setFilter] = useState('qa');
  const [deck, setDeck] = useState([]);
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(false);

  const build = useCallback(f => {
    // Review deck: one random question per topic that is due, so each review tests it from a different angle.
    const perTopic = {};
    if (f === 'due') for (const c of shuffle(cards)) if (isDue(p, c.doneKey)) perTopic[c.doneKey] = c;
    setDeck(shuffle(f === 'due' ? Object.values(perTopic) : cards.filter(c => {
      if (f === 'all') return true;
      if (f === 'must') return c.must;
      if (f === 'qa') return !c.group.startsWith('p:');           // self-check questions only
      if (f === 'unknown') return !p.known[c.q];
      if (f === 'done') return !!p.done[c.doneKey];
      return c.group === f;
    })));
    setPos(0); setShown(false);
  }, [cards, p.known, p.done, p.rev]);

  useEffect(() => { const h = location.hash.slice(1); if (h === 'due' || h === 'must') setFilter(h); }, []);
  useEffect(() => { if (p.ready) build(filter); }, [p.ready, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = deck[pos];
  const act = useCallback(a => {
    if (!card) return;
    if (a === 'reveal') return setShown(true);
    if (a === 'got') p.setKnown(card.q, true);
    if (a === 'again') { p.setKnown(card.q, false); setDeck(d => [...d, card]); }
    if (filter === 'due' && a !== 'skip' && isDue(p, card.doneKey)) p.review(card.doneKey, a === 'got');
    setShown(false);
    setPos(i => i + 1);
  }, [card, p, filter]);

  useEffect(() => {
    const onKey = e => { if (e.key === ' ' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); act(shown ? 'got' : 'reveal'); } };
    addEventListener('keydown', onKey); return () => removeEventListener('keydown', onKey);
  }, [act, shown]);

  const groups = [
    ['Start here', [['due', '🔁 Due for review today'], ['must', '🔥 Must-know topics only']]],
    ['Mixes', [['qa', 'Self-check questions (lessons & cases)'], ['all', 'Everything (incl. every roadmap topic)'], ['unknown', "Cards I haven't nailed"], ['done', 'Only things I marked done']]],
    ['Roadmap phases', phases.map(ph => ['p:' + ph.id, `Phase ${ph.num} · ${ph.title}`])],
    ['Lesson modules', modules.map(m => ['m:' + m.id, `Module ${m.num} · ${m.title}`])],
    ['Practice', [['t:case', 'HLD case studies'], ['t:lld', 'LLD problems']]],
  ];

  return (
    <div className="fc-wrap">
      <div className="eyebrow">// active recall</div>
      <h1 className="page-title">Flashcards</h1>
      <p className="lede">Say the answer out loud first, then reveal it (space bar). Nailed so far: <b>{Object.keys(p.known).length}/{cards.length}</b>.</p>
      <div className="row">
        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Deck">
          {groups.map(([label, opts]) => <optgroup key={label} label={label}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>)}
        </select>
        {card && <span className="muted">Card {pos + 1} of {deck.length}</span>}
      </div>
      {card ? (
        <>
          <div className="fc">
            <div className="q" dangerouslySetInnerHTML={{ __html: card.qHtml }} />
            {shown && <>
              <div className="a prose" dangerouslySetInnerHTML={{ __html: card.aHtml }} />
              <div className="src muted">From: <Link href={card.href}>{card.src}</Link></div>
            </>}
          </div>
          <div className="row">
            {shown
              ? <><button className="btn" onClick={() => act('again')}>↻ Review again</button><button className="btn ok" onClick={() => act('got')}>✓ Got it</button></>
              : <><button className="btn primary" onClick={() => act('reveal')}>Reveal answer</button><button className="btn" onClick={() => act('skip')}>Skip →</button></>}
          </div>
        </>
      ) : (
        <div className="fc"><div className="q">{deck.length ? 'Deck finished 🎉' : !p.ready ? 'Loading…' : filter === 'due' ? 'Nothing due today 🎉' : 'No cards in this deck'}</div>
          {p.ready && filter === 'due' && <p className="muted" style={{ marginTop: 8 }}>Every topic or lesson you mark done comes back here after 1, 4, 11 and 27 days, as long as you still remember it. Forget one and it returns tomorrow.</p>}
          {p.ready && <button className="btn primary" style={{ marginTop: 16 }} onClick={() => build(filter)}>Shuffle again</button>}</div>
      )}
    </div>
  );
}
