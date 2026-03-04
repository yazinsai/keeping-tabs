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

  const cleanHandle = handle.replace(/^@/, '');

  const now = new Date();
  const sinceDate = subMonths(now, timeRangeToMonths(timeRange));
  const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
  const untilTimestamp = Math.floor(now.getTime() / 1000);

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

    const originalTweets = tweets.filter(t => t.type !== 'retweet');
    allTweets.push(...originalTweets);

    if (pageCount === 0 && tweets[0]?.user) {
      personName = tweets[0].user.name;
    }

    cursor = data.next_cursor;
    if (!cursor) break;

    pageCount++;
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
