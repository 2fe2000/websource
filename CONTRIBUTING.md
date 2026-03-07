# Contributing to websource

Thank you for your interest in contributing!

## Prerequisites

- Node.js 20+
- npm 10+

## Setup

```bash
git clone https://github.com/2fe2000/websource.git
cd websource
npm install
npx playwright install chromium
```

## Claude Code skill (optional)

websource ships with a Claude Code skill that lets you run the interactive
wizard from any chat session using the `/websource` command or natural
language triggers like "scrape this URL".

To install it:

```bash
bash scripts/install-skill.sh
```

This copies the skill template and sets the path automatically.
Works on macOS and Linux.

## Running scripts

```bash
# Analyze a page
npx tsx scripts/analyze-page.ts https://example.com --mode auto

# List saved sources
npx tsx scripts/list-sources.ts

# Preview extraction (dry run)
npx tsx scripts/preview-extraction.ts <sourceId>

# Run extraction and save
npx tsx scripts/run-extraction.ts <sourceId>
```

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Type checking

```bash
npx tsc --noEmit
```

## Linting

```bash
npm run lint
```

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make sure `npm test` and `npx tsc --noEmit` pass before opening a PR.
3. Keep commits focused — one logical change per commit.
4. Describe what the change does and why in the PR description.

## Reporting issues

Please include the URL you were trying to scrape, the command you ran, and the full error output.
