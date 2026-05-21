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
        `--window-size=${envConfig.viewportWidth},${envConfig.viewportHeight}`,
      ],
    });

    // 创建稳定浏览器上下文：同一账号尽量长期使用同一 USER_DATA_DIR + 指纹参数
    this.context = await this.browser.newContext({
      viewport: { width: envConfig.viewportWidth, height: envConfig.viewportHeight },
      screen: { width: envConfig.viewportWidth, height: envConfig.viewportHeight },
      deviceScaleFactor: envConfig.deviceScaleFactor,
      userAgent: envConfig.userAgent,
      locale: envConfig.locale,
      timezoneId: envConfig.timezoneId,
      hasTouch: false,
      isMobile: false,
      colorScheme: 'light',
      reducedMotion: 'reduce',
      extraHTTPHeaders: {
        'Accept-Language': `${envConfig.locale},zh;q=0.9,en-US;q=0.8,en;q=0.7`,
      },
      storageState: this.getStorageStatePath(),
    });

    // 创建页面
    this.page = await this.context.newPage();

    // 设置默认超时
    this.page.setDefaultTimeout(30000);
    this.page.setDefaultNavigationTimeout(30000);

    // 稳定设备画像：保持一致，不做每次运行随机切换，降低异常指纹漂移。
    await this.page.addInitScript(
      ({ languages, platform, hardwareConcurrency, deviceMemory }) => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => languages,
        });

        Object.defineProperty(navigator, 'platform', {
          get: () => platform,
        });

        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => hardwareConcurrency,
        });

        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => deviceMemory,
        });
      },
      {
        languages: [envConfig.locale, 'zh', 'en-US', 'en'],
        platform: 'MacIntel',
        hardwareConcurrency: 8,
        deviceMemory: 8,
      }
    );

    log.info(
      `浏览器画像: viewport=${envConfig.viewportWidth}x${envConfig.viewportHeight}, dpr=${envConfig.deviceScaleFactor}, locale=${envConfig.locale}, timezone=${envConfig.timezoneId}, userDataDir=${envConfig.userDataDir}`
    );

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
