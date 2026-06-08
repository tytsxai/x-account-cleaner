import { BrowserContext, Page } from 'playwright';

export interface Config {
  deleteOptions: DeleteOptions;
  executionConfig: ExecutionConfig;
  retryConfig: RetryConfig;
  selectors: Selectors;
  urls: URLs;
  followingPlan?: FollowingPlanConfig;
  followingManagement?: FollowingManagementConfig;
  cleanupRules?: CleanupRulesConfig;
}

export interface DeleteOptions {
  tweets: boolean;
  retweets: boolean;
  replies: boolean;
  likes: boolean;
  bookmarks: boolean;
  following: boolean;
}

export interface ExecutionConfig {
  maxDeletePerSession: number;
  deletePerBatch: number;
  delayBetweenActions: number;
  delayJitterMs?: number;
  delayBetweenBatches: number;
  pageRefreshDelay: number;
  refreshBatchInterval?: number;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
}

export type FollowingMode = 'export' | 'classify' | 'dry-run' | 'execute';

export interface CleanupRulesConfig {
  following?: FollowingRulesConfig;
}

export interface FollowingPlanConfig {
  mode: FollowingMode;
  input?: string;
  confirmFile?: string;
  runId?: string;
}

export interface FollowingRulesConfig {
  keepHandles: string[];
  dropHandles: string[];
  keepKeywords: string[];
  dropKeywords: string[];
  lowInfoCandidate?: boolean;
}

export interface FollowingExecutionConfig {
  minDelayMs: number;
  maxDelayMs: number;
  maxUnfollowPerSession: number;
  requireConfirmFile: boolean;
  maxConsecutiveFailures: number;
  cooldownEveryActions: number;
  cooldownMs: number;
}

export interface FollowingSafetyConfig {
  requireHeadfulForExecute: boolean;
  stopOnRiskSignals: boolean;
  riskTextPatterns: string[];
}

export interface FollowingManagementConfig {
  enabled: boolean;
  outputDir: string;
  defaultMode: FollowingMode;
  rules: FollowingRulesConfig;
  execution: FollowingExecutionConfig;
  safety: FollowingSafetyConfig;
}

export interface SelectorConfig {
  primary: string;
  fallback?: string;
  description?: string;
}

// 必填选择器键
export interface RequiredSelectors {
  tweetMoreButton: string;
  deleteButton: string;
  confirmDeleteButton: string;
  tweet: string;
  unretweet: string;
  unretweetConfirm: string;
  likeButton: string;
  unlikeButton: string;
  bookmarkButton: string;
  removeBookmarkButton: string;
  followingButton: string;
  unfollowButton: string;
  unfollowConfirm: string;
}

// 可选选择器键
export interface OptionalSelectors {
  userCell?: string;
  loginUsernameInput?: string;
  loginPasswordInput?: string;
  loginNextButton?: string;
  loginButton?: string;
  profileLink?: string;
}

// 完整选择器类型：必填 + 可选 + 索引签名（用于自定义选择器）
export type Selectors = RequiredSelectors &
  OptionalSelectors & {
    [key: string]: string | undefined;
  };

export interface SelectorsJsonConfig {
  version: string;
  lastUpdated: string;
  description: string;
  selectors: Record<string, SelectorConfig>;
  customSelectors?: Record<string, SelectorConfig>;
  meta?: Record<string, unknown>;
}

export interface URLs {
  login: string;
  profile: string;
  tweets: string;
  tweetsWithReplies: string;
  media: string;
  likes: string;
  bookmarks: string;
  following: string;
}

export interface BrowserManager {
  context: BrowserContext | null;
  page: Page | null;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

export interface LoginResult {
  success: boolean;
  message: string;
}

export interface DeleteResult {
  totalDeleted: number;
  errors: number;
  message: string;
}

export enum ContentType {
  TWEETS = 'tweets',
  RETWEETS = 'retweets',
  REPLIES = 'replies',
  LIKES = 'likes',
  BOOKMARKS = 'bookmarks',
  FOLLOWING = 'following',
}

export interface DeleteStats {
  tweets: number;
  retweets: number;
  replies: number;
  likes: number;
  bookmarks: number;
  following: number;
  errors: number;
}

export interface FollowingAccount {
  handle: string;
  displayName: string | null;
  bio: string | null;
  isVerified: boolean;
  followsYou: boolean;
  avatarUrl: string | null;
  profileUrl: string | null;
  collectedAt: string;
  sourceUrl?: string;
}

export type FollowingDecision = 'candidate' | 'keep';

export interface ClassifiedFollowing extends FollowingAccount {
  decision: FollowingDecision;
  reasons: string[];
}

export interface FollowingSessionItem {
  handle: string;
  displayName: string | null;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  reason?: string;
  processedAt?: string;
}

export interface FollowingExecutionSession {
  runId: string;
  mode: 'execute';
  inputFile: string;
  username?: string;
  startedAt: string;
  updatedAt: string;
  status: 'running' | 'completed' | 'cancelled' | 'failed';
  stopReason?: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  maxUnfollowPerSession: number;
  items: FollowingSessionItem[];
}
