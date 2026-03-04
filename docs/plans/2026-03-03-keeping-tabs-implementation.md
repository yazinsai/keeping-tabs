# Keeping Tabs - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web tool that digests competitors' LinkedIn + Twitter posts and extracts actionable lessons (specific actions taken and results achieved).

**Architecture:** Next.js App Router with API routes for the analysis pipeline. Frontend submits URLs + time range, backend fetches posts from LinkedIn (RapidAPI) and Twitter (SocialData.tools) in parallel, runs them through Gemini 3 Flash Preview in batches to extract action-result pairs, then synthesizes into a structured report. Reports stored as JSON files on disk.

**Tech Stack:** Next.js 15 (App Router), Tailwind CSS, RapidAPI (Fresh LinkedIn Profile Data), SocialData.tools, OpenRouter (google/gemini-3-flash-preview), JSON file storage.

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/globals.css`, `.env`, `.gitignore`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /Users/rock/ai/projects/keeping-tabs
bunx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-bun --yes
```

If it prompts about existing files, allow overwriting.

**Step 2: Install dependencies**

Run:
```bash
bun add axios date-fns uuid
bun add -d @types/uuid
```

**Step 3: Create .env file**

Create `.env`:
```
RAPIDAPI_KEY=770fa21dd5msh79ff562f8742782p1a2fa4jsn5bcd13e558b8
SOCIALDATA_API_KEY=4296|0opWEhALMMBiQcugvVMVrcJQOHXmISGUzceEPDvb760bb0be
OPENROUTER_API_KEY=<copy from ~/.zshrc or existing project>
```

Run: `grep OPENROUTER_API_KEY /Users/rock/ai/projects/speakoro/.env` to get the key.

**Step 4: Create data directory**

Run:
```bash
mkdir -p data/reports
echo "data/reports/*.json" >> .gitignore
```

**Step 5: Verify project runs**

Run: `bun dev`
Expected: Next.js dev server starts on localhost:3000

**Step 6: Commit**

```bash
git add package.json bun.lock next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs src/app/layout.tsx src/app/globals.css src/app/page.tsx .gitignore .env.example
git commit -m "feat: scaffold Next.js project with dependencies"
```

Note: Create `.env.example` with placeholder values (no real keys). Do NOT commit `.env`.

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/index.ts`

**Step 1: Create type definitions**

Create `src/types/index.ts`:
```typescript
// === Input Types ===

export type TimeRange = '3months' | '6months' | '1year' | '2years';

export interface AnalyzeRequest {
  linkedinUrl?: string;
  twitterHandle?: string;
  timeRange: TimeRange;
}

// === LinkedIn Types ===

export interface LinkedInPost {
  text: string;
  posted: string; // ISO timestamp
  post_url: string;
  poster: {
    first: string;
    last: string;
    linkedin_url: string;
    headline?: string;
  };
  num_reactions?: number;
  num_comments?: number;
  num_reposts?: number;
}

export interface LinkedInApiResponse {
  data: LinkedInPost[];
  paging?: {
    start: number;
    pagination_token?: string;
  };
}

// === Twitter Types ===

export interface Tweet {
  id_str: string;
  full_text: string;
  tweet_created_at: string; // ISO timestamp
  type: 'tweet' | 'reply' | 'retweet';
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  views_count: number;
  user: {
    name: string;
    screen_name: string;
    profile_image_url_https: string;
  };
}

export interface TwitterSearchResponse {
  tweets: Tweet[];
  next_cursor: string | null;
}

// === Unified Post Type ===

export interface UnifiedPost {
  platform: 'linkedin' | 'twitter';
  text: string;
  date: string; // ISO timestamp
  url: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  authorName: string;
}

// === Extraction Types ===

export interface ExtractedInsight {
  action: string;
  result: string;
  confidence: 'high' | 'medium' | 'low';
  sourceUrls: string[];
  sourcePlatform: 'linkedin' | 'twitter' | 'both';
}

// === Report Types ===

export interface ReportSection {
  title: string;
  insights: {
    text: string;
    sourceUrls: string[];
  }[];
}

export interface Report {
  id: string;
  createdAt: string;
  linkedinUrl?: string;
  twitterHandle?: string;
  timeRange: TimeRange;
  personName: string;
  personHeadline?: string;
  totalPostsAnalyzed: number;
  sections: {
    actionsAndResults: ReportSection;
    strategiesAndPatterns: ReportSection;
    whatsWorking: ReportSection;
    whatFailed: ReportSection;
    keyTakeaways: ReportSection;
  };
  rawInsights: ExtractedInsight[];
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add type definitions for posts, extraction, and reports"
```

---

## Task 3: LinkedIn Post Fetcher

**Files:**
- Create: `src/lib/linkedin.ts`

**Step 1: Implement LinkedIn post fetcher**

Create `src/lib/linkedin.ts` (simplified from Speakoro - no caching, no InstantDB):

```typescript
import axios from 'axios';
import { LinkedInApiResponse, LinkedInPost, TimeRange, UnifiedPost } from '@/types';
import { subMonths, parseISO, isBefore } from 'date-fns';

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = 'fresh-linkedin-profile-data.p.rapidapi.com';
const POSTS_PER_PAGE = 50;

function timeRangeToMonths(timeRange: TimeRange): number {
  switch (timeRange) {
    case '3months': return 3;
    case '6months': return 6;
    case '1year': return 12;
    case '2years': return 24;
  }
}

export async function fetchLinkedInPosts(
  linkedinUrl: string,
  timeRange: TimeRange,
  maxPages = 10
): Promise<{ posts: LinkedInPost[]; personName: string; personHeadline?: string }> {
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY not configured');

  const headers = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  const cutoffDate = subMonths(new Date(), timeRangeToMonths(timeRange));
  const allPosts: LinkedInPost[] = [];
  let personName = '';
  let personHeadline: string | undefined;

  let start = 0;
  let paginationToken: string | undefined;
  let pageCount = 0;
  let shouldContinue = true;

  while (shouldContinue && pageCount < maxPages) {
    const params: Record<string, string | number> = {
      linkedin_url: linkedinUrl,
      type: 'posts',
    };

    if (pageCount > 0) {
      params.start = start;
      if (paginationToken) params.pagination_token = paginationToken;
    }

    const response = await axios.get<LinkedInApiResponse>(
      `https://${RAPIDAPI_HOST}/get-profile-posts`,
      { headers, params }
    );

    const posts = response.data?.data || [];
    if (posts.length === 0) break;

    // Capture person name from first post
    if (pageCount === 0 && posts[0]?.poster) {
      personName = `${posts[0].poster.first} ${posts[0].poster.last}`;
      personHeadline = posts[0].poster.headline;
    }

    for (const post of posts) {
      try {
        const postDate = parseISO(post.posted);
        if (isBefore(postDate, cutoffDate)) {
          shouldContinue = false;
          break;
        }
        allPosts.push(post);
      } catch {
        allPosts.push(post); // Include if date parsing fails
      }
    }

    if (response.data.paging) {
      start = response.data.paging.start + POSTS_PER_PAGE;
      paginationToken = response.data.paging.pagination_token;
      pageCount++;
      if (posts.length < POSTS_PER_PAGE) break;
    } else {
      break;
    }

    // Rate limit delay
    if (shouldContinue && pageCount < maxPages) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { posts: allPosts, personName, personHeadline };
}

export function linkedInPostsToUnified(posts: LinkedInPost[]): UnifiedPost[] {
  return posts.map(post => ({
    platform: 'linkedin' as const,
    text: post.text,
    date: post.posted,
    url: post.post_url,
    engagement: {
      likes: post.num_reactions || 0,
      comments: post.num_comments || 0,
      shares: post.num_reposts || 0,
    },
    authorName: `${post.poster.first} ${post.poster.last}`,
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/linkedin.ts
git commit -m "feat: add LinkedIn post fetcher via RapidAPI"
```

---

## Task 4: Twitter Post Fetcher

**Files:**
- Create: `src/lib/twitter.ts`

**Step 1: Implement Twitter post fetcher**

Create `src/lib/twitter.ts`:

```typescript
import { Tweet, TwitterSearchResponse, TimeRange, UnifiedPost } from '@/types';
import { subMonths } from 'date-fns';

const SOCIALDATA_API_KEY = process.env.SOCIALDATA_API_KEY;
const BASE_URL = 'https://api.socialdata.tools';

function timeRangeToMonths(timeRange: TimeRange): number {
  switch (timeRange) {
    case '3months': return 3;
    case '6months': return 6;
    case '1year': return 12;
    case '2years': return 24;
  }
}

export async function fetchTwitterPosts(
  handle: string,
  timeRange: TimeRange,
  maxPages = 15
): Promise<{ tweets: Tweet[]; personName: string }> {
  if (!SOCIALDATA_API_KEY) throw new Error('SOCIALDATA_API_KEY not configured');

  // Clean handle - remove @ if present
  const cleanHandle = handle.replace(/^@/, '');

  // Calculate time range as unix timestamps
  const now = new Date();
  const sinceDate = subMonths(now, timeRangeToMonths(timeRange));
  const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
  const untilTimestamp = Math.floor(now.getTime() / 1000);

  // Use search endpoint with from: operator for date filtering
  const query = `from:${cleanHandle} since_time:${sinceTimestamp} until_time:${untilTimestamp}`;

  const allTweets: Tweet[] = [];
  let cursor: string | null = null;
  let pageCount = 0;
  let personName = cleanHandle;

  while (pageCount < maxPages) {
    const params = new URLSearchParams({
      query,
      type: 'Latest',
    });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${BASE_URL}/twitter/search?${params}`, {
      headers: {
        'Authorization': `Bearer ${SOCIALDATA_API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 402) throw new Error('SocialData API: insufficient credits');
      if (response.status === 404) throw new Error(`Twitter user @${cleanHandle} not found`);
      throw new Error(`SocialData API error: ${response.status}`);
    }

    const data: TwitterSearchResponse = await response.json();
    const tweets = data.tweets || [];

    if (tweets.length === 0) break;

    // Filter out retweets - we want original content only
    const originalTweets = tweets.filter(t => t.type !== 'retweet');
    allTweets.push(...originalTweets);

    // Capture person name from first tweet
    if (pageCount === 0 && tweets[0]?.user) {
      personName = tweets[0].user.name;
    }

    cursor = data.next_cursor;
    if (!cursor) break;

    pageCount++;

    // Rate limit: SocialData allows 120 req/min, but be polite
    await new Promise(r => setTimeout(r, 500));
  }

  return { tweets: allTweets, personName };
}

export function tweetsToUnified(tweets: Tweet[]): UnifiedPost[] {
  return tweets.map(tweet => ({
    platform: 'twitter' as const,
    text: tweet.full_text,
    date: tweet.tweet_created_at,
    url: `https://x.com/${tweet.user.screen_name}/status/${tweet.id_str}`,
    engagement: {
      likes: tweet.favorite_count || 0,
      comments: tweet.reply_count || 0,
      shares: tweet.retweet_count || 0,
    },
    authorName: tweet.user.name,
  }));
}
```

**Step 2: Commit**

```bash
git add src/lib/twitter.ts
git commit -m "feat: add Twitter post fetcher via SocialData.tools"
```

---

## Task 5: LLM Extraction & Synthesis Service

**Files:**
- Create: `src/lib/llm.ts`

**Step 1: Implement the LLM service**

Create `src/lib/llm.ts`:

```typescript
import { UnifiedPost, ExtractedInsight, Report, ReportSection } from '@/types';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-3-flash-preview';
const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callLLM(messages: { role: string; content: string }[], jsonMode = true): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not configured');

  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'X-OpenRouter-Title': 'Keeping Tabs',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Extract action-result pairs from a batch of posts
 */
export async function extractInsights(posts: UnifiedPost[]): Promise<ExtractedInsight[]> {
  const BATCH_SIZE = 20;
  const allInsights: ExtractedInsight[] = [];

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);

    const postsText = batch.map((p, idx) => (
      `[Post ${idx + 1}] (${p.platform}, ${p.date})\nURL: ${p.url}\nEngagement: ${p.engagement.likes} likes, ${p.engagement.comments} comments, ${p.engagement.shares} shares\n${p.text}`
    )).join('\n\n---\n\n');

    const systemPrompt = `You are an expert at extracting actionable business insights from social media posts.

Your job: For each post, determine if the author describes a SPECIFIC ACTION they took and a RESULT that came from it (or a lesson learned).

Rules:
- Only extract posts where the author describes something they actually DID (not just opinions or advice)
- The action must be specific and concrete (not vague like "worked hard")
- The result can be explicit ("got 50K signups") or implied ("this changed everything for us")
- Skip: motivational quotes, retweets, congratulations posts, job announcements, event promotions with no insight
- Confidence levels: "high" = explicit action + explicit result, "medium" = clear action + implied result, "low" = inferred action or result

Return JSON: { "insights": [{ "action": "...", "result": "...", "confidence": "high|medium|low", "postIndices": [1, 2] }] }

postIndices refers to the [Post N] numbers. An insight can reference multiple posts if they discuss the same action/result.

If no posts in this batch contain actionable insights, return: { "insights": [] }`;

    const content = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: postsText },
    ]);

    try {
      const parsed = JSON.parse(content);
      for (const insight of parsed.insights || []) {
        const sourceUrls = (insight.postIndices || [])
          .map((idx: number) => batch[idx - 1]?.url)
          .filter(Boolean);
        const platforms = new Set(
          (insight.postIndices || [])
            .map((idx: number) => batch[idx - 1]?.platform)
            .filter(Boolean)
        );

        allInsights.push({
          action: insight.action,
          result: insight.result,
          confidence: insight.confidence || 'medium',
          sourceUrls,
          sourcePlatform: platforms.size > 1 ? 'both' : (platforms.values().next().value || 'linkedin'),
        });
      }
    } catch (e) {
      console.error('Failed to parse extraction response:', e);
      // Continue with next batch
    }
  }

  return allInsights;
}

/**
 * Synthesize extracted insights into a structured report
 */
export async function synthesizeReport(
  insights: ExtractedInsight[],
  personName: string,
  totalPosts: number
): Promise<Report['sections']> {
  const insightsText = insights.map((ins, i) => (
    `[${i + 1}] Action: ${ins.action}\nResult: ${ins.result}\nConfidence: ${ins.confidence}\nSources: ${ins.sourceUrls.join(', ')}`
  )).join('\n\n');

  const systemPrompt = `You are an expert business analyst creating a competitive intelligence report about ${personName}.

You have ${insights.length} extracted insights from ${totalPosts} of their social media posts. Organize them into 5 sections.

Rules:
- Be specific and concrete. No fluff, no filler.
- Each insight in the report should cite its source URLs.
- Deduplicate - if multiple insights describe the same thing, merge them.
- For "Key Takeaways", distill the top 3-5 actionable lessons another founder could apply TODAY.
- Write in third person ("They did X" not "I did X").
- Keep each insight to 1-2 sentences. Dense and useful.

Return JSON:
{
  "actionsAndResults": {
    "title": "Actions & Results",
    "insights": [{ "text": "...", "sourceUrls": ["..."] }]
  },
  "strategiesAndPatterns": {
    "title": "Strategies & Patterns",
    "insights": [{ "text": "...", "sourceUrls": ["..."] }]
  },
  "whatsWorking": {
    "title": "What's Working",
    "insights": [{ "text": "...", "sourceUrls": ["..."] }]
  },
  "whatFailed": {
    "title": "What Failed / Pivots",
    "insights": [{ "text": "...", "sourceUrls": ["..."] }]
  },
  "keyTakeaways": {
    "title": "Key Takeaways",
    "insights": [{ "text": "...", "sourceUrls": ["..."] }]
  }
}

If a section has no relevant insights, return it with an empty insights array.`;

  const content = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: insightsText },
  ]);

  try {
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse synthesis response:', e);
    // Return empty sections as fallback
    const empty: ReportSection = { title: '', insights: [] };
    return {
      actionsAndResults: { ...empty, title: 'Actions & Results' },
      strategiesAndPatterns: { ...empty, title: 'Strategies & Patterns' },
      whatsWorking: { ...empty, title: "What's Working" },
      whatFailed: { ...empty, title: 'What Failed / Pivots' },
      keyTakeaways: { ...empty, title: 'Key Takeaways' },
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/llm.ts
git commit -m "feat: add LLM extraction and synthesis via OpenRouter"
```

---

## Task 6: Report Storage

**Files:**
- Create: `src/lib/reports.ts`

**Step 1: Implement file-based report storage**

Create `src/lib/reports.ts`:

```typescript
import { Report } from '@/types';
import { promises as fs } from 'fs';
import path from 'path';

const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports');

async function ensureDir() {
  await fs.mkdir(REPORTS_DIR, { recursive: true });
}

export async function saveReport(report: Report): Promise<void> {
  await ensureDir();
  const filePath = path.join(REPORTS_DIR, `${report.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2));
}

export async function getReport(id: string): Promise<Report | null> {
  try {
    const filePath = path.join(REPORTS_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function listReports(): Promise<{ id: string; personName: string; createdAt: string }[]> {
  await ensureDir();
  const files = await fs.readdir(REPORTS_DIR);
  const reports: { id: string; personName: string; createdAt: string }[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf-8');
      const report: Report = JSON.parse(content);
      reports.push({
        id: report.id,
        personName: report.personName,
        createdAt: report.createdAt,
      });
    } catch {
      // Skip malformed files
    }
  }

  return reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
```

**Step 2: Commit**

```bash
git add src/lib/reports.ts
git commit -m "feat: add file-based report storage"
```

---

## Task 7: Analysis API Route

**Files:**
- Create: `src/app/api/analyze/route.ts`

**Step 1: Implement the analysis endpoint**

Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { AnalyzeRequest, Report, UnifiedPost } from '@/types';
import { fetchLinkedInPosts, linkedInPostsToUnified } from '@/lib/linkedin';
import { fetchTwitterPosts, tweetsToUnified } from '@/lib/twitter';
import { extractInsights, synthesizeReport } from '@/lib/llm';
import { saveReport } from '@/lib/reports';

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { linkedinUrl, twitterHandle, timeRange } = body;

    if (!linkedinUrl && !twitterHandle) {
      return NextResponse.json(
        { error: 'At least one of LinkedIn URL or Twitter handle is required' },
        { status: 400 }
      );
    }

    if (!timeRange) {
      return NextResponse.json({ error: 'Time range is required' }, { status: 400 });
    }

    // Fetch posts from both platforms in parallel
    let personName = '';
    let personHeadline: string | undefined;
    const allPosts: UnifiedPost[] = [];

    const fetchPromises: Promise<void>[] = [];

    if (linkedinUrl) {
      fetchPromises.push(
        fetchLinkedInPosts(linkedinUrl, timeRange).then(({ posts, personName: name, personHeadline: headline }) => {
          personName = name;
          personHeadline = headline;
          allPosts.push(...linkedInPostsToUnified(posts));
        })
      );
    }

    if (twitterHandle) {
      fetchPromises.push(
        fetchTwitterPosts(twitterHandle, timeRange).then(({ tweets, personName: name }) => {
          if (!personName) personName = name;
          allPosts.push(...tweetsToUnified(tweets));
        })
      );
    }

    await Promise.all(fetchPromises);

    if (allPosts.length === 0) {
      return NextResponse.json(
        { error: 'No posts found for the given profiles and time range' },
        { status: 404 }
      );
    }

    // Sort chronologically (newest first)
    allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Extract insights from posts
    const insights = await extractInsights(allPosts);

    if (insights.length === 0) {
      return NextResponse.json(
        { error: 'No actionable insights found in the posts. The person may not share specific actions/results publicly.' },
        { status: 404 }
      );
    }

    // Synthesize into report sections
    const sections = await synthesizeReport(insights, personName, allPosts.length);

    // Build and save report
    const report: Report = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      linkedinUrl,
      twitterHandle,
      timeRange,
      personName,
      personHeadline,
      totalPostsAnalyzed: allPosts.length,
      sections,
      rawInsights: insights,
    };

    await saveReport(report);

    return NextResponse.json({ reportId: report.id });
  } catch (error) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: add analysis API route"
```

---

## Task 8: Report API Route

**Files:**
- Create: `src/app/api/reports/[id]/route.ts`

**Step 1: Implement report retrieval endpoint**

Create `src/app/api/reports/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getReport } from '@/lib/reports';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const report = await getReport(id);

  if (!report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return NextResponse.json(report);
}
```

**Step 2: Commit**

```bash
git add src/app/api/reports/\[id\]/route.ts
git commit -m "feat: add report retrieval API route"
```

---

## Task 9: Input Page (Home)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Step 1: Build the input page**

Use the @frontend-design skill for this task. The page should have:

- Clean, minimal design. Dark theme preferred (founder tool, not a marketing site).
- App title "Keeping Tabs" with a brief tagline: "Distill competitor posts into actionable lessons"
- Form with:
  - LinkedIn URL input (placeholder: "https://linkedin.com/in/username")
  - Twitter/X handle input (placeholder: "@handle")
  - Time range select (3 months, 6 months, 1 year, 2 years)
  - "Analyze" button
- Validation: at least one URL required
- Loading state: show progress while analysis runs (this can take 30-60 seconds)
- On success: redirect to `/report/{id}`
- On error: show error message inline

The page is a client component that calls `POST /api/analyze`.

**Step 2: Update layout.tsx**

Set the page title to "Keeping Tabs" and add appropriate meta description.

**Step 3: Test the input page**

Run: `bun dev`
Visit: http://localhost:3000
Verify: Form renders, validation works, submit sends POST request

**Step 4: Commit**

```bash
git add src/app/page.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat: add input page with analyze form"
```

---

## Task 10: Report Page

**Files:**
- Create: `src/app/report/[id]/page.tsx`

**Step 1: Build the report page**

Use the @frontend-design skill for this task. The report page should:

- Fetch report data from `/api/reports/{id}` on load
- Show person's name and headline at the top
- Display metadata: platforms analyzed, time range, total posts analyzed, date generated
- Render each of the 5 report sections:
  - Section title
  - List of insights, each with:
    - The insight text
    - Small link icon(s) to source post(s) - clicking opens in new tab
- Clean typography, easy to read, easy to share
- 404 state if report not found
- Loading state while fetching

Design: The report IS the product. It should feel like reading a well-formatted brief, not a dashboard. Think "Stripe docs" clarity, not "SaaS dashboard" busy.

**Step 2: Test the report page**

This requires running a full analysis first. Test with a real LinkedIn URL or Twitter handle.

**Step 3: Commit**

```bash
git add src/app/report/\[id\]/page.tsx
git commit -m "feat: add report page with structured insights display"
```

---

## Task 11: End-to-End Test

**Step 1: Start the dev server**

Run: `bun dev`

**Step 2: Run a real analysis**

Visit http://localhost:3000, enter a real LinkedIn URL and/or Twitter handle, select a time range, and click Analyze. Wait for the report to generate.

Suggested test profiles (pick one):
- LinkedIn: a well-known founder who posts regularly
- Twitter: a well-known founder who tweets about their strategies

**Step 3: Verify the report**

Check:
- Report loads at `/report/{id}`
- All 5 sections are populated (or empty where appropriate)
- Source links work and open correct posts
- Report is readable and the insights are specific (not generic fluff)
- JSON file exists in `data/reports/`

**Step 4: Fix any issues found**

Debug and fix any issues from the E2E test.

---

## Task 12: Deploy to Dokku

**Step 1: Create Dockerfile or Procfile**

Create `Dockerfile`:
```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
RUN mkdir -p data/reports
EXPOSE 3000
ENV PORT=3000
CMD ["bun", "server.js"]
```

Update `next.config.ts` to enable standalone output:
```typescript
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;
```

**Step 2: Create dokku app**

Run:
```bash
ssh dokku@dokku-server apps:create keeping-tabs
ssh dokku@dokku-server domains:add keeping-tabs keeping-tabs.whhite.com
```

**Step 3: Set environment variables**

Run:
```bash
ssh dokku@dokku-server config:set keeping-tabs RAPIDAPI_KEY=770fa21dd5msh79ff562f8742782p1a2fa4jsn5bcd13e558b8
ssh dokku@dokku-server config:set keeping-tabs SOCIALDATA_API_KEY="4296|0opWEhALMMBiQcugvVMVrcJQOHXmISGUzceEPDvb760bb0be"
ssh dokku@dokku-server config:set keeping-tabs OPENROUTER_API_KEY=<value from .env>
```

**Step 4: Add persistent storage for reports**

Run:
```bash
ssh dokku@dokku-server storage:ensure-directory keeping-tabs
ssh dokku@dokku-server storage:mount keeping-tabs /var/lib/dokku/data/storage/keeping-tabs:/app/data
```

**Step 5: Deploy**

Run:
```bash
git remote add dokku dokku@dokku-server:keeping-tabs
git push dokku main
```

**Step 6: Verify deployment**

Visit: https://keeping-tabs.whhite.com
Run an analysis and verify the report generates correctly.

**Step 7: Commit any deployment fixes**

```bash
git add Dockerfile next.config.ts
git commit -m "feat: add Dockerfile and configure for dokku deployment"
```

---

## Task 13: Browser Testing

Use the @dev-browser skill to:

1. Open https://keeping-tabs.whhite.com
2. Verify the input page loads
3. Enter a real LinkedIn URL and Twitter handle
4. Click Analyze
5. Wait for the report to generate
6. Verify the report renders correctly
7. Check for console errors
8. Test sharing the report URL in a new tab

Fix any issues found and re-deploy.

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Project scaffolding | Simple |
| 2 | Type definitions | Simple |
| 3 | LinkedIn post fetcher | Medium (adapted from Speakoro) |
| 4 | Twitter post fetcher | Medium (new SocialData integration) |
| 5 | LLM extraction & synthesis | Medium (prompt engineering) |
| 6 | Report storage | Simple |
| 7 | Analysis API route | Medium (orchestration) |
| 8 | Report API route | Simple |
| 9 | Input page UI | Medium (design) |
| 10 | Report page UI | Medium (design) |
| 11 | End-to-end test | Medium |
| 12 | Deploy to dokku | Medium |
| 13 | Browser testing | Simple |
