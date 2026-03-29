import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/logger';
import { sleep } from '../utils/retry';
import { getEnvConfig } from '../config/config';
import { LoginResult } from '../types';

/**
 * Twitter 登录管理类
 */
export class LoginManager {
  constructor(private page: Page) {}

  private extractUsernameFromUrl(url: string): string | null {
    if (!url) {
      return null;
    }

    try {
      const parsed = new URL(url);
      if (!['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'].includes(parsed.hostname)) {
        return null;
      }

      const pathname = parsed.pathname.replace(/^\/+|\/+$/g, '');
      if (!pathname || pathname === 'home') {
        return null;
      }

      const [username] = pathname.split('/');
      return username || null;
    } catch {
      return null;
    }
  }

  private getCurrentUrl(): string {
    try {
      return this.page.url();
    } catch (error) {
      log.debug('读取当前 URL 失败', error);
      return '';
    }
  }

  private async getManualLoginState(): Promise<
    'logged_in' | 'verification' | 'login_flow' | 'pending'
  > {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 1000 }).catch(() => undefined);

    if (await this.isLoggedInWithoutNavigation()) {
      return 'logged_in';
    }

    const verificationField = await this.page.$('input[data-testid="ocfEnterTextTextInput"]');
    if (verificationField) {
      return 'verification';
    }

    const loginField = await this.page.$('input[autocomplete="username"], input[type="password"]');
    if (loginField) {
      return 'login_flow';
    }

    return 'pending';
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      // 导航到主页
      await this.page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded' });

      // 等待一下
      await sleep(2000);

      // 检查 URL 是否包含 home（已登录）或 login（未登录）
      const url = this.page.url();

      if (url.includes('/home')) {
        log.success('已经登录 Twitter');
        return true;
      }

      return false;
    } catch (error) {
      log.debug('检查登录状态失败', error);
      return false;
    }
  }

  /**
   * 在不导航的情况下检查登录状态（避免打断手动登录流程）
   */
  private async isLoggedInWithoutNavigation(): Promise<boolean> {
    try {
      const url = this.getCurrentUrl();
      if (url.includes('/home')) {
        return true;
      }

      const profileLink = await this.page.$('[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        return true;
      }

      return false;
    } catch (error) {
      log.debug('检查登录状态失败（无导航）', error);
      return false;
    }
  }

  /**
   * 自动登录（使用环境变量中的账号密码）
   */
  async login(): Promise<LoginResult> {
    const envConfig = getEnvConfig();
    const statePath = path.join(process.cwd(), envConfig.userDataDir, 'state.json');
    const hasStoredState = fs.existsSync(statePath);

    if (
      envConfig.headless &&
      !envConfig.twitterUsername &&
      !envConfig.twitterPassword &&
      !hasStoredState
    ) {
      const message =
        'HEADLESS=true 且未提供账号密码，也未检测到已保存的登录状态，无法进行手动登录。';
      log.error(message);
      return { success: false, message };
    }

    // 检查是否已登录
    const alreadyLoggedIn = await this.isLoggedIn();
    if (alreadyLoggedIn) {
      return { success: true, message: '已经登录' };
    }

    // 检查是否提供了登录凭据
    if (!envConfig.twitterUsername || !envConfig.twitterPassword) {
      log.warn('未提供登录凭据，将使用手动登录方式');
      return await this.manualLogin();
    }

    log.info('检测到 .env 配置，尝试自动登录...');
    log.warn('如果自动登录失败，将自动切换到手动登录');

    try {
      // 导航到登录页面
      await this.page.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'domcontentloaded',
      });
      await sleep(3000); // 增加等待时间

      // 输入用户名/邮箱
      log.info('输入用户名...');
      const usernameInput = await this.page.waitForSelector('input[autocomplete="username"]', {
        timeout: 15000, // 增加超时时间
      });
      await usernameInput.fill(envConfig.twitterUsername);
      await sleep(1000);

      // 点击下一步
      await this.page.keyboard.press('Enter');
      await sleep(3000);

      // 检查是否需要输入手机号或用户名（Twitter 有时会要求额外验证）
      const extraVerification = await this.page.$('input[data-testid="ocfEnterTextTextInput"]');
      if (extraVerification) {
        if (envConfig.headless) {
          const message = '检测到额外验证步骤，HEADLESS=true 无法完成，请改为手动登录';
          log.error(message);
          return { success: false, message };
        }
        log.warn('需要额外验证，请手动输入用户名或手机号');
        await sleep(30000); // 等待用户手动输入
      }

      // 输入密码
      log.info('输入密码...');
      const passwordInput = await this.page.waitForSelector('input[type="password"]', {
        timeout: 15000, // 增加超时时间
      });
      await passwordInput.fill(envConfig.twitterPassword);
      await sleep(1000);

      // 点击登录
      await this.page.keyboard.press('Enter');
      await sleep(5000); // 增加等待时间

      // 验证登录是否成功
      const loginSuccess = await this.isLoggedIn();

      if (loginSuccess) {
        log.success('自动登录成功！');
        return { success: true, message: '登录成功' };
      } else {
        log.warn('自动登录失败，切换到手动登录方式');
        return await this.manualLogin();
      }
    } catch (error) {
      log.warn('自动登录过程出错，切换到手动登录方式');
      log.debug('错误详情:', error);
      // 自动登录失败时，切换到手动登录
      return await this.manualLogin();
    }
  }

  /**
   * 手动登录
   */
  async manualLogin(): Promise<LoginResult> {
    const envConfig = getEnvConfig();
    if (envConfig.headless) {
      const message = 'HEADLESS=true 无法进行手动登录，请改为有头模式或配置账号密码';
      log.error(message);
      return { success: false, message };
    }

    log.info('');
    log.info('═══════════════════════════════════════════════');
    log.info('   请在浏览器中手动登录 Twitter');
    log.info('═══════════════════════════════════════════════');
    log.info('');
    log.info('步骤：');
    log.info('  1. 在打开的浏览器窗口中输入您的账号密码');
    log.info('  2. 完成所有验证步骤（如有两步验证）');
    log.info('  3. 登录成功后，脚本将自动检测并继续');
    log.info('');
    log.info('⏱️  默认等待 5 分钟，如进入验证步骤会额外延长最多 3 分钟');
    log.info('');

    try {
      // 导航到登录页面
      await this.page.goto('https://twitter.com/i/flow/login', {
        waitUntil: 'domcontentloaded',
      });
      await sleep(2000);
    } catch (error) {
      log.debug('导航到登录页失败，可能已经在登录页:', error);
    }

    // 等待用户手动登录（检测 URL 变化）
    const startedAt = Date.now();
    const baseTimeoutMs = 5 * 60 * 1000;
    const verificationGraceMs = 3 * 60 * 1000;
    const maxTimeoutMs = baseTimeoutMs + verificationGraceMs;
    let deadline = startedAt + baseTimeoutMs;
    let verificationGraceApplied = false;
    let attempts = 0;
    let lastMessage = 0;

    while (Date.now() < deadline) {
      await sleep(1000);
      attempts++;

      const loginState = await this.getManualLoginState();
      if (loginState === 'logged_in') {
        log.success('');
        log.success('✓ 检测到登录成功！');
        log.success('');
        return { success: true, message: '手动登录成功' };
      }

      if (loginState === 'verification' && !verificationGraceApplied) {
        deadline = Math.min(startedAt + maxTimeoutMs, deadline + verificationGraceMs);
        verificationGraceApplied = true;
      }

      // 每 30 秒提示一次
      if (attempts - lastMessage >= 30) {
        const remaining = Math.max(1, Math.ceil((deadline - Date.now()) / 60000));
        if (loginState === 'verification') {
          log.info(`⏳ 检测到验证步骤，继续等待... (剩余时间约 ${remaining} 分钟)`);
        } else if (loginState === 'login_flow') {
          log.info(`⏳ 仍在登录流程中，请继续完成登录... (剩余时间约 ${remaining} 分钟)`);
        } else {
          log.info(`⏳ 等待登录中... (剩余时间约 ${remaining} 分钟)`);
        }
        lastMessage = attempts;
      }
    }

    log.error('');
    log.error('等待登录超时，请确认是否卡在验证码、二次验证或网络异常页面');
    log.error('请重新运行程序');
    log.error('');
    return { success: false, message: '登录超时' };
  }

  /**
   * 获取当前登录用户的用户名
   */
  async getUsername(): Promise<string | null> {
    try {
      // 等待用户信息加载
      await sleep(2000);

      // 尝试从 URL 或页面元素中提取用户名
      const url = this.getCurrentUrl();
      const usernameFromUrl = this.extractUsernameFromUrl(url);
      if (usernameFromUrl) {
        return usernameFromUrl;
      }

      // 尝试从页面元素获取
      const profileLink = await this.page.$('[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const username = href.replace('/', '');
          return username;
        }
      }

      return null;
    } catch (error) {
      log.debug('获取用户名失败', error);
      return null;
    }
  }
}
