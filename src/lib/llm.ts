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
          sourcePlatform: platforms.size > 1 ? 'both' : ((platforms.values().next().value as 'linkedin' | 'twitter') || 'linkedin'),
        });
      }
    } catch (e) {
      console.error('Failed to parse extraction response:', e);
    }
  }

  return allInsights;
}

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
