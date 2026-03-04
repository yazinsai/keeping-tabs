import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { AnalyzeRequest, Report, UnifiedPost } from '@/types';
import { fetchLinkedInPosts, linkedInPostsToUnified } from '@/lib/linkedin';
import { fetchTwitterPosts, tweetsToUnified } from '@/lib/twitter';
import { extractInsights, synthesizeReport } from '@/lib/llm';
import { saveReport } from '@/lib/reports';

export const maxDuration = 120; // Allow up to 2 minutes for analysis

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

    allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const insights = await extractInsights(allPosts);

    if (insights.length === 0) {
      return NextResponse.json(
        { error: 'No actionable insights found in the posts. The person may not share specific actions/results publicly.' },
        { status: 404 }
      );
    }

    const sections = await synthesizeReport(insights, personName, allPosts.length);

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
