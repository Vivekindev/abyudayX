// Server-only: loads content/**/*.md at build time, renders Markdown to HTML and validates the plan.
// Each .md file may hold several items; each item starts with a frontmatter block
// ---\nid: x\ntitle: ...\n---\n<markdown body>   (never use a bare "---" line inside a body; use *** instead)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { Marked } from 'marked';

const C = path.join(process.cwd(), 'content');
const ytSearch = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
export const slug = s => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    heading(text, level, raw) { return `<h${level} id="${slug(raw)}">${text}</h${level}>\n`; },
    link(href, title, text) {
      const ext = /^https?:\/\//.test(href);
      return `<a href="${href}"${title ? ` title="${title}"` : ''}${ext ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
    },
  },
});
export const renderMd = md => marked.parse(md);
const tocOf = md => [...md.matchAll(/^## (.+)$/gm)].map(m => ({ id: slug(m[1]), text: m[1].replace(/[*`]/g, '') }));

function parseFile(file, type) {
  const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const parts = src.split(/^---\s*$/m);
  assert(parts[0].trim() === '', `${file}: must start with a frontmatter block`);
  const items = [];
  for (let i = 1; i < parts.length; i += 2) {
    const meta = {};
    for (const line of parts[i].trim().split('\n')) {
      const k = line.indexOf(':');
      if (k > 0) meta[line.slice(0, k).trim()] = line.slice(k + 1).trim();
    }
    assert(meta.id && meta.title, `${file}: item #${(i + 1) / 2} missing id/title`);
    items.push({
      id: meta.id, type, title: meta.title,
      module: meta.module || type,
      day: Number(meta.day),
      minutes: Number(meta.minutes || 30),
      tier: meta.tier ? Number(meta.tier) : null,
      tags: meta.tags ? meta.tags.split(',').map(s => s.trim()) : [],
      summary: meta.summary || '',
      videos: (meta.videos || '').split('|').map(s => s.trim()).filter(Boolean).map(q => ({ label: q, url: ytSearch(q) })),
      read: (meta.read || '').split('|').map(s => s.trim()).filter(Boolean).map(s => {
        const [label, url] = s.split('=>').map(x => x.trim());
        assert(url && /^https?:\/\//.test(url), `${meta.id}: bad read link "${s}"`);
        return { label, url };
      }),
      body: (parts[i + 1] || '').trim(),
    });
  }
  return items;
}

const mdFiles = dir => fs.readdirSync(path.join(C, dir)).filter(f => f.endsWith('.md')).sort().map(f => path.join(C, dir, f));

// Roadmap: phases.json holds the original phases/sections/topic titles; pN.md holds one "### <exact title>" block per topic.
export function loadRoadmap() {
  const dir = path.join(C, 'roadmap');
  const phases = JSON.parse(fs.readFileSync(path.join(dir, 'phases.json'), 'utf8'));
  const problems = [];
  for (const p of phases) {
    const file = path.join(dir, p.id + '.md');
    const md = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const blocks = {};
    for (const part of md.split(/^### /m).slice(1)) {
      const nl = part.indexOf('\n');
      const title = part.slice(0, nl).trim();
      blocks[title] = part.slice(nl + 1).replace(/^## .*$/gm, '').trim()
        .replace(/\n\*\*In the interview:\*\*/g, '\n\n**🎯 In the interview:**');
    }
    const used = new Set();
    p.sections = p.sections.map(s => ({
      t: s.t,
      topics: s.tops.map(t => {
        if (!blocks[t]) problems.push(`${p.id}: missing explanation for "${t}"`);
        used.add(t);
        const short = t.split(' — ')[0];
        return {
          id: p.id + '-' + slug(short).slice(0, 60) + '-' + (used.size),
          title: t, short,
          html: fixLinks(renderMd(blocks[t] || '_Explanation coming soon._')).replace('<p><strong>🎯 In the interview:', '<p class="tip"><strong>🎯 In the interview:'),
          yt: ytSearch(t.replace(/\(.*?\)/g, '').replace(' — ', ' ').split(',').slice(0, 3).join(',').trim() + ' explained'),
        };
      }),
    }));
    for (const t of Object.keys(blocks)) if (!used.has(t)) problems.push(`${p.id}: "### ${t}" doesn't match any original topic title`);
  }
  attachDeep(phases, problems);
  if (problems.length) throw new Error('Roadmap content problems:\n' + problems.join('\n'));
  return phases;
}

// Deep dives: content/deep/<phaseId>-*.md, one "### <exact topic title>" block per topic, "#### " sub-headings inside.
const MERMAID_TYPES = /^(flowchart (TD|LR|TB|RL|BT)|sequenceDiagram|stateDiagram-v2|classDiagram|erDiagram|gantt|pie|timeline|mindmap|quadrantChart|xychart-beta)\b/;
function attachDeep(phases, problems) {
  const dir = path.join(C, 'deep');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
  const byPhase = {};
  for (const f of files) {
    const pid = f.split('-')[0];
    const md = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    for (const part of md.split(/^### /m).slice(1)) {
      const nl = part.indexOf('\n'), title = part.slice(0, nl).trim(), body = part.slice(nl + 1).replace(/^## .*$/gm, '').trim();
      const map = (byPhase[pid] ||= {});
      if (map[title]) problems.push(`deep/${f}: duplicate "### ${title}"`);
      map[title] = body;
      // An enriched topic carries the full 2-minute layer and its sources; a half-enriched one is a mistake.
      const ENRICHED = ['Intuition', 'Must know', 'Common mistakes', 'Sources'];
      const has = ENRICHED.filter(n => body.includes(`#### ${n}\n`));
      if (has.length && has.length < ENRICHED.length) problems.push(`deep/${f} "${title}": enriched topics need all of ${ENRICHED.join(', ')} (missing ${ENRICHED.filter(n => !has.includes(n)).join(', ')})`);
      // Diagrams must use the theme colours (no hard-coded fills) so they read in dark and light mode.
      for (const m of body.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
        if (!MERMAID_TYPES.test(m[1].trim())) problems.push(`deep/${f} "${title}": unknown diagram type "${m[1].trim().split('\n')[0]}"`);
        if (/^\s*(style|classDef|linkStyle)\s|\bfill\s*:#|%%\{/m.test(m[1])) problems.push(`deep/${f} "${title}": diagram hard-codes colours/theme`);
      }
    }
  }
  let missing = 0;
  for (const p of phases) {
    const map = byPhase[p.id] || {}, titles = new Set();
    for (const s of p.sections) for (const t of s.topics) { titles.add(t.title); t.deep = map[t.title] || ''; if (!t.deep) missing++; }
    for (const t of Object.keys(map)) if (!titles.has(t)) problems.push(`deep/${p.id}: "### ${t}" doesn't match any original topic title`);
  }
  if (missing) problems.push(`${missing} roadmap topics have no deep dive (content/deep/*.md)`);
}

export const renderDeep = md => ({
  html: fixLinks(renderMd(md)),
  toc: [...md.matchAll(/^#### (.+)$/gm)].map(m => ({ id: slug(m[1]), text: m[1].replace(/[*`]/g, '') })),
});

const DETAILS = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
const card = (m, href, src, doneKey, group) => ({
  q: m[1].trim(), qHtml: renderMd(m[1].trim()).replace(/^<p>|<\/p>\s*$/g, ''), aHtml: fixLinks(renderMd(m[2].trim())), href, src, doneKey, group,
});

// The markdown under "#### <name>" in a deep dive, up to the next "#### " heading.
export const deepSection = (md, name) => {
  const start = md.indexOf(`#### ${name}\n`);
  if (start < 0) return '';
  const body = md.slice(md.indexOf('\n', start) + 1), end = body.search(/^#### /m);
  return (end < 0 ? body : body.slice(0, end)).trim();
};

// Total reading time of a topic, for the page header.
export const readMinutes = t => minutes(t.deep || '');
// A topic page in layers: a 2-minute summary first, depth on demand.
// Enriched topics have Intuition / Must know / Common mistakes / Sources; others fall back to the cheat sheet.
const minutes = md => Math.max(1, Math.round(md.replace(/```mermaid[\s\S]*?```/g, '').split(/\s+/).length / 200));
export function topicLayers(t) {
  const md = t.deep || '', sec = n => deepSection(md, n);
  const html = m => fixLinks(renderMd(m));
  const box = (cls, title, body) => body ? `<div class="callout ${cls}"><div class="callout-h">${title}</div>${html(body)}</div>` : '';
  const block = names => names.map(n => sec(n) ? `#### ${n}\n\n${sec(n)}\n\n` : '').join('');
  const diagram = (sec('How it works').match(/```mermaid\n[\s\S]*?```/) || [''])[0];
  const must = sec('Must know') || sec('Cheat sheet'), say = sec('Interview angle').replace(/^>\s?/gm, '');
  const layers = [
    { key: 'quick', label: '⚡ 2-min', badge: '', next: 'Go deeper: how it works',
      md: [sec('Intuition'), must, sec('Numbers to quote'), sec('Common mistakes'), say].join('\n'),
      html: box('c-idea', '💡 Intuition', sec('Intuition'))
        + `<div class="callout c-short"><div class="callout-h">In short</div>${t.html}</div>`
        + (diagram ? `<div class="key-diagram">${html(diagram)}</div>` : '')
        + box('c-must', '★ Must know', must) + box('c-num', '# Numbers to quote', sec('Numbers to quote'))
        + box('c-trap', '⚠ Common mistakes', sec('Common mistakes')) + box('c-say', '🎤 Say this in the interview', say) },
    { key: 'deep', label: '📖 Deep dive', badge: 'min', next: 'Problems & fixes', md: md.split(/^#### /m)[0] + block(['How it works', 'Example', 'Trade-offs']) },
    { key: 'fixes', label: '🛠 Fixes', badge: `${(sec('Problems & fixes').match(/^\|/gm) || []).length - 2} fixes`, next: 'Test yourself', md: block(['Problems & fixes', 'Cheat sheet']) },
    { key: 'test', label: '🎯 Self-test', badge: `${(sec('Interview questions').match(/<details>/g) || []).length} Qs`, md: block(['Interview questions']) + (say ? `#### Model answer\n\n> ${say.replace(/\n/g, '\n> ')}\n` : '') },
  ].filter(l => l.html || l.md.trim());
  return layers.map((l, i) => {
    const nx = layers[i + 1];
    const body = (l.html || html(l.md)) + (nx ? `<a class="next-tab" href="#${nx.key}">${l.next || nx.label} →</a>` : '');
    return { key: l.key, label: l.label, badge: l.badge === 'min' ? `${minutes(l.md)} min` : l.badge, html: `<section id="${l.key}" data-tab="${l.key}" role="tabpanel"${i ? ' hidden' : ''}>${body}</section>` };
  });
}
export const topicSources = t => { const s = deepSection(t.deep || '', 'Sources'); return s ? fixLinks(renderMd(s)) : ''; };

let cache;
export function loadContent() {
  if (cache) return cache;
  const modules = JSON.parse(fs.readFileSync(path.join(C, 'modules.json'), 'utf8'));
  const items = [
    ...mdFiles('lessons').flatMap(f => parseFile(f, 'lesson')),
    ...mdFiles('cases').flatMap(f => parseFile(f, 'case')),
    ...mdFiles('lld').flatMap(f => parseFile(f, 'lld')),
  ].sort((a, b) => a.day - b.day);
  const pages = Object.fromEntries(mdFiles('pages').map(f => [path.basename(f, '.md'), fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')]));

  // Flashcards: every <details><summary>Q</summary> A </details> becomes a card.
  const cards = items.flatMap(it => [...it.body.matchAll(DETAILS)]
    .map(m => card(m, `/item/${it.id}/`, it.title, it.id, it.type === 'lesson' ? 'm:' + it.module : 't:' + it.type)));

  // Every roadmap topic is also a card: "Explain <topic>".
  const roadmap = loadRoadmap();
  for (const p of roadmap) for (const s of p.sections) for (const t of s.topics) {
    for (const m of t.deep.matchAll(DETAILS)) cards.push(card(m, `/topic/${t.id}/`, t.short, t.id, 'p:' + p.id));
    cards.push({ q: 'Explain: ' + t.title, qHtml: 'Explain: ' + t.title.replace(/&/g, '&amp;').replace(/</g, '&lt;'), aHtml: t.html,
      href: `/topic/${t.id}/`, src: `Phase ${p.num} · ${s.t}`, doneKey: t.id, group: 'p:' + p.id });
  }

  // ── Self-checks: the build fails loudly on broken content ──
  const ids = new Set();
  for (const it of items) { assert(!ids.has(it.id), `duplicate id ${it.id}`); ids.add(it.id); }
  const modIds = new Set(modules.map(m => m.id));
  for (const it of items) {
    assert(Number.isInteger(it.day), `${it.id}: missing day`);
    if (it.type === 'lesson') assert(modIds.has(it.module), `${it.id}: unknown module ${it.module}`);
  }
  items.forEach((it, i) => assert.strictEqual(it.day, i + 1, `plan days must be 1..N with no gaps/dupes; problem at ${it.id} (day ${it.day})`));
  const linkCheck = (where, md) => { for (const m of md.matchAll(/\]\(#\/item\/([\w-]+)\)/g)) assert(ids.has(m[1]), `${where}: link to unknown item ${m[1]}`); };
  items.forEach(it => linkCheck(it.id, it.body));
  Object.entries(pages).forEach(([n, md]) => linkCheck('page ' + n, md));
  for (const p of roadmap) {
    linkCheck('roadmap ' + p.id, fs.readFileSync(path.join(C, 'roadmap', p.id + '.md'), 'utf8'));
    for (const l of p.lessons || []) assert(ids.has(l), `roadmap ${p.id}: unknown lesson ${l}`);
  }

  cache = { modules, items, cards, pages, roadmap };
  return cache;
}

// Markdown links use the "#/item/<id>" form; rewrite them to real routes.
function fixLinks(html) {
  return html.replace(/href="#\/item\/([\w-]+)"/g, 'href="/item/$1/"').replace(/href="#\/cases"/g, 'href="/cases/"')
    .replace(/href="#\/page\/([\w-]+)"/g, 'href="/ref/$1/"').replace(/href="#\/roadmap"/g, 'href="/roadmap/"');
}

export const renderItem = it => ({ html: fixLinks(renderMd(it.body)), toc: tocOf(it.body) });
export const renderPage = md => ({ html: fixLinks(renderMd(md)), toc: tocOf(md) });

// Lightweight view of a roadmap phase for lists and client components.
export const phaseSummaries = roadmap => roadmap.map(p => ({
  id: p.id, num: p.num, title: p.title, color: p.color, est: p.est, badge: p.badge, pri: p.pri,
  topicIds: p.sections.flatMap(s => s.topics.map(t => t.id)),
}));

// Lightweight view of an item for lists and client components (no body).
export const meta = ({ body, videos, read, ...rest }) => rest;
