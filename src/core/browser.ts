import { chromium, firefox, webkit, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { log } from '../utils/logger';
import { getEnvConfig } from '../config/config';

/**
 * 浏览器管理类
 */
export class BrowserManager {
  public context: BrowserContext | null = null;
  public page: Page | null = null;

  /**
   * 初始化浏览器
   */
  async initialize(): Promise<void> {
    const envConfig = getEnvConfig();

    log.info('正在启动浏览器...');

    const userDataDir = this.getUserDataDir();
    const profileDir = this.getProfileDir();
    const profileExistedBeforeLaunch = fs.existsSync(profileDir);
    const profileWasEmptyBeforeLaunch =
      profileExistedBeforeLaunch && this.isDirectoryEmpty(profileDir);

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

    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.mkdirSync(profileDir, { recursive: true });

      // 持久上下文直接绑定真实浏览器 profile，保留 cookies、localStorage、IndexedDB、Service Worker 等会话数据。
      this.context = await browserType.launchPersistentContext(profileDir, {
        headless: envConfig.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          `--window-size=${envConfig.viewportWidth},${envConfig.viewportHeight}`,
        ],
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
      });

      // 稳定设备画像：保持一致，不做每次运行随机切换，降低异常指纹漂移。
      await this.context.addInitScript(
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

      await this.restoreSnapshotIntoNewProfile(
        profileExistedBeforeLaunch,
        profileWasEmptyBeforeLaunch
      );

      // 复用持久上下文默认页，避免启动时额外多开空白页。
      this.page = this.context.pages()[0] ?? (await this.context.newPage());

      // 设置默认超时
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(30000);

      log.info(
        `浏览器画像: viewport=${envConfig.viewportWidth}x${envConfig.viewportHeight}, dpr=${envConfig.deviceScaleFactor}, locale=${envConfig.locale}, timezone=${envConfig.timezoneId}, userDataDir=${envConfig.userDataDir}, profileDir=${path.join(envConfig.userDataDir, 'profile')}`
      );

      log.success('浏览器启动成功');
    } catch (error) {
      await this.rollbackFailedInitialize(
        profileDir,
        profileExistedBeforeLaunch,
        profileWasEmptyBeforeLaunch
      );
      throw error;
    }
  }

  /**
   * 获取用户数据根目录路径。根目录用于项目控制文件，真实浏览器 profile 位于 profile/ 子目录。
   */
  private getUserDataDir(): string {
    const envConfig = getEnvConfig();
    return path.resolve(process.cwd(), envConfig.userDataDir);
  }

  /**
   * 获取持久浏览器 profile 路径。
   */
  private getProfileDir(): string {
    return path.join(this.getUserDataDir(), 'profile');
  }

  /**
   * 获取存储状态快照路径。
   */
  private getStorageStatePath(): string {
    return path.join(this.getUserDataDir(), 'state.json');
  }

  private isDirectoryEmpty(dirPath: string): boolean {
    try {
      return fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0;
    } catch {
      return false;
    }
  }

  private removeFileIfExists(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath, { force: true });
      }
    } catch (error) {
      log.warn(`清理临时文件失败: ${filePath}`, error);
    }
  }

  private removeProfileIfRollbackSafe(
    profileDir: string,
    profileExistedBeforeLaunch: boolean,
    profileWasEmptyBeforeLaunch: boolean
  ): void {
    const canRemoveProfile = !profileExistedBeforeLaunch || profileWasEmptyBeforeLaunch;
    if (!canRemoveProfile || !fs.existsSync(profileDir)) {
      return;
    }

    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
      log.warn(`浏览器启动失败，已清理本次创建的空 profile: ${profileDir}`);
    } catch (error) {
      log.warn(`浏览器启动失败，但清理新建 profile 失败: ${profileDir}`, error);
    }
  }

  private async rollbackFailedInitialize(
    profileDir: string,
    profileExistedBeforeLaunch: boolean,
    profileWasEmptyBeforeLaunch: boolean
  ): Promise<void> {
    const page = this.page;
    const context = this.context;

    this.page = null;
    this.context = null;

    if (page) {
      try {
        await page.close();
      } catch (error) {
        log.warn('初始化失败后关闭 page 失败', error);
      }
    }

    if (context) {
      try {
        await context.close();
      } catch (error) {
        log.warn('初始化失败后关闭 context 失败', error);
      }
    }

    this.removeProfileIfRollbackSafe(
      profileDir,
      profileExistedBeforeLaunch,
      profileWasEmptyBeforeLaunch
    );
  }

  private async restoreSnapshotIntoNewProfile(
    profileExistedBeforeLaunch: boolean,
    profileWasEmptyBeforeLaunch: boolean
  ): Promise<void> {
    if (!this.context || (profileExistedBeforeLaunch && !profileWasEmptyBeforeLaunch)) {
      return;
    }

    const statePath = this.getStorageStatePath();
    if (!fs.existsSync(statePath)) {
      return;
    }

    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as {
        cookies?: Parameters<BrowserContext['addCookies']>[0];
      };

      if (state.cookies && state.cookies.length > 0) {
        await this.context.addCookies(state.cookies);
      }

      log.info('已将 state.json Cookie 快照导入新的持久浏览器 profile');
    } catch (error) {
      log.warn('导入 state.json 快照失败，将继续使用持久 profile 当前状态', error);
    }
  }

  /**
   * 保存浏览器状态快照（包括 Cookies 和 localStorage）。
   *
   * 持久 profile 才是实时会话主存储；state.json 是便于审计、迁移和恢复的二级快照。
   */
  async saveState(): Promise<void> {
    if (!this.context) {
      throw new Error('浏览器上下文未初始化');
    }

    const statePath = this.getStorageStatePath();
    const tempStatePath = `${statePath}.tmp`;

    try {
      await this.context.storageState({ path: tempStatePath });

      // 设置文件权限为 0600（仅所有者可读写），防止其他用户读取 cookie
      if (process.platform !== 'win32') {
        fs.chmodSync(tempStatePath, 0o600);
      }

      fs.renameSync(tempStatePath, statePath);
    } catch (error) {
      this.removeFileIfExists(tempStatePath);
      throw error;
    }

    log.success('登录状态快照已保存');
  }

  /**
   * 关闭浏览器
   */
  async close(): Promise<void> {
    const page = this.page;
    const context = this.context;

    this.page = null;
    this.context = null;

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
