import { Page } from 'playwright';
import type { ElementHandle } from 'playwright';
import { Selectors } from '../types';
import { log } from './logger';

export interface SelectorResult {
  success: boolean;
  reason?: 'not_found' | 'timeout' | 'detached' | 'error';
  selector?: string;
  url?: string;
  error?: Error;
}

export function validateSelectors(selectors: Selectors): void {
  if (!selectors || typeof selectors !== 'object') {
    throw new Error('selectors 配置无效：不是对象');
  }

  const errors: string[] = [];
  for (const [key, value] of Object.entries(selectors)) {
    if (value === undefined) {
      continue;
    }
    if (typeof value !== 'string') {
      errors.push(`${key} 必须是字符串`);
      continue;
    }
    if (value.trim().length === 0) {
      errors.push(`${key} 不能为空字符串`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`selectors 配置无效：${errors.join('；')}`);
  }
}

export interface TweetInfo {
  tweetId: string | null;
  authorHandle: string | null;
  textPreview: string | null;
}

export interface UserInfo {
  handle: string | null;
  displayName: string | null;
}

/**
 * 元素选择器工具类
 */
export class SelectorHelper {
  constructor(
    private page: Page,
    private selectors: Selectors
  ) {}

  private getUrlSafe(): string {
    try {
      return this.page.url();
    } catch {
      return '';
    }
  }

  private classifyError(error: unknown): SelectorResult['reason'] {
    if (!error) {
      return 'error';
    }

    const maybeError = error as { name?: string; message?: string };
    const name = maybeError.name || '';
    const message = maybeError.message || '';

    if (name === 'TimeoutError' || /timeout/i.test(message)) {
      return 'timeout';
    }
    if (/not attached|detached|Element is not attached/i.test(message)) {
      return 'detached';
    }
    return 'error';
  }

  /**
   * 等待并获取元素
   * @param selector 选择器
   * @param timeout 超时时间
   * @param selectorName 选择器名称（用于日志）
   */
  async waitForElement(
    selector: string,
    timeout = 10000,
    selectorName?: string
  ): Promise<SelectorResult> {
    const url = this.getUrlSafe();
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'visible' });
      return { success: true, selector, url };
    } catch (error) {
      const reason = this.classifyError(error);
      const err = error instanceof Error ? error : new Error(String(error));
      log.debug(
        `选择器操作失败: waitForElement (${selectorName || 'unknown'})`,
        {
          operation: 'waitForElement',
          selectorName,
          selector,
          url,
          reason,
        },
        err
      );
      return { success: false, reason, selector, url, error: err };
    }
  }

  /**
   * 安全点击元素
   * @param selector 选择器
   * @param timeout 超时时间
   * @param selectorName 选择器名称（用于日志）
   */
  async safeClick(
    selector: string,
    timeout = 10000,
    selectorName?: string
  ): Promise<SelectorResult> {
    const url = this.getUrlSafe();
    try {
      const element = await this.page.waitForSelector(selector, {
        timeout,
        state: 'visible',
      });

      if (element) {
        await element.click();
        return { success: true, selector, url };
      }
      log.debug(`选择器未找到: safeClick (${selectorName || 'unknown'})`, {
        operation: 'safeClick',
        selectorName,
        selector,
        url,
        reason: 'not_found',
      });
      return { success: false, reason: 'not_found', selector, url };
    } catch (error) {
      const reason = this.classifyError(error);
      const err = error instanceof Error ? error : new Error(String(error));
      log.debug(
        `选择器操作失败: safeClick (${selectorName || 'unknown'})`,
        {
          operation: 'safeClick',
          selectorName,
          selector,
          url,
          reason,
        },
        err
      );
      return { success: false, reason, selector, url, error: err };
    }
  }

  /**
   * 获取推文列表
   */
  async getTweets(): Promise<ElementHandle<Element>[]> {
    return await this.page.$$(this.selectors.tweet);
  }

  /**
   * 点击推文的"更多"按钮
   * @param tweetElement 推文元素
   */
  async clickTweetMore(tweetElement: ElementHandle<Element>): Promise<boolean> {
    try {
      const moreButton = await tweetElement.$(this.selectors.tweetMoreButton);
      if (moreButton) {
        await moreButton.waitForElementState('visible', { timeout: 3000 });
        await moreButton.click();
        await this.page.waitForTimeout(500);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('点击更多按钮失败', error);
      return false;
    }
  }

  /**
   * 点击删除按钮
   */
  async clickDelete(): Promise<boolean> {
    try {
      // 等待菜单出现
      await this.page.waitForTimeout(500);

      const deleteButton = await this.page.waitForSelector(this.selectors.deleteButton, {
        timeout: 3000,
        state: 'visible',
      });
      if (deleteButton) {
        await deleteButton.click();
        await this.page.waitForTimeout(500);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('点击删除按钮失败', error);
      return false;
    }
  }

  /**
   * 确认删除
   */
  async confirmDelete(): Promise<boolean> {
    try {
      const confirmButton = await this.page.waitForSelector(this.selectors.confirmDeleteButton, {
        timeout: 3000,
        state: 'visible',
      });
      if (confirmButton) {
        await confirmButton.click();
        await this.page.waitForTimeout(1000);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('确认删除失败', error);
      return false;
    }
  }

  /**
   * 取消转推
   * @param tweetElement 推文元素
   */
  async unretweet(tweetElement: ElementHandle<Element>): Promise<boolean> {
    try {
      const unretweetButton = await tweetElement.$(this.selectors.unretweet);
      if (unretweetButton) {
        await unretweetButton.waitForElementState('visible', { timeout: 3000 });
        await unretweetButton.click();
        await this.page.waitForTimeout(500);

        const confirmButton = await this.page.waitForSelector(this.selectors.unretweetConfirm, {
          timeout: 3000,
          state: 'visible',
        });
        if (confirmButton) {
          await confirmButton.click();
          await this.page.waitForTimeout(1000);
          return true;
        }
      }
      return false;
    } catch (error) {
      log.debug('取消转推失败', error);
      return false;
    }
  }

  /**
   * 滚动到页面底部以加载更多内容
   */
  async scrollToBottom() {
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await this.page.waitForTimeout(1000);
  }

  /**
   * 滚动到页面顶部
   */
  async scrollToTop() {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await this.page.waitForTimeout(500);
  }

  /**
   * 取消点赞
   * @param tweetElement 推文元素
   */
  async unlike(tweetElement: ElementHandle<Element>): Promise<boolean> {
    try {
      const unlikeButton = await tweetElement.$(this.selectors.unlikeButton);
      if (unlikeButton) {
        await unlikeButton.waitForElementState('visible', { timeout: 3000 });
        await unlikeButton.click();
        await this.page.waitForTimeout(500);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('取消点赞失败', error);
      return false;
    }
  }

  /**
   * 删除书签
   * @param tweetElement 推文元素
   */
  async removeBookmark(tweetElement: ElementHandle<Element>): Promise<boolean> {
    try {
      // 书签页的推文操作栏通常直接带“移除书签”按钮，优先走这条路径，
      // 不用打开更多菜单，减少一次点击和一次菜单等待。
      const inlineRemoveButton = await tweetElement.$(this.selectors.removeBookmarkButton);
      if (inlineRemoveButton) {
        await inlineRemoveButton.waitForElementState('visible', { timeout: 3000 });
        await inlineRemoveButton.click();
        await this.page.waitForTimeout(500);
        return true;
      }

      // 回退路径：通过“更多”菜单里的移除书签菜单项
      const moreButton = await tweetElement.$(this.selectors.tweetMoreButton);
      if (!moreButton) {
        return false;
      }
      await moreButton.waitForElementState('visible', { timeout: 3000 });
      await moreButton.click();
      await this.page.waitForTimeout(500);

      // 点击删除书签按钮
      const removeButton = await this.page.waitForSelector(this.selectors.removeBookmarkButton, {
        timeout: 3000,
        state: 'visible',
      });
      if (removeButton) {
        await removeButton.click();
        await this.page.waitForTimeout(500);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('删除书签失败', error);
      return false;
    }
  }

  /**
   * 获取关注列表中的用户元素
   */
  async getFollowingUsers(): Promise<ElementHandle<Element>[]> {
    try {
      // 使用配置中的 userCell 选择器，如果不存在则使用默认值
      const selector = this.selectors.userCell || '[data-testid="UserCell"]';
      return await this.page.$$(selector);
    } catch (error) {
      log.debug('获取关注用户列表失败', error);
      return [];
    }
  }

  /**
   * 取消关注用户
   * @param userElement 用户元素
   */
  async unfollowUser(userElement: ElementHandle<Element>): Promise<boolean> {
    try {
      // 查找"正在关注"按钮
      const followingButton = await userElement.$(this.selectors.followingButton);
      if (!followingButton) {
        // 尝试备用选择器
        const unfollowBtn = await userElement.$('[data-testid*="unfollow"]');
        if (!unfollowBtn) {
          return false;
        }
        await unfollowBtn.waitForElementState('visible', { timeout: 3000 });
        await unfollowBtn.click();
      } else {
        await followingButton.waitForElementState('visible', { timeout: 3000 });
        await followingButton.click();
      }

      await this.page.waitForTimeout(500);

      // 确认取消关注
      const confirmButton = await this.page.waitForSelector(this.selectors.unfollowConfirm, {
        timeout: 3000,
        state: 'visible',
      });
      if (confirmButton) {
        await confirmButton.click();
        await this.page.waitForTimeout(1000);
        return true;
      }
      return false;
    } catch (error) {
      log.debug('取消关注失败', error);
      return false;
    }
  }

  /**
   * 提取推文标识信息（用于删除前记录）
   */
  async extractTweetInfo(tweetElement: ElementHandle<Element>): Promise<TweetInfo> {
    try {
      const info = await tweetElement.evaluate((el) => {
        // 尝试从推文链接提取 ID
        const tweetLink = el.querySelector('a[href*="/status/"]');
        let tweetId: string | null = null;
        if (tweetLink) {
          const href = tweetLink.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          if (match) {
            tweetId = match[1];
          }
        }

        // 提取作者 handle
        const authorLink = el.querySelector('a[href^="/"][role="link"]');
        let authorHandle: string | null = null;
        if (authorLink) {
          const href = authorLink.getAttribute('href') || '';
          const match = href.match(/^\/([^/]+)$/);
          if (match && !['home', 'explore', 'notifications', 'messages'].includes(match[1])) {
            authorHandle = match[1];
          }
        }

        // 提取文本预览（前 50 字符）
        const tweetText = el.querySelector('[data-testid="tweetText"]');
        let textPreview: string | null = null;
        if (tweetText) {
          const text = tweetText.textContent || '';
          textPreview = text.length > 50 ? text.substring(0, 50) + '...' : text;
        }

        return { tweetId, authorHandle, textPreview };
      });
      return info;
    } catch (error) {
      log.debug('提取推文信息失败', error);
      return { tweetId: null, authorHandle: null, textPreview: null };
    }
  }

  /**
   * 提取用户标识信息（用于取消关注前记录）
   */
  async extractUserInfo(userElement: ElementHandle<Element>): Promise<UserInfo> {
    try {
      const info = await userElement.evaluate((el) => {
        // 提取用户 handle
        const userLink = el.querySelector('a[href^="/"][role="link"]');
        let handle: string | null = null;
        if (userLink) {
          const href = userLink.getAttribute('href') || '';
          const match = href.match(/^\/([^/]+)$/);
          if (match) {
            handle = match[1];
          }
        }

        // 提取显示名称
        const nameSpan = el.querySelector('[dir="ltr"] span');
        const displayName = nameSpan?.textContent || null;

        return { handle, displayName };
      });
      return info;
    } catch (error) {
      log.debug('提取用户信息失败', error);
      return { handle: null, displayName: null };
    }
  }
}
