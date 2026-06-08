import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { log } from '../utils/logger';
import { sleep, withRetry } from '../utils/retry';
import { getEnvConfig } from '../config/config';
import { LoginResult } from '../types';

type ManualLoginState = 'logged_in' | 'verification' | 'login_flow' | 'pending';

const LOGIN_URL = 'https://twitter.com/i/flow/login';
const HOME_URL = 'https://twitter.com/home';

const AUTHENTICATED_DOM_SELECTORS = [
  '[data-testid="AppTabBar_Profile_Link"]',
  '[data-testid="SideNav_AccountSwitcher_Button"]',
  '[data-testid="AppTabBar_Home_Link"]',
  '[data-testid="primaryColumn"] [data-testid="tweetTextarea_0"]',
  'a[data-testid="AppTabBar_Profile_Link"]',
];

const LOGIN_FLOW_SELECTORS = [
  'input[autocomplete="username"]',
  'input[type="password"]',
  'input[name="text"]',
  '[data-testid="LoginForm_Login_Button"]',
];

const VERIFICATION_DOM_SELECTORS = [
  'input[data-testid="ocfEnterTextTextInput"]',
  'input[autocomplete="one-time-code"]',
  'input[inputmode="numeric"]',
  '[data-testid="ocfEnterTextNextButton"]',
  '[data-testid="ocfEnterTextSkipButton"]',
  '[data-testid="arkoseFrame"]',
  'iframe[src*="arkoselabs"]',
  'iframe[title*="challenge" i]',
  'iframe[title*="captcha" i]',
];

const VERIFICATION_TEXT_PATTERNS = [
  /verify your account/i,
  /confirm your identity/i,
  /enter your phone number/i,
  /enter your verification code/i,
  /suspicious login/i,
  /unusual activity/i,
  /account access/i,
  /temporarily limited/i,
  /temporarily restricted/i,
  /账号.*验证/,
  /请验证/,
  /验证码/,
  /异常活动/,
  /访问受限/,
];

function hasUsablePersistentProfile(profileDir: string): boolean {
  try {
    return fs.existsSync(profileDir) && fs.readdirSync(profileDir).length > 0;
  } catch {
    return false;
  }
}

/**
 * Twitter 登录管理类
 */
export class LoginManager {
  constructor(private page: Page) {}

  private isReservedPathSegment(value: string): boolean {
    return new Set([
      'account',
      'compose',
      'explore',
      'home',
      'i',
      'jobs',
      'login',
      'logout',
      'messages',
      'notifications',
      'search',
      'settings',
      'tos',
    ]).has(value.toLowerCase());
  }

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
      if (!username || this.isReservedPathSegment(username)) {
        return null;
      }
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

  private async getManualLoginState(): Promise<ManualLoginState> {
    await this.page.waitForLoadState('domcontentloaded', { timeout: 1000 }).catch(() => undefined);

    if (await this.isLoggedInWithoutNavigation()) {
      return 'logged_in';
    }

    if (await this.hasVerificationSignal()) {
      return 'verification';
    }

    if (await this.hasAnySelector(LOGIN_FLOW_SELECTORS)) {
      return 'login_flow';
    }

    return 'pending';
  }

  private async hasAnySelector(selectors: string[]): Promise<boolean> {
    for (const selector of selectors) {
      const element = await this.page.$(selector).catch(() => null);
      if (element) {
        return true;
      }
    }
    return false;
  }

  private async hasVerificationSignal(): Promise<boolean> {
    if (await this.hasAnySelector(VERIFICATION_DOM_SELECTORS)) {
      return true;
    }

    try {
      const bodyText = await this.page.locator('body').innerText({ timeout: 1000 });
      return VERIFICATION_TEXT_PATTERNS.some((pattern) => pattern.test(bodyText));
    } catch {
      return false;
    }
  }

  private async waitForAnyLoginState(
    expectedStates: ManualLoginState[],
    timeoutMs: number
  ): Promise<ManualLoginState> {
    const stateHandle = await this.page.waitForFunction(
      ({ states, authSelectors, loginSelectors, verificationSelectors, verificationPatterns }) => {
        const hasSelector = (selectors: string[]) =>
          selectors.some((selector) => document.querySelector(selector));

        const bodyText = document.body?.innerText || '';
        const hasVerificationText = verificationPatterns.some((pattern) =>
          new RegExp(pattern.source, pattern.flags).test(bodyText)
        );

        const currentState = hasSelector(authSelectors)
          ? 'logged_in'
          : hasSelector(verificationSelectors) || hasVerificationText
            ? 'verification'
            : hasSelector(loginSelectors)
              ? 'login_flow'
              : 'pending';

        return states.includes(currentState) ? currentState : false;
      },
      {
        states: expectedStates,
        authSelectors: AUTHENTICATED_DOM_SELECTORS,
        loginSelectors: LOGIN_FLOW_SELECTORS,
        verificationSelectors: VERIFICATION_DOM_SELECTORS,
        verificationPatterns: VERIFICATION_TEXT_PATTERNS.map((pattern) => ({
          source: pattern.source,
          flags: pattern.flags,
        })),
      },
      { timeout: timeoutMs }
    );

    return (await stateHandle.jsonValue()) as ManualLoginState;
  }

  private async runAutoLoginStage<T>(stageName: string, fn: () => Promise<T>): Promise<T> {
    return await withRetry(
      fn,
      {
        maxRetries: 3,
        retryDelay: 1500,
        exponentialBackoff: false,
      },
      `自动登录阶段 ${stageName}`
    );
  }

  private async navigateToLogin(): Promise<ManualLoginState> {
    await this.page.goto(LOGIN_URL, {
      waitUntil: 'domcontentloaded',
    });
    return await this.waitForAnyLoginState(['logged_in', 'login_flow', 'verification'], 15000);
  }

  private async fillUsername(username: string): Promise<void> {
    const usernameInput = await this.page.waitForSelector('input[autocomplete="username"]', {
      timeout: 10000,
      state: 'visible',
    });
    await usernameInput.fill(username);
    await this.page.keyboard.press('Enter');
  }

  private async handleAutomaticVerificationDetour(): Promise<'continue' | 'manual_required'> {
    await sleep(1500);
    const state = await this.getManualLoginState();
    if (state === 'verification') {
      return 'manual_required';
    }
    return 'continue';
  }

  private async fillPassword(password: string): Promise<void> {
    const passwordInput = await this.page.waitForSelector('input[type="password"]', {
      timeout: 15000,
      state: 'visible',
    });
    await passwordInput.fill(password);
  }

  private async submitPassword(): Promise<void> {
    await this.page.keyboard.press('Enter');
  }

  private async waitForAuthenticatedDom(timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await this.page
        .waitForLoadState('domcontentloaded', { timeout: 1000 })
        .catch(() => undefined);

      if (await this.isLoggedInWithoutNavigation()) {
        return true;
      }

      if (await this.hasVerificationSignal()) {
        return false;
      }

      await sleep(1000);
    }

    return false;
  }

  /**
   * 检查是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
      const loggedIn = await this.waitForAuthenticatedDom(10000);
      if (loggedIn) {
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
      return await this.hasAnySelector(AUTHENTICATED_DOM_SELECTORS);
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
    const userDataDir = path.resolve(process.cwd(), envConfig.userDataDir);
    const statePath = path.join(userDataDir, 'state.json');
    const profileDir = path.join(userDataDir, 'profile');
    const hasStoredState = fs.existsSync(statePath);
    const hasPersistentProfile = hasUsablePersistentProfile(profileDir);

    if (
      envConfig.headless &&
      !envConfig.twitterUsername &&
      !envConfig.twitterPassword &&
      !hasStoredState &&
      !hasPersistentProfile
    ) {
      const message =
        'HEADLESS=true 且未提供账号密码，也未检测到已保存的浏览器 profile 或 state.json 快照，无法进行手动登录。';
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
      const navigateState = await this.runAutoLoginStage('navigate', () => this.navigateToLogin());
      if (navigateState === 'logged_in') {
        log.success('自动登录前已检测到已登录状态');
        return { success: true, message: '已经登录' };
      }
      if (navigateState === 'verification') {
        if (envConfig.headless) {
          const message = '登录页进入验证步骤，HEADLESS=true 无法完成，请改为有头模式手动验证';
          log.error(message);
          return { success: false, message };
        }
        log.warn('登录页进入验证步骤，切换到手动登录等待');
        return await this.manualLogin(false);
      }

      log.info('输入用户名...');
      await this.runAutoLoginStage('username', () => this.fillUsername(envConfig.twitterUsername));

      const detour = await this.runAutoLoginStage('verification', () =>
        this.handleAutomaticVerificationDetour()
      );
      if (detour === 'manual_required') {
        if (envConfig.headless) {
          const message = '检测到额外验证步骤，HEADLESS=true 无法完成，请改为有头模式手动验证';
          log.error(message);
          return { success: false, message };
        }
        log.warn('检测到额外验证步骤，切换到手动登录等待');
        return await this.manualLogin(false);
      }

      log.info('输入密码...');
      await this.runAutoLoginStage('password', () => this.fillPassword(envConfig.twitterPassword));
      await this.runAutoLoginStage('submit', () => this.submitPassword());

      const loginSuccess = await this.runAutoLoginStage('verify', () =>
        this.waitForAuthenticatedDom(20000)
      );
      if (loginSuccess) {
        log.success('自动登录成功！');
        return { success: true, message: '登录成功' };
      }

      if (await this.hasVerificationSignal()) {
        if (envConfig.headless) {
          const message = '登录提交后进入验证步骤，HEADLESS=true 无法完成，请改为有头模式手动验证';
          log.error(message);
          return { success: false, message };
        }
        log.warn('登录提交后进入验证步骤，切换到手动登录等待');
        return await this.manualLogin(false);
      }

      log.warn('自动登录未检测到已登录 DOM，切换到手动登录方式');
      return await this.manualLogin(false);
    } catch (error) {
      log.debug('错误详情:', error);

      if (await this.hasVerificationSignal()) {
        if (envConfig.headless) {
          const message = '自动登录进入验证步骤，HEADLESS=true 无法完成，请改为有头模式手动验证';
          log.error(message);
          return { success: false, message };
        }
        log.warn('自动登录进入验证步骤，切换到手动登录等待');
        return await this.manualLogin(false);
      }

      log.warn('自动登录过程出错，切换到手动登录方式');
      return await this.manualLogin(false);
    }
  }

  /**
   * 手动登录
   */
  async manualLogin(shouldNavigate = true): Promise<LoginResult> {
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

    if (shouldNavigate) {
      try {
        await this.page.goto(LOGIN_URL, {
          waitUntil: 'domcontentloaded',
        });
        await sleep(2000);
      } catch (error) {
        log.debug('导航到登录页失败，可能已经在登录页:', error);
      }
    }

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

      // 优先从已认证页面外壳获取 profile 链接，避免把 /i/flow、/settings 等系统路径误判为用户名。
      const profileLink = await this.page.$('[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const username = this.extractUsernameFromUrl(`https://x.com${href}`);
          if (username) {
            return username;
          }
        }
      }

      const usernameFromUrl = this.extractUsernameFromUrl(this.getCurrentUrl());
      if (usernameFromUrl) {
        return usernameFromUrl;
      }

      return null;
    } catch (error) {
      log.debug('获取用户名失败', error);
      return null;
    }
  }
}
