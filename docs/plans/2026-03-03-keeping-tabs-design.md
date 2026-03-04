# Keeping Tabs - Design Document

**Date**: 2026-03-03
**Status**: Approved

## Problem

Founders waste time obsessing over competitors' polished positioning instead of extracting what actually works. They need a way to digest competitors' public posts and distill them into specific actions taken and results achieved - lessons without the bullshit.

## Solution

A web tool where you paste a competitor's LinkedIn URL and/or Twitter handle, pick a time range, and get a structured report of what they did, what worked, and what didn't. Each insight links back to the source post.

## User

Solo founder. Personal use first, validation-ready (polished enough to share).

## Core Flow

```
Paste URLs → Pick time range → Analyze → View report (shareable URL)
```

## Tech Stack

- **Next.js** (App Router) - framework
- **RapidAPI** (Fresh LinkedIn Profile Data) - LinkedIn post retrieval
- **SocialData.tools** - Twitter/X post retrieval
- **Gemini 3 Flash Preview** via OpenRouter (`google/gemini-3-flash-preview`) - LLM extraction & synthesis
- **JSON files on disk** - report storage (no database)
- **Deploy**: dokku at `keeping-tabs.whhite.com`

## Input

Single page with:
- LinkedIn URL field (optional)
- Twitter/X handle field (optional) - at least one required
- Time range dropdown: 3 months, 6 months, 1 year, 2 years
- "Analyze" button

## Processing Pipeline

### 1. Fetch (parallel)

**LinkedIn** (reuse Speakoro pattern from `src/lib/linkedin.ts`):
- RapidAPI `get-profile-posts` endpoint
- 50 posts/page, 1s delay between pages
- Paginate with `start` + `pagination_token`
- Client-side time range filtering on `posted` date
- Max 10 pages

**Twitter/X** (SocialData.tools):
- Fetch user's tweets within time range
- API key: `4296|0opWEhALMMBiQcugvVMVrcJQOHXmISGUzceEPDvb760bb0be`
- Docs: https://socialdata.gitbook.io/docs

### 2. Extract (batched LLM calls)

- Combine all posts (LinkedIn + Twitter) chronologically
- Batch in groups of ~20 posts
- Send to Gemini 3 Flash Preview with structured extraction prompt
- Extract per post:
  - **Action taken**: What specific thing did they do?
  - **Result/outcome**: What happened? (explicit or implied)
  - **Confidence**: How certain is this extraction? (high/medium/low)
  - **Source**: Reference to original post URL
- Skip posts with no actionable content (motivational fluff, retweets, etc.)

### 3. Synthesize (single LLM pass)

Take all extracted action-result pairs and organize into report sections:

1. **Actions & Results** - Specific things they did and outcomes
2. **Strategies & Patterns** - Recurring themes across posts
3. **What's Working** - Signals of success
4. **What Failed / Pivots** - Things tried and abandoned
5. **Key Takeaways** - Top 3-5 actionable lessons

Each insight cites source post(s).

### 4. Store

- Save as JSON file: `data/reports/{uuid}.json`
- JSON contains: report metadata, structured sections, raw extraction data, source post references
- Report accessible at `/report/{uuid}`

## Report Page

Clean, readable web page. Sections as described above. Each insight has a small link icon to the source post. No clutter - the report IS the product.

## API Keys (from existing services)

- **RapidAPI**: `RAPIDAPI_KEY=770fa21dd5msh79ff562f8742782p1a2fa4jsn5bcd13e558b8`
- **SocialData**: `SOCIALDATA_API_KEY=4296|0opWEhALMMBiQcugvVMVrcJQOHXmISGUzceEPDvb760bb0be`
- **OpenRouter**: `OPENROUTER_API_KEY` (from existing env)

## Non-Goals (for MVP)

- Auth / user accounts
- Saved profiles / re-analysis
- YouTube transcription
- Comparison across multiple people
- Billing / usage limits
- Database (using flat files)

## Success Criteria

A founder pastes a competitor's LinkedIn + Twitter, waits ~30 seconds, and gets a report that makes them say "oh, THAT's what they're actually doing" - with specific actions they can emulate.
