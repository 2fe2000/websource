# Product Requirements Document — websource

## Problem

Developers and small teams frequently need structured data from public websites — product listings, job postings, news articles, directory pages. Existing tools are either:

- **Too low-level**: raw scraping scripts that break constantly and require manual maintenance
- **Too heavy**: cloud SaaS platforms with dashboards, team management, and pricing tiers
- **Not conversational**: require upfront knowledge of CSS selectors and page structure

## Solution

**websource** is a local-first CLI tool that turns websites into reusable structured data sources through conversational setup. It lives in your terminal, stores everything locally, and feels like talking to a knowledgeable operator.

## Target Users

- Solo developers building data-driven side projects
- Small startup teams that need competitive intelligence
- Researchers collecting structured data from public sources
- Anyone who needs repeatable web-to-data pipelines without cloud overhead

## Core User Flow

1. `websource init https://example.com/products`
2. Tool analyzes the page, identifies it as a list page with 20 product cards
3. Tool proposes fields: title, price, image, url, rating
4. User picks the fields they want
5. Tool asks about detail page traversal, refresh cadence
6. Tool saves a reusable source config
7. User runs `websource extract <id>` whenever they want fresh data
8. User can schedule, diff, export, or serve the data via local API

## Scope

### In Scope (v0.1)
- Public web pages (no auth)
- List pages with repeated items
- Optional detail page traversal
- Field detection and extraction
- Local SQLite persistence
- JSON/CSV export
- Local REST API
- Scheduling (cron-based)
- Change detection (diff)
- robots.txt awareness

### Out of Scope (v0.1)
- Login-required sites
- Anti-bot bypass
- Cloud deployment
- Multi-tenant features
- Browser scripting by users
- Complex JavaScript interaction

## Success Criteria

1. A new user can go from URL to extracted data in under 3 minutes
2. Extraction configs survive website redesigns via fallback selectors
3. The tool runs entirely locally with zero external dependencies beyond npm packages
4. The diff system reliably detects new, changed, and removed records
