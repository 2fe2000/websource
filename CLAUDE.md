# websource — Developer Reference

## Product Overview

A local tool that converts websites into structured data sources.
- Supports both static (Cheerio) and JS-rendered (Playwright) fetching
- Stores sources, configs, and extraction results in SQLite
- Supports scheduled automatic extraction

---

## Wizard Usage

The interactive wizard can be launched from any directory using the `/websource` slash command.
The full flow is defined in `~/.claude/skills/websource/SKILL.md`.

A portable template (with an English translation and a path placeholder) is included
in the repository at `skills/websource/SKILL.md`. See `CONTRIBUTING.md` for install instructions.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npx tsx scripts/discover-sections.ts <url>` | Detect category/section tabs on a page |
| `npx tsx scripts/analyze-page.ts <url> --mode auto` | Analyze a page (field and block detection) |
| `npx tsx scripts/create-source.ts '<json>'` | Create a source |
| `npx tsx scripts/preview-extraction.ts <sourceId>` | Dry-run preview (no DB write) |
| `npx tsx scripts/run-extraction.ts <sourceId>` | Run extraction and save results |
| `npx tsx scripts/list-sources.ts` | List saved sources |

---

## Error Cases

| Situation | Response |
|-----------|---------|
| `fieldQuality: none/poor` with `--mode auto` | Retry with `--mode rendered` |
| Still `none/poor` after rendered | Check `suggestedBlock.selector` — if it looks like a nav/sidebar (`.lnb`, `.sidebar`, `nav li`), the URL is pointing at the wrong page. Infer a better URL (search results, filtered listing) and retry automatically before asking the user |
| `robotsAllowed: false` | Warn the user and confirm before continuing |
| Selector too broad (e.g. `div > div`) | Use Playwright to inspect DOM directly and find a more specific selector |
| No repeated blocks detected | Page may be a single detail page — suggest trying a different URL |
