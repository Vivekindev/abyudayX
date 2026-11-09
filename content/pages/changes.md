# 🔁 What changed vs your v1 roadmap

Your first site ([sysdesign2.netlify.app](https://sysdesign2.netlify.app/)) was a checklist of topic names across 12 phases. It said "250+", but it actually listed **622 topics**. It was good for tracking, but there was nothing to *read*.

This version keeps **all 622 original topics, with the same phases, sections and exact titles** (see [Roadmap](#/roadmap)), and gives every one of them an explanation, an "in the interview" tip and a video link. On top of that it adds:

- **Phase 13: Fintech & Banking** and **Phase 14: Low-Level Design**, bringing the total to 654 topics
- a 62-day guided plan of deep-dive lessons with diagrams
- 16 full HLD case studies and 6 LLD problems
- a **deep dive for every one of the 654 topics**: theory, a diagram, a worked example, trade-offs, a problems & fixes table, a cheat sheet and interview Q&As, plus a one-page revision sheet per phase
- 2,172 flashcards (every self-check and deep-dive interview question, plus "explain this topic" for every roadmap topic)

## Content changes

| Change | Why |
|---|---|
| ➕ **Interview Playbook** module (framework, estimation, mocks) | Estimation and the 6-step flow decide the round, and v1 only had them as a footnote |
| ➕ **Fintech & Banking** module (payments, ledgers, reconciliation, trading) | Visa, JPMorgan, Morgan Stanley and Goldman ask payment-flavoured designs, and v1 had none |
| ➕ **Low-Level Design** module + 6 LLD problems in Java | Banks and Bangalore product companies run LLD / machine-coding rounds, and v1 skipped them |
| ➕ 16 full **HLD case studies** with diagrams | v1 only listed problem names |
| ➕ **Self-check Q&A** on every page → ~200 **flashcards** | Active recall beats re-reading |
| ✅ Every original topic kept and explained, including niche ones (BCNF, intention locks, TrueTime, WebRTC…) | Nothing from your list was dropped. Niche topics are marked "rarely asked" in their tips so you can prioritise |
| ➕ A **62-day guided plan** of deep-dive lessons | Each case study sits right after the lessons it needs |
| ➕ Java concurrency, Spring/Resilience4j and Flyway notes | Bank interviews probe core Java hard |
| ➕ Company playbook, cheat sheet, and a verified resource list | Prep tailored to your targets |

## App changes

- Rebuilt in **Next.js (React)** and pre-rendered as a static site for **Cloudflare Pages**.
- Roadmap with your original phases and a tick-box on every topic, plus progress per phase and in total.
- Day-by-day plan with a "Today" card that always points at your next unfinished day.
- Notes box on every page, progress export/import, full-text search, dark/light themes, and diagrams that follow the theme.
- All content lives in plain Markdown files under `content/`, so you can edit or add lessons without touching code.
