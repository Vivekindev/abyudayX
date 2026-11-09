# System Design Manual — SDE 2

A system design companion for SDE-2 interviews, built with Next.js (React) and exported as a static site.

- **Roadmap:** the original 12 phases (622 topics) plus Fintech and LLD phases, 654 topics in total. Every topic has its own explanation, an "in the interview" tip, a video link and a tick-box.
- **Interview prep:** the original three problem tiers, each linked to a full design.
- **62-day guided plan:** 40 deep-dive lessons with diagrams, 16 HLD case studies, 6 LLD problems in Java.
- **Deep dive for every topic** (`/topic/<id>/`): theory, a diagram, a worked example, trade-offs, a problems & fixes table, a cheat sheet, interview Q&As and an interview line. Each phase also has a one-page **revision sheet** (`/revise/<phase>/`) that collects the cheat sheets, fixes and Q&As.
- **2,172 flashcards**, a cheat sheet, a company playbook and a verified resource list.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy to Cloudflare Pages

1. Push this folder to a GitHub repo.
2. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick the repo.
3. Set the build settings:
   - Framework preset: **Next.js (Static HTML Export)**, or "None"
   - Build command: `npm run build`
   - Build output directory: `out`
   - Node version: taken from `.node-version` (20)
4. Click Deploy. Every push redeploys automatically.

Stop `npm run dev` before building locally (both use `.next/` on Windows). To deploy without Git: run `npm run build`, then `npx wrangler pages deploy out --project-name abyudayx`. You can also drag the `out/` folder into the Cloudflare Pages dashboard (Upload assets).

## Editing content

All content is Markdown:

| Path | What |
|---|---|
| `content/roadmap/phases.json` | Phases, sections and **exact topic titles** (plus linked lessons) |
| `content/roadmap/pN.md` | One `### <exact topic title>` block per topic (short explanation) |
| `content/deep/pN-*.md` | Deep dives: one `### <exact topic title>` block per topic, with `#### How it works`, `#### Example`, `#### Trade-offs`, `#### Problems & fixes`, `#### Cheat sheet`, `#### Interview questions`, `#### Interview angle`. Enriched topics also have `#### Intuition`, `#### Must know`, `#### Numbers to quote` (optional), `#### Common mistakes` and `#### Sources`, which feed the topic page's 2-minute tab |
| `content/lessons/*.md` | Deep-dive lessons (several per file, each starting with a `---` frontmatter block) |
| `content/cases/*.md`, `content/lld/*.md` | Case studies and LLD problems |
| `content/pages/*.md` | Interview prep, cheat sheet, company playbook, resources, changelog |

`npm run check` validates everything, and the build fails on the same errors:

- every roadmap topic has an explanation and a deep dive, and neither has a misspelled title
- an enriched topic has all of Intuition, Must know, Common mistakes and Sources
- mermaid blocks don't set colours (`style`, `classDef`, `fill:#…`), so diagrams always follow the theme
- unique IDs, and plan days 1..N with no gaps
- no broken internal links

Formatting rules:

- In lesson files, never put a bare `---` line inside a body. Use `***` instead.
- ```` ```mermaid ```` blocks become diagrams.
- `<details><summary>Q</summary>A</details>` blocks become flashcards.
- Link to another day with `[text](#/item/<id>)`.

## Notes

Progress, notes and flashcard state are saved in the browser (`localStorage`). Use **Export / Import progress** in the sidebar to move them between devices.
