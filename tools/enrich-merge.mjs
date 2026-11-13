// Merge enrichment blocks into the deep-dive files of one phase.
// usage: node tools/enrich-merge.mjs . <phaseId> <enrichment.md> [--dry]
// enrichment.md: "### <exact topic title>" blocks holding #### Intuition / Must know / Numbers to quote (optional) / Common mistakes / Sources.
// The first four go in front of "#### How it works"; Sources goes at the end of the topic.
import fs from 'node:fs';
import path from 'node:path';

const [repo, phase, encFile, flag] = process.argv.slice(2);
const dry = flag === '--dry';
const split = md => md.split(/^### /m).slice(1).map(part => { const nl = part.indexOf('\n'); return [part.slice(0, nl).trim(), part.slice(nl + 1)]; });
const section = (body, name) => {
  const m = body.match(new RegExp(`^#### ${name}\\n([\\s\\S]*?)(?=^#### |(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
};

const enc = new Map();
for (const [title, body] of split(fs.readFileSync(encFile, 'utf8').replace(/\r\n/g, '\n'))) {
  if (enc.has(title)) throw new Error(`enrichment has "${title}" twice`);
  const e = Object.fromEntries(['Intuition', 'Must know', 'Numbers to quote', 'Common mistakes', 'Sources'].map(n => [n, section(body, n)]));
  for (const n of ['Intuition', 'Must know', 'Common mistakes', 'Sources']) if (!e[n]) throw new Error(`"${title}": missing #### ${n}`);
  const bullets = e['Must know'].split('\n').filter(l => l.startsWith('- ')).length;
  if (bullets < 3 || bullets > 5) throw new Error(`"${title}": Must know needs 3–5 bullets, has ${bullets}`);
  const links = (e.Sources.match(/\]\(https?:\/\//g) || []).length;
  if (links < 2 || links > 3) throw new Error(`"${title}": Sources needs 2–3 links, has ${links}`);
  enc.set(title, e);
}

const dir = path.join(repo, 'content', 'deep');
const used = new Set();
let merged = 0;
for (const f of fs.readdirSync(dir).filter(f => f.split('-')[0] === phase && f.endsWith('.md')).sort()) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8'), crlf = raw.includes('\r\n');
  const src = raw.replace(/\r\n/g, '\n');
  const head = src.slice(0, src.search(/^### /m));
  let out = head, n = 0;
  for (const [title, body] of split(src)) {
    const e = enc.get(title);
    if (!e) { out += `### ${title}\n${body}`; continue; }
    if (/^#### (Intuition|Must know|Common mistakes|Sources)\n/m.test(body)) throw new Error(`${f} "${title}": already enriched`);
    const at = body.search(/^#### How it works\n/m);
    if (at < 0) throw new Error(`${f} "${title}": no "#### How it works" to insert before`);
    // A "## section" heading for the next group of topics may trail this block; keep it after the Sources.
    const tail = body.search(/^## /m), main = (tail < 0 ? body : body.slice(0, tail)), trailer = tail < 0 ? '' : body.slice(tail);
    const top = ['Intuition', 'Must know', 'Numbers to quote', 'Common mistakes'].filter(k => e[k]).map(k => `#### ${k}\n${e[k]}\n\n`).join('');
    out += `### ${title}\n${main.slice(0, at)}${top}${main.slice(at).trimEnd()}\n\n#### Sources\n${e.Sources}\n\n${trailer ? '\n' + trailer : ''}`;
    used.add(title); n++;
  }
  if (n && !dry) fs.writeFileSync(path.join(dir, f), crlf ? out.replace(/\n/g, '\r\n') : out);
  if (n) console.log(`${f}: ${n} topics${dry ? ' (dry run)' : ''}`);
  merged += n;
}
const orphans = [...enc.keys()].filter(t => !used.has(t));
if (orphans.length) { console.error('No deep-dive topic with these titles:\n' + orphans.join('\n')); process.exitCode = 1; }
console.log(`merged ${merged}/${enc.size}`);
