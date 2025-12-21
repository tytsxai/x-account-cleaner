import { chromium, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { log } from '../utils/logger';
import { getEnvConfig } from '../config/config';

/**
 * 浏览器管理类
 */
export class BrowserManager {
  private browser: Browser | null = null;
  public context: BrowserContext | null = null;
  public page: Page | null = null;

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    const envConfig = getEnvConfig();

    log.info('正在启动浏览器...');

    // 确保用户数据目录存在
    const userDataDir = path.join(process.cwd(), envConfig.userDataDir);
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // 选择浏览器类型
    let browserType;
    switch (envConfig.browserType) {
      case 'firefox':
        browserType = firefox;
        break;
      case 'webkit':
        browserType = webkit;
        break;
      default:
        browserType = chromium;
    }

    // 启动浏览器
    this.browser = await browserType.launch({
      headless: envConfig.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // 创建持久化上下文（保存登录状态）
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
      storageState: this.getStorageStatePath(),
    });

    // 创建页面
    this.page = await this.context.newPage();

    // 设置默认超时
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);

    // 添加反检测脚本
    await this.page.addInitScript(() => {
      // 覆盖 webdriver 属性
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });

      // 覆盖 plugins 和 languages
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['zh-CN', 'zh', 'en-US', 'en'],
      });
    });

    log.success('浏览器启动成功');
  }

  /**
   * 获取存储状态文件路径
   */
  private getStorageStatePath(): string | undefined {
    const envConfig = getEnvConfig();
    const statePath = path.join(process.cwd(), envConfig.userDataDir, 'state.json');

    if (fs.existsSync(statePath)) {
      log.info('找到已保存的登录状态，将自动登录');
      return statePath;
    }

    return undefined;
  }

  /**
   * 保存浏览器状态（包括 Cookies）
   */
  async saveState(): Promise<void> {
    if (!this.context) {
      throw new Error('浏览器上下文未初始化');
    }

    const envConfig = getEnvConfig();
    const statePath = path.join(process.cwd(), envConfig.userDataDir, 'state.json');

    await this.context.storageState({ path: statePath });

    // 设置文件权限为 0600（仅所有者可读写），防止其他用户读取 cookie
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(statePath, 0o600);
      } catch (error) {
        log.warn('设置 state.json 文件权限失败', error);
      }
    }

    log.success('登录状态已保存');
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    const page = this.page;
    const context = this.context;
    const browser = this.browser;

    this.page = null;
    this.context = null;
    this.browser = null;

    if (page) {
      try {
        await page.close();
      } catch (error) {
        log.warn('关闭 page 失败', error);
      }
    }

    if (context) {
      try {
        await context.close();
      } catch (error) {
        log.warn('关闭 context 失败', error);
      }
    }

    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        log.warn('关闭 browser 失败', error);
      }
    }

    log.info('浏览器已关闭');
  }

  /**
   * 获取当前页面
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('页面未初始化');
    }
    return this.page;
  }
}
