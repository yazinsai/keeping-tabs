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
        allPosts.push(post);
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

    if (shouldContinue && pageCount < maxPages) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return { posts: allPosts, personName, personHeadline };
}

export function linkedInPostsToUnified(posts: LinkedInPost[]): UnifiedPost[] {
  return posts
    .filter(post => post.text && post.poster)
    .map(post => ({
      platform: 'linkedin' as const,
      text: post.text,
      date: post.posted,
      url: post.post_url,
      engagement: {
        likes: post.num_reactions || 0,
        comments: post.num_comments || 0,
        shares: post.num_reposts || 0,
      },
      authorName: post.poster ? `${post.poster.first} ${post.poster.last}` : 'Unknown',
    }));
}
