/**
 * 自定义删除器示例
 * 
 * 这个示例展示如何扩展 TwitterDeleter 类来实现自定义删除逻辑
 */

import { TwitterDeleter } from '../src/core/deleter';
import { Page } from 'playwright';
import { Config } from '../src/types';
import { log } from '../src/utils/logger';

/**
 * 示例 1: 按点赞数过滤的删除器
 * 只删除点赞数少于指定数量的推文
 */
export class LikeFilteredDeleter extends TwitterDeleter {
  constructor(
    page: Page,
    config: Config,
    private minLikes: number = 10
  ) {
    super(page, config);
  }

  /**
   * 检查推文是否应该被删除
   */
  private async shouldDelete(tweetElement: any): Promise<boolean> {
    try {
      // 尝试获取点赞数
      const likeButton = await tweetElement.$('[data-testid="like"]');
      if (!likeButton) return true;

      const ariaLabel = await likeButton.getAttribute('aria-label');
      if (!ariaLabel) return true;

      // 从 aria-label 中提取点赞数
      const match = ariaLabel.match(/(\d+)/);
      const likes = match ? parseInt(match[1]) : 0;

      // 只删除低互动的推文
      const shouldDelete = likes < this.minLikes;

      if (!shouldDelete) {
        log.debug(`跳过高互动推文（${likes} 个赞）`);
      }

      return shouldDelete;
    } catch (error) {
      log.debug('无法获取点赞数，默认删除', error);
      return true;
    }
  }

  // 可以覆盖其他方法来自定义行为
}

/**
 * 示例 2: 按关键词过滤的删除器
 * 只删除包含特定关键词的推文
 */
export class KeywordFilteredDeleter extends TwitterDeleter {
  constructor(
    page: Page,
    config: Config,
    private keywords: string[]
  ) {
    super(page, config);
  }

  private async shouldDelete(tweetElement: any): Promise<boolean> {
    try {
      // 获取推文文本
      const textElement = await tweetElement.$('[data-testid="tweetText"]');
      if (!textElement) return false;

      const text = await textElement.textContent();
      if (!text) return false;

      // 检查是否包含关键词
      const hasKeyword = this.keywords.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
      );

      if (hasKeyword) {
        log.debug(`找到包含关键词的推文: ${text.substring(0, 50)}...`);
      }

      return hasKeyword;
    } catch (error) {
      log.debug('无法获取推文文本', error);
      return false;
    }
  }
}

/**
 * 示例 3: 按日期过滤的删除器
 * 只删除指定日期范围内的推文
 */
export class DateFilteredDeleter extends TwitterDeleter {
  constructor(
    page: Page,
    config: Config,
    private startDate: Date,
    private endDate: Date
  ) {
    super(page, config);
  }

  private async shouldDelete(tweetElement: any): Promise<boolean> {
    try {
      // 获取推文时间
      const timeElement = await tweetElement.$('time');
      if (!timeElement) return false;

      const datetime = await timeElement.getAttribute('datetime');
      if (!datetime) return false;

      const tweetDate = new Date(datetime);

      // 检查是否在日期范围内
      const inRange = tweetDate >= this.startDate && tweetDate <= this.endDate;

      if (inRange) {
        log.debug(`找到日期范围内的推文: ${tweetDate.toLocaleDateString()}`);
      }

      return inRange;
    } catch (error) {
      log.debug('无法获取推文日期', error);
      return false;
    }
  }
}

/**
 * 示例 4: 导出后删除
 * 删除前先导出推文内容
 */
export class ExportBeforeDeleteDeleter extends TwitterDeleter {
  private exportedTweets: any[] = [];

  constructor(
    page: Page,
    config: Config,
    private exportPath: string = './exported-tweets.json'
  ) {
    super(page, config);
  }

  /**
   * 导出推文信息
   */
  private async exportTweet(tweetElement: any) {
    try {
      const textElement = await tweetElement.$('[data-testid="tweetText"]');
      const timeElement = await tweetElement.$('time');

      const text = textElement ? await textElement.textContent() : '';
      const datetime = timeElement ? await timeElement.getAttribute('datetime') : '';

      this.exportedTweets.push({
        text,
        datetime,
        exportedAt: new Date().toISOString(),
      });
    } catch (error) {
      log.error('导出推文失败', error);
    }
  }

  /**
   * 保存导出的推文到文件
   */
  private async saveExportedTweets() {
    const fs = require('fs');
    fs.writeFileSync(this.exportPath, JSON.stringify(this.exportedTweets, null, 2));
    log.success(`已导出 ${this.exportedTweets.length} 条推文到 ${this.exportPath}`);
  }
}

/**
 * 使用示例
 */
export async function exampleUsage() {
  // 这些示例展示了如何使用自定义删除器
  // 实际使用时需要在主程序中集成

  /*
  // 示例 1: 只删除点赞数少于 10 的推文
  const deleter1 = new LikeFilteredDeleter(page, config, 10);
  await deleter1.startDeleting(username);

  // 示例 2: 只删除包含特定关键词的推文
  const deleter2 = new KeywordFilteredDeleter(page, config, ['临时', '测试']);
  await deleter2.startDeleting(username);

  // 示例 3: 只删除 2023 年的推文
  const deleter3 = new DateFilteredDeleter(
    page,
    config,
    new Date('2023-01-01'),
    new Date('2023-12-31')
  );
  await deleter3.startDeleting(username);

  // 示例 4: 删除前导出
  const deleter4 = new ExportBeforeDeleteDeleter(page, config);
  await deleter4.startDeleting(username);
  */
}




























