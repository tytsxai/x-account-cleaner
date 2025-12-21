import { Page } from 'playwright';
import type { ElementHandle } from 'playwright';
import { log } from '../utils/logger';
import { sleep, randomSleep, withRetry } from '../utils/retry';
import { SelectorHelper, TweetInfo, UserInfo } from '../utils/selector';
import { Config, ContentType, DeleteStats } from '../types';

/**
 * Twitter 内容删除器
 */
export class TwitterDeleter {
  private selectorHelper: SelectorHelper;
  private stats: DeleteStats = {
    tweets: 0,
    retweets: 0,
    replies: 0,
    likes: 0,
    bookmarks: 0,
    following: 0,
    errors: 0,
  };

  constructor(
    private page: Page,
    private config: Config
  ) {
    this.selectorHelper = new SelectorHelper(page, config.selectors);
  }

  private getDelayJitterMs(): number {
    const jitter = this.config.executionConfig.delayJitterMs;
    if (jitter === undefined || !Number.isFinite(jitter)) {
      return 1000;
    }
    return Math.max(0, jitter);
  }

  private async sleepBetweenActions(): Promise<void> {
    const { delayBetweenActions } = this.config.executionConfig;
    const minDelay = Math.max(0, delayBetweenActions);
    const maxDelay = minDelay + this.getDelayJitterMs();
    if (maxDelay === 0) {
      return;
    }
    await randomSleep(minDelay, maxDelay);
  }

  private shouldRefresh(batchCount: number): boolean {
    const interval = this.config.executionConfig.refreshBatchInterval ?? 1;
    return interval <= 1 ? true : batchCount % interval === 0;
  }

  private async waitForContentReady(type: ContentType): Promise<void> {
    const { pageRefreshDelay } = this.config.executionConfig;
    if (!Number.isFinite(pageRefreshDelay) || pageRefreshDelay <= 0) {
      return;
    }

    const selector =
      type === ContentType.FOLLOWING
        ? this.config.selectors.userCell || '[data-testid="UserCell"]'
        : this.config.selectors.tweet;

    try {
      await this.page.waitForSelector(selector, {
        timeout: pageRefreshDelay,
        state: 'attached',
      });
    } catch {
      // 忽略超时，保持与原有延迟行为一致
    }
  }

  /**
   * 开始删除流程
   */
  async startDeleting(username: string): Promise<DeleteStats> {
    log.info('开始删除流程...');

    const { deleteOptions } = this.config;
    let totalDeleted = 0;

    try {
      // 删除推文
      if (deleteOptions.tweets) {
        log.info('准备删除推文...');
        const url = this.config.urls.tweets.replace('{username}', username);
        const deleted = await this.deleteContentType(url, ContentType.TWEETS);
        this.stats.tweets = deleted;
        totalDeleted += deleted;
      }

      // 删除回复
      if (deleteOptions.replies) {
        log.info('准备删除回复...');
        const url = this.config.urls.tweetsWithReplies.replace('{username}', username);
        const deleted = await this.deleteContentType(url, ContentType.REPLIES);
        this.stats.replies = deleted;
        totalDeleted += deleted;
      }

      // 取消转推
      if (deleteOptions.retweets) {
        log.info('准备取消转推...');
        const url = this.config.urls.tweets.replace('{username}', username);
        const deleted = await this.unretweets(url);
        this.stats.retweets = deleted;
        totalDeleted += deleted;
      }

      // 取消点赞
      if (deleteOptions.likes) {
        log.info('准备取消点赞...');
        const url = this.config.urls.likes.replace('{username}', username);
        const deleted = await this.unlikes(url);
        this.stats.likes = deleted;
        totalDeleted += deleted;
      }

      // 删除书签
      if (deleteOptions.bookmarks) {
        log.info('准备删除书签...');
        const url = this.config.urls.bookmarks;
        const deleted = await this.removeBookmarks(url);
        this.stats.bookmarks = deleted;
        totalDeleted += deleted;
      }

      // 取消关注
      if (deleteOptions.following) {
        log.info('准备取消关注...');
        const url = this.config.urls.following.replace('{username}', username);
        const deleted = await this.unfollowUsers(url);
        this.stats.following = deleted;
        totalDeleted += deleted;
      }

      log.success(`删除完成！总计清理 ${totalDeleted} 项内容`);
      this.printStats();

      return this.stats;
    } catch (error) {
      log.error('删除流程出错', error);
      throw error;
    }
  }

  private getPathname(url: string): string {
    try {
      return new URL(url).pathname;
    } catch (error) {
      return url;
    }
  }

  private async ensureSessionActive(context: string): Promise<void> {
    const url = this.page.url();
    const pathname = this.getPathname(url);
    const blockedPrefixes = ['/i/flow', '/login', '/account/access'];

    if (blockedPrefixes.some((blocked) => pathname.startsWith(blocked))) {
      throw new Error(`检测到登录失效或需要验证 (${context})，请重新登录后再继续`);
    }

    const loginField = await this.page.$('input[autocomplete="username"]');
    if (loginField) {
      throw new Error(`检测到登录页面 (${context})，请重新登录后再继续`);
    }

    const verificationField = await this.page.$('input[data-testid="ocfEnterTextTextInput"]');
    if (verificationField) {
      throw new Error(`检测到账号验证页面 (${context})，请重新登录后再继续`);
    }

    await this.detectBlockingState(context);
  }

  private async detectBlockingState(context: string): Promise<void> {
    let alertText = '';

    try {
      const alertLocator = this.page.locator('[role="alert"], [data-testid="toast"]');
      const contents = await alertLocator.allTextContents();
      alertText = contents.join(' ').trim();
    } catch {
      alertText = '';
    }

    if (!alertText) {
      return;
    }

    const patterns: Array<{ label: string; pattern: RegExp }> = [
      {
        label: '触发频率限制',
        pattern: /rate limit|too many requests|请求过多|频率限制|请稍后再试/i,
      },
      { label: '页面异常', pattern: /something went wrong|出了点问题|出错了|发生错误/i },
      { label: '账号受限', pattern: /account locked|账号已锁定|账号已暂停|suspended/i },
    ];

    for (const item of patterns) {
      if (item.pattern.test(alertText)) {
        throw new Error(`检测到阻断提示 (${item.label})，请稍后重试 (${context})`);
      }
    }
  }

  /**
   * 删除指定类型的内容
   */
  private async deleteContentType(url: string, type: ContentType): Promise<number> {
    const { executionConfig } = this.config;
    let totalDeleted = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    let batchCount = 0;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForContentReady(type);
    await this.ensureSessionActive(`${type} 初始化`);

    while (totalDeleted < executionConfig.maxDeletePerSession) {
      await this.ensureSessionActive(`${type} 批次检查`);
      // 每批删除
      const deletedInBatch = await this.deleteBatch(type);

      if (deletedInBatch === 0) {
        consecutiveFailures++;
        log.warn(
          `本批次未删除任何内容 (连续失败: ${consecutiveFailures}/${maxConsecutiveFailures})`
        );

        if (consecutiveFailures >= maxConsecutiveFailures) {
          log.info('连续多次未找到可删除内容，可能已全部删除完毕');
          break;
        }

        // 尝试滚动加载更多
        await this.selectorHelper.scrollToBottom();
        await sleep(2000);
        continue;
      }

      consecutiveFailures = 0;
      totalDeleted += deletedInBatch;

      log.info(`${type} 已删除: ${totalDeleted}/${executionConfig.maxDeletePerSession}`);

      // 检查是否达到最大删除数量
      if (totalDeleted >= executionConfig.maxDeletePerSession) {
        log.info(`已达到最大删除数量: ${executionConfig.maxDeletePerSession}`);
        break;
      }

      // 刷新页面
      batchCount += 1;
      if (this.shouldRefresh(batchCount)) {
        log.info('刷新页面...');
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForContentReady(type);
        await this.ensureSessionActive(`${type} 刷新后检查`);
      }
    }

    return totalDeleted;
  }

  /**
   * 删除一批内容
   */
  private async deleteBatch(type: ContentType): Promise<number> {
    const { executionConfig } = this.config;
    let deleted = 0;

    try {
      // 滚动到顶部
      await this.selectorHelper.scrollToTop();
      await sleep(1000);

      // 获取推文列表
      const tweets = await this.selectorHelper.getTweets();

      if (tweets.length === 0) {
        log.debug('未找到推文元素');
        return 0;
      }

      log.debug(`找到 ${tweets.length} 条推文`);

      // 删除指定数量
      const deleteCount = Math.min(executionConfig.deletePerBatch, tweets.length);

      for (let i = 0; i < deleteCount; i++) {
        try {
          // 删除前记录推文信息
          const tweetInfo = await this.selectorHelper.extractTweetInfo(tweets[i]);
          this.logDeletionTarget(type, tweetInfo);

          const success = await this.deleteSingleTweet(tweets[i], type);

          if (success) {
            deleted++;
            await this.sleepBetweenActions();
          } else {
            this.stats.errors++;
          }
        } catch (error) {
          this.stats.errors++;
          log.warn(`删除 ${type} 失败，已跳过`, error);
        }
      }

      await sleep(executionConfig.delayBetweenBatches);
    } catch (error) {
      log.error('删除批次出错', error);
      this.stats.errors++;
    }

    return deleted;
  }

  /**
   * 删除单条推文
   */
  private async deleteSingleTweet(
    tweetElement: ElementHandle<Element>,
    type: ContentType
  ): Promise<boolean> {
    return await withRetry(
      async () => {
        // 点击"更多"按钮
        const moreClicked = await this.selectorHelper.clickTweetMore(tweetElement);
        if (!moreClicked) {
          throw new Error('无法点击更多按钮');
        }

        // 点击删除
        const deleteClicked = await this.selectorHelper.clickDelete();
        if (!deleteClicked) {
          // 可能不是自己的推文，或者是转推
          throw new Error('未找到删除按钮');
        }

        // 确认删除
        const confirmed = await this.selectorHelper.confirmDelete();
        if (!confirmed) {
          throw new Error('无法确认删除');
        }

        log.debug(`成功删除一条 ${type}`);
        return true;
      },
      this.config.retryConfig,
      `删除 ${type}`
    );
  }

  /**
   * 取消转推
   */
  private async unretweets(url: string): Promise<number> {
    const { executionConfig } = this.config;
    let totalUnretweeted = 0;
    let consecutiveFailures = 0;
    let batchCount = 0;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForContentReady(ContentType.RETWEETS);
    await this.ensureSessionActive('取消转推 初始化');

    while (totalUnretweeted < executionConfig.maxDeletePerSession) {
      await this.ensureSessionActive('取消转推 批次检查');
      await this.selectorHelper.scrollToTop();
      await sleep(1000);

      const tweets = await this.selectorHelper.getTweets();

      if (tweets.length === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) break;
        await this.selectorHelper.scrollToBottom();
        continue;
      }

      let unretweetedInBatch = 0;
      const processCount = Math.min(executionConfig.deletePerBatch, tweets.length);

      for (let i = 0; i < processCount; i++) {
        try {
          // 取消转推前记录推文信息
          const tweetInfo = await this.selectorHelper.extractTweetInfo(tweets[i]);
          this.logDeletionTarget(ContentType.RETWEETS, tweetInfo);

          const success = await this.selectorHelper.unretweet(tweets[i]);
          if (success) {
            unretweetedInBatch++;
            await this.sleepBetweenActions();
          } else {
            this.stats.errors++;
            log.debug('取消转推失败，已跳过');
          }
        } catch (error) {
          this.stats.errors++;
          log.warn('取消转推失败，已跳过', error);
        }
      }

      if (unretweetedInBatch === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) break;
      } else {
        consecutiveFailures = 0;
        totalUnretweeted += unretweetedInBatch;
        log.info(`已取消转推: ${totalUnretweeted}/${executionConfig.maxDeletePerSession}`);
      }

      batchCount += 1;
      if (this.shouldRefresh(batchCount)) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForContentReady(ContentType.RETWEETS);
        await this.ensureSessionActive('取消转推 刷新后检查');
      }
    }

    return totalUnretweeted;
  }

  /**
   * 取消点赞
   */
  private async unlikes(url: string): Promise<number> {
    const { executionConfig } = this.config;
    let totalUnliked = 0;
    let consecutiveFailures = 0;
    let batchCount = 0;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForContentReady(ContentType.LIKES);
    await this.ensureSessionActive('取消点赞 初始化');

    log.info('开始取消点赞...');

    while (totalUnliked < executionConfig.maxDeletePerSession) {
      await this.ensureSessionActive('取消点赞 批次检查');
      await this.selectorHelper.scrollToTop();
      await sleep(1000);

      const tweets = await this.selectorHelper.getTweets();

      if (tweets.length === 0) {
        consecutiveFailures++;
        log.debug(`未找到推文，连续失败: ${consecutiveFailures}/3`);
        if (consecutiveFailures >= 3) {
          log.info('未找到更多点赞内容');
          break;
        }
        await this.selectorHelper.scrollToBottom();
        await sleep(2000);
        continue;
      }

      let unlikedInBatch = 0;
      const processCount = Math.min(executionConfig.deletePerBatch, tweets.length);

      for (let i = 0; i < processCount; i++) {
        try {
          // 取消点赞前记录推文信息
          const tweetInfo = await this.selectorHelper.extractTweetInfo(tweets[i]);
          this.logDeletionTarget(ContentType.LIKES, tweetInfo);

          const success = await this.selectorHelper.unlike(tweets[i]);
          if (success) {
            unlikedInBatch++;
            log.debug(`成功取消一个点赞`);
            await this.sleepBetweenActions();
          } else {
            this.stats.errors++;
            log.debug('取消点赞失败，已跳过');
          }
        } catch (error) {
          this.stats.errors++;
          log.warn('取消点赞失败，已跳过', error);
        }
      }

      if (unlikedInBatch === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          log.info('连续多次未能取消点赞，可能已全部完成');
          break;
        }
      } else {
        consecutiveFailures = 0;
        totalUnliked += unlikedInBatch;
        log.info(`已取消点赞: ${totalUnliked}/${executionConfig.maxDeletePerSession}`);
      }

      if (totalUnliked >= executionConfig.maxDeletePerSession) {
        log.info(`已达到最大取消数量: ${executionConfig.maxDeletePerSession}`);
        break;
      }

      batchCount += 1;
      if (this.shouldRefresh(batchCount)) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForContentReady(ContentType.LIKES);
        await this.ensureSessionActive('取消点赞 刷新后检查');
      }
    }

    return totalUnliked;
  }

  /**
   * 删除书签
   */
  private async removeBookmarks(url: string): Promise<number> {
    const { executionConfig } = this.config;
    let totalRemoved = 0;
    let consecutiveFailures = 0;
    let batchCount = 0;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForContentReady(ContentType.BOOKMARKS);
    await this.ensureSessionActive('删除书签 初始化');

    log.info('开始删除书签...');

    while (totalRemoved < executionConfig.maxDeletePerSession) {
      await this.ensureSessionActive('删除书签 批次检查');
      await this.selectorHelper.scrollToTop();
      await sleep(1000);

      const tweets = await this.selectorHelper.getTweets();

      if (tweets.length === 0) {
        consecutiveFailures++;
        log.debug(`未找到书签，连续失败: ${consecutiveFailures}/3`);
        if (consecutiveFailures >= 3) {
          log.info('未找到更多书签');
          break;
        }
        await this.selectorHelper.scrollToBottom();
        await sleep(2000);
        continue;
      }

      let removedInBatch = 0;
      const processCount = Math.min(executionConfig.deletePerBatch, tweets.length);

      for (let i = 0; i < processCount; i++) {
        try {
          // 删除书签前记录推文信息
          const tweetInfo = await this.selectorHelper.extractTweetInfo(tweets[i]);
          this.logDeletionTarget(ContentType.BOOKMARKS, tweetInfo);

          const success = await this.selectorHelper.removeBookmark(tweets[i]);
          if (success) {
            removedInBatch++;
            log.debug(`成功删除一个书签`);
            await this.sleepBetweenActions();
          } else {
            this.stats.errors++;
            log.debug('删除书签失败，已跳过');
          }
        } catch (error) {
          this.stats.errors++;
          log.warn('删除书签失败，已跳过', error);
        }
      }

      if (removedInBatch === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          log.info('连续多次未能删除书签，可能已全部完成');
          break;
        }
      } else {
        consecutiveFailures = 0;
        totalRemoved += removedInBatch;
        log.info(`已删除书签: ${totalRemoved}/${executionConfig.maxDeletePerSession}`);
      }

      if (totalRemoved >= executionConfig.maxDeletePerSession) {
        log.info(`已达到最大删除数量: ${executionConfig.maxDeletePerSession}`);
        break;
      }

      batchCount += 1;
      if (this.shouldRefresh(batchCount)) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForContentReady(ContentType.BOOKMARKS);
        await this.ensureSessionActive('删除书签 刷新后检查');
      }
    }

    return totalRemoved;
  }

  /**
   * 取消关注用户
   */
  private async unfollowUsers(url: string): Promise<number> {
    const { executionConfig } = this.config;
    let totalUnfollowed = 0;
    let consecutiveFailures = 0;
    let batchCount = 0;

    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitForContentReady(ContentType.FOLLOWING);
    await this.ensureSessionActive('取消关注 初始化');

    log.info('开始取消关注...');

    while (totalUnfollowed < executionConfig.maxDeletePerSession) {
      await this.ensureSessionActive('取消关注 批次检查');
      await this.selectorHelper.scrollToTop();
      await sleep(1000);

      const users = await this.selectorHelper.getFollowingUsers();

      if (users.length === 0) {
        consecutiveFailures++;
        log.debug(`未找到关注用户，连续失败: ${consecutiveFailures}/3`);
        if (consecutiveFailures >= 3) {
          log.info('未找到更多关注用户');
          break;
        }
        await this.selectorHelper.scrollToBottom();
        await sleep(2000);
        continue;
      }

      let unfollowedInBatch = 0;
      const processCount = Math.min(executionConfig.deletePerBatch, users.length);

      for (let i = 0; i < processCount; i++) {
        try {
          // 取消关注前记录用户信息
          const userInfo = await this.selectorHelper.extractUserInfo(users[i]);
          this.logDeletionTarget(ContentType.FOLLOWING, userInfo);

          const success = await this.selectorHelper.unfollowUser(users[i]);
          if (success) {
            unfollowedInBatch++;
            log.debug(`成功取消关注一个用户`);
            await this.sleepBetweenActions();
          } else {
            this.stats.errors++;
            log.debug('取消关注失败，已跳过');
          }
        } catch (error) {
          this.stats.errors++;
          log.warn('取消关注失败，已跳过', error);
        }
      }

      if (unfollowedInBatch === 0) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          log.info('连续多次未能取消关注，可能已全部完成');
          break;
        }
      } else {
        consecutiveFailures = 0;
        totalUnfollowed += unfollowedInBatch;
        log.info(`已取消关注: ${totalUnfollowed}/${executionConfig.maxDeletePerSession}`);
      }

      if (totalUnfollowed >= executionConfig.maxDeletePerSession) {
        log.info(`已达到最大取消关注数量: ${executionConfig.maxDeletePerSession}`);
        break;
      }

      batchCount += 1;
      if (this.shouldRefresh(batchCount)) {
        await this.page.reload({ waitUntil: 'domcontentloaded' });
        await this.waitForContentReady(ContentType.FOLLOWING);
        await this.ensureSessionActive('取消关注 刷新后检查');
      }
    }

    return totalUnfollowed;
  }

  /**
   * 记录待删除内容的标识信息（用于事后追溯）
   */
  private logDeletionTarget(type: ContentType, info: TweetInfo | UserInfo): void {
    if ('tweetId' in info) {
      const parts: string[] = [`[DELETE_TARGET] type=${type}`];
      if (info.tweetId) parts.push(`tweetId=${info.tweetId}`);
      if (info.authorHandle) parts.push(`author=@${info.authorHandle}`);
      if (info.textPreview) parts.push(`preview="${info.textPreview}"`);
      log.info(parts.join(' '));
    } else {
      const parts: string[] = [`[DELETE_TARGET] type=${type}`];
      if (info.handle) parts.push(`handle=@${info.handle}`);
      if (info.displayName) parts.push(`name="${info.displayName}"`);
      log.info(parts.join(' '));
    }
  }

  /**
   * 打印统计信息
   */
  private printStats(): void {
    log.info('=== 清理统计 ===');
    log.info(`推文: ${this.stats.tweets}`);
    log.info(`回复: ${this.stats.replies}`);
    log.info(`转推: ${this.stats.retweets}`);
    log.info(`点赞: ${this.stats.likes}`);
    log.info(`书签: ${this.stats.bookmarks}`);
    log.info(`关注: ${this.stats.following}`);
    log.info(`错误: ${this.stats.errors}`);
    log.info('================');
  }

  /**
   * 获取统计信息
   */
  getStats(): DeleteStats {
    return { ...this.stats };
  }
}
