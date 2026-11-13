// Check every source link in the given markdown files. usage: node tools/check-links.mjs <file.md>...
process.on("uncaughtException", e => { if (e.code !== "ERR_INVALID_STATE") throw e; });
// Prints only the links that did not answer 200, so each can be checked another way or replaced.
import fs from 'node:fs';

const urls = new Map();
for (const f of process.argv.slice(2))
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)) urls.set(m[1], f);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const check = async url => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(25000), headers: { 'user-agent': UA, accept: 'text/html,*/*', 'accept-language': 'en' } });
      await r.arrayBuffer().catch(() => {});
      // A redirect to the site's home page means the page is gone even though the status is 200.
      // Some sites (AWS docs) redirect a missing page to a section index: a redirect that drops the page name is suspect.
      const home = (new URL(r.url).pathname.length <= 1 && new URL(url).pathname.length > 1) || (r.redirected && !r.url.toLowerCase().includes(new URL(url).pathname.replace(/\/$/, '').split('/').pop().toLowerCase()));
      if (r.ok && !home) return 'ok';
      if (attempt) return home ? `redirects to ${r.url}` : String(r.status);
    } catch (e) { if (attempt) return e.name === 'TimeoutError' ? 'timeout' : (e.cause?.code || e.message); }
  }
};

const list = [...urls.keys()], bad = [];
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < list.length) { const u = list[i++]; const s = await check(u); if (s !== 'ok') bad.push(`${s}\t${u}`); }
}));
console.log(`${list.length} links, ${list.length - bad.length} ok`);
if (bad.length) console.log(bad.sort().join('\n'));
