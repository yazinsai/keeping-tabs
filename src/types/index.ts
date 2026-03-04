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
  posted: string;
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
  tweet_created_at: string;
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
  date: string;
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
