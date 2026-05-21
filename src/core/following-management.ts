import { ElementHandle, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import {
  ClassifiedFollowing,
  Config,
  FollowingAccount,
  FollowingExecutionSession,
  FollowingManagementConfig,
  FollowingRulesConfig,
  FollowingSessionItem,
  Selectors,
} from '../types';
import { getEnvConfig } from '../config/config';
import { isCancellationError, throwIfCancellationRequested } from '../utils/cancellation';
import { log } from '../utils/logger';
import { randomSleep, sleep } from '../utils/retry';
import { SelectorHelper } from '../utils/selector';

type FollowingExportResult = {
  runId: string;
  outputDir: string;
  jsonlPath: string;
  csvPath: string;
  count: number;
};

type FollowingClassifyResult = {
  outputDir: string;
  candidatesPath: string;
  keepListPath: string;
  reviewPath: string;
  approvedTemplatePath: string;
  total: number;
  candidates: number;
  keep: number;
};

type FollowingExecuteResult = {
  sessionPath: string;
  session: FollowingExecutionSession;
};

type CliRecord = Partial<FollowingAccount> & {
  reasons?: string[];
  decision?: string;
};

const DEFAULT_USER_CELL = '[data-testid="UserCell"]';
const AUTO_GENERATED_NON_CONFIRM_FILES = new Set([
  'candidates.jsonl',
  'followings.jsonl',
  'keep-list.jsonl',
]);

export function normalizeHandle(handle: string | null | undefined): string {
  return (handle || '').trim().replace(/^@+/, '').toLowerCase();
}

function canonicalHandle(handle: string | null | undefined): string {
  const normalized = normalizeHandle(handle);
  return normalized ? `@${normalized}` : '';
}

function textIncludesKeyword(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (normalizedKeyword && lower.includes(normalizedKeyword)) {
      return keyword;
    }
  }
  return null;
}

function combinedAccountText(account: FollowingAccount): string {
  return [account.handle, account.displayName, account.bio].filter(Boolean).join(' ');
}

function isLowInfoAccount(account: FollowingAccount): boolean {
  return !account.bio && !account.isVerified && !account.followsYou;
}

function dedupeByHandle(accounts: FollowingAccount[]): FollowingAccount[] {
  const seen = new Set<string>();
  const result: FollowingAccount[] = [];

  for (const account of accounts) {
    const handle = normalizeHandle(account.handle);
    if (!handle || seen.has(handle)) {
      continue;
    }
    seen.add(handle);
    result.push({ ...account, handle: canonicalHandle(handle) });
  }

  return result;
}

export function classifyFollowing(
  account: FollowingAccount,
  rules: FollowingRulesConfig
): ClassifiedFollowing {
  const handle = normalizeHandle(account.handle);
  const keepHandles = new Set(rules.keepHandles.map(normalizeHandle));
  const dropHandles = new Set(rules.dropHandles.map(normalizeHandle));
  const text = combinedAccountText(account);
  const reasons: string[] = [];

  if (keepHandles.has(handle)) {
    return { ...account, decision: 'keep', reasons: ['keep-handle'] };
  }

  const keepKeyword = textIncludesKeyword(text, rules.keepKeywords);
  if (keepKeyword) {
    return { ...account, decision: 'keep', reasons: [`keep-keyword:${keepKeyword}`] };
  }

  if (dropHandles.has(handle)) {
    reasons.push('drop-handle');
  }

  const dropKeyword = textIncludesKeyword(text, rules.dropKeywords);
  if (dropKeyword) {
    reasons.push(`drop-keyword:${dropKeyword}`);
  }

  if (rules.lowInfoCandidate !== false && isLowInfoAccount(account)) {
    reasons.push('low-info');
  }

  if (reasons.length === 0) {
    return { ...account, decision: 'keep', reasons: ['no-drop-rule'] };
  }

  return { ...account, decision: 'candidate', reasons };
}

export function classifyFollowings(
  accounts: FollowingAccount[],
  rules: FollowingRulesConfig
): ClassifiedFollowing[] {
  return dedupeByHandle(accounts).map((account) => classifyFollowing(account, rules));
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJsonl(filePath: string, rows: unknown[]): void {
  const content = rows.map((row) => JSON.stringify(row)).join('\n');
  fs.writeFileSync(filePath, content ? `${content}\n` : '', 'utf-8');
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, filePath);
}

function readJsonl<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function writeCsv(filePath: string, headers: string[], rows: Record<string, unknown>[]): void {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf-8');
}

function getFollowingConfig(config: Config): FollowingManagementConfig {
  if (!config.followingManagement) {
    throw new Error('followingManagement 配置未加载');
  }
  return config.followingManagement;
}

function buildRunId(): string {
  return `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function resolveOutputBase(config: Config): string {
  return path.resolve(process.cwd(), getFollowingConfig(config).outputDir);
}

function resolveRunDir(config: Config, runId = buildRunId()): string {
  return path.join(resolveOutputBase(config), runId);
}

function getSelector(selectors: Selectors, key: string, fallback: string): string {
  return selectors[key] || fallback;
}

export class FollowingCollector {
  private helper: SelectorHelper;

  constructor(
    private page: Page,
    private config: Config,
    private username: string
  ) {
    this.helper = new SelectorHelper(page, config.selectors);
  }

  async export(runId = buildRunId()): Promise<FollowingExportResult> {
    const runDir = resolveRunDir(this.config, runId);
    ensureDir(runDir);

    const url = this.config.urls.following.replace('{username}', this.username);
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    const accounts = await this.collectVisibleAndScrolledAccounts();
    const jsonlPath = path.join(runDir, 'followings.jsonl');
    const csvPath = path.join(runDir, 'followings.csv');

    writeJsonl(jsonlPath, accounts);
    writeCsv(
      csvPath,
      [
        'handle',
        'displayName',
        'bio',
        'isVerified',
        'followsYou',
        'profileUrl',
        'avatarUrl',
        'collectedAt',
        'sourceUrl',
      ],
      accounts as unknown as Record<string, unknown>[]
    );

    log.success(`关注列表已导出: ${jsonlPath}`);
    log.info(`CSV 复核文件已保存: ${csvPath}`);

    return { runId, outputDir: runDir, jsonlPath, csvPath, count: accounts.length };
  }

  private async collectVisibleAndScrolledAccounts(): Promise<FollowingAccount[]> {
    const seen = new Map<string, FollowingAccount>();
    let staleScrolls = 0;
    let previousCount = 0;

    await this.helper.scrollToTop();

    for (let scroll = 0; scroll < 120 && staleScrolls < 6; scroll++) {
      throwIfCancellationRequested();
      const visible = await this.extractVisibleAccounts();
      for (const account of visible) {
        const handle = normalizeHandle(account.handle);
        if (handle && !seen.has(handle)) {
          seen.set(handle, account);
          log.info(
            `[FOLLOWING_EXPORT] handle=${account.handle} name="${account.displayName || ''}"`
          );
        }
      }

      if (seen.size === previousCount) {
        staleScrolls++;
      } else {
        previousCount = seen.size;
        staleScrolls = 0;
      }

      await this.helper.scrollToBottom();
      await sleep(1200);
    }

    return Array.from(seen.values());
  }

  private async extractVisibleAccounts(): Promise<FollowingAccount[]> {
    const selector = getSelector(this.config.selectors, 'userCell', DEFAULT_USER_CELL);
    return await this.page.$$eval(selector, (elements) => {
      const now = new Date().toISOString();
      return elements
        .map((el) => {
          const links = Array.from(el.querySelectorAll('a[href^="/"][role="link"]'));
          const profileLink = links.find((link) => {
            const href = link.getAttribute('href') || '';
            return /^\/[^/?#]+$/.test(href) && !href.startsWith('/i/');
          });
          const href = profileLink?.getAttribute('href') || '';
          const match = href.match(/^\/([^/?#]+)$/);
          const handle = match ? `@${match[1].replace(/^@+/, '')}` : '';
          if (!handle) {
            return null;
          }

          const image = el.querySelector('img[src]');
          const nameText =
            el.querySelector('[data-testid="UserName"] span')?.textContent ||
            el.querySelector('[dir="ltr"] span')?.textContent ||
            null;
          const textBlocks = Array.from(el.querySelectorAll('[dir="auto"], [dir="ltr"]'))
            .map((node) => node.textContent?.trim() || '')
            .filter(Boolean);
          const bio =
            textBlocks.find(
              (text) => !text.includes(handle.replace(/^@/, '')) && text !== nameText
            ) || null;
          const bodyText = el.textContent || '';

          return {
            handle,
            displayName: nameText,
            bio,
            isVerified: Boolean(el.querySelector('[data-testid="icon-verified"]')),
            followsYou: /关注了你|Follows you/i.test(bodyText),
            avatarUrl: image?.getAttribute('src') || null,
            profileUrl: href ? `https://x.com${href}` : null,
            collectedAt: now,
            sourceUrl: window.location.href,
          };
        })
        .filter(Boolean) as FollowingAccount[];
    });
  }
}

export class FollowingClassifier {
  constructor(private config: Config) {}

  classify(inputFile: string): FollowingClassifyResult {
    const accounts = readJsonl<FollowingAccount>(path.resolve(process.cwd(), inputFile));
    const classified = classifyFollowings(accounts, getFollowingConfig(this.config).rules);
    const outputDir = path.dirname(path.resolve(process.cwd(), inputFile));
    const candidates = classified.filter((item) => item.decision === 'candidate');
    const keep = classified.filter((item) => item.decision === 'keep');
    const candidatesPath = path.join(outputDir, 'candidates.jsonl');
    const keepListPath = path.join(outputDir, 'keep-list.jsonl');
    const reviewPath = path.join(outputDir, 'review.csv');
    const approvedTemplatePath = path.join(outputDir, 'approved-unfollow.jsonl');

    writeJsonl(candidatesPath, candidates);
    writeJsonl(keepListPath, keep);
    writeJsonl(approvedTemplatePath, []);
    writeCsv(
      reviewPath,
      [
        'decision',
        'handle',
        'displayName',
        'bio',
        'reasons',
        'isVerified',
        'followsYou',
        'profileUrl',
      ],
      classified.map((item) => ({
        decision: item.decision,
        handle: item.handle,
        displayName: item.displayName,
        bio: item.bio,
        reasons: item.reasons.join('|'),
        isVerified: item.isVerified,
        followsYou: item.followsYou,
        profileUrl: item.profileUrl,
      }))
    );

    log.success(`候选取关名单已保存: ${candidatesPath}`);
    log.info(`保留名单已保存: ${keepListPath}`);
    log.info(`人工复核表已保存: ${reviewPath}`);
    log.warn(`已生成空确认名单: ${approvedTemplatePath}`);
    log.warn('执行前请人工从 candidates.jsonl 复制确认要取关的账号到 approved-unfollow.jsonl');

    return {
      outputDir,
      candidatesPath,
      keepListPath,
      reviewPath,
      approvedTemplatePath,
      total: classified.length,
      candidates: candidates.length,
      keep: keep.length,
    };
  }
}

export class FollowingExecutor {
  private helper: SelectorHelper;

  constructor(
    private page: Page,
    private config: Config,
    private username: string
  ) {
    this.helper = new SelectorHelper(page, config.selectors);
  }

  dryRun(inputFile: string): FollowingExecutionSession {
    const items = this.buildSessionItems(inputFile);
    const session = this.createSession(inputFile, items, 'completed');
    session.skipped = items.length;
    session.processed = items.length;
    session.items = items.map((item) => ({
      ...item,
      status: 'skipped',
      reason: 'dry-run',
      processedAt: new Date().toISOString(),
    }));
    return session;
  }

  async execute(confirmFile: string, runId?: string): Promise<FollowingExecuteResult> {
    this.assertExecutionSafety();
    const resolvedFile = path.resolve(process.cwd(), confirmFile);
    this.assertConfirmFileSafety(resolvedFile);
    const runDir = runId ? resolveRunDir(this.config, runId) : path.dirname(resolvedFile);
    ensureDir(runDir);
    const sessionPath = path.join(runDir, 'session.json');
    const session = fs.existsSync(sessionPath)
      ? this.loadSession(sessionPath)
      : this.createSession(
          resolvedFile,
          this.buildNonEmptySessionItems(resolvedFile),
          'running',
          runId
        );

    if (session.items.length === 0) {
      throw new Error('确认名单为空，已拒绝执行取关。请先人工编辑 approved-unfollow.jsonl。');
    }

    session.status = 'running';
    session.updatedAt = new Date().toISOString();
    this.saveSession(sessionPath, session);

    try {
      const url = this.config.urls.following.replace('{username}', this.username);
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      await sleep(2000);

      const { execution } = getFollowingConfig(this.config);
      let unfollowedThisRun = 0;
      let consecutiveFailures = 0;

      for (const item of session.items) {
        throwIfCancellationRequested();
        if (item.status === 'success' || item.status === 'skipped') {
          continue;
        }
        if (unfollowedThisRun >= execution.maxUnfollowPerSession) {
          session.stopReason = `max-unfollow-per-session:${execution.maxUnfollowPerSession}`;
          break;
        }

        const riskSignal = await this.detectRiskSignal();
        if (riskSignal) {
          session.status = 'failed';
          session.stopReason = riskSignal;
          session.updatedAt = new Date().toISOString();
          this.saveSession(sessionPath, session);
          throw new Error(`检测到账号风险信号，已停止执行: ${riskSignal}`);
        }

        log.info(
          `[UNFOLLOW_TARGET] handle=${canonicalHandle(item.handle)} name="${item.displayName || ''}" source=approved-file`
        );

        const result = await this.unfollowByHandle(item.handle);
        item.status = result.ok ? 'success' : 'failed';
        item.reason = result.reason;
        item.processedAt = new Date().toISOString();
        this.recountSession(session);
        session.updatedAt = new Date().toISOString();
        this.saveSession(sessionPath, session);

        if (result.ok) {
          unfollowedThisRun++;
          consecutiveFailures = 0;
          if (
            execution.cooldownEveryActions > 0 &&
            unfollowedThisRun % execution.cooldownEveryActions === 0
          ) {
            log.warn(
              `已连续执行 ${unfollowedThisRun} 个取关动作，冷却 ${execution.cooldownMs}ms 后继续`
            );
            await sleep(execution.cooldownMs);
          }
          await randomSleep(execution.minDelayMs, execution.maxDelayMs);
        } else {
          consecutiveFailures++;
          if (consecutiveFailures >= execution.maxConsecutiveFailures) {
            session.status = 'failed';
            session.stopReason = `max-consecutive-failures:${consecutiveFailures}`;
            session.updatedAt = new Date().toISOString();
            this.saveSession(sessionPath, session);
            log.warn(`连续失败 ${consecutiveFailures} 次，已停止执行，避免继续触发账号风险`);
            return { sessionPath, session };
          }
        }
      }

      session.status = session.items.some(
        (item) => item.status === 'pending' || item.status === 'failed'
      )
        ? 'running'
        : 'completed';
      session.updatedAt = new Date().toISOString();
      this.saveSession(sessionPath, session);

      return { sessionPath, session };
    } catch (error) {
      if (isCancellationError(error)) {
        session.status = 'cancelled';
        session.stopReason = 'cancelled';
        session.updatedAt = new Date().toISOString();
        this.saveSession(sessionPath, session);
      }
      throw error;
    }
  }

  async resume(runId: string): Promise<FollowingExecuteResult> {
    const sessionPath = path.join(resolveRunDir(this.config, runId), 'session.json');
    const session = this.loadSession(sessionPath);
    return await this.execute(session.inputFile, runId);
  }

  private assertExecutionSafety(): void {
    const { safety } = getFollowingConfig(this.config);
    const env = getEnvConfig();
    if (safety.requireHeadfulForExecute && env.headless) {
      throw new Error('关注取关 execute 要求 HEADLESS=false，请使用有头浏览器人工可见地执行');
    }
  }

  private assertConfirmFileSafety(resolvedFile: string): void {
    const { execution } = getFollowingConfig(this.config);
    if (!execution.requireConfirmFile) {
      return;
    }

    const basename = path.basename(resolvedFile).toLowerCase();
    if (AUTO_GENERATED_NON_CONFIRM_FILES.has(basename)) {
      throw new Error(
        `拒绝直接执行自动生成文件 ${basename}。请人工复核后写入 approved-unfollow.jsonl。`
      );
    }

    if (!basename.includes('approved') && !basename.includes('confirm')) {
      throw new Error(
        `确认文件名需要包含 approved 或 confirm，当前为 ${basename}。如确需自定义文件名，请先将 followingManagement.execution.requireConfirmFile 设为 false。`
      );
    }
  }

  private async detectRiskSignal(): Promise<string | null> {
    const { safety } = getFollowingConfig(this.config);
    if (!safety.stopOnRiskSignals) {
      return null;
    }

    const url = this.page.url();
    if (/\/i\/flow\/login|\/account\/access|\/account\/suspended/i.test(url)) {
      return `risk-url:${url}`;
    }

    try {
      const bodyText = await this.page.locator('body').innerText({ timeout: 2000 });
      const lower = bodyText.toLowerCase();
      const matched = safety.riskTextPatterns.find((pattern) =>
        lower.includes(pattern.toLowerCase())
      );
      return matched ? `risk-text:${matched}` : null;
    } catch (error) {
      log.debug('风险信号检测失败，继续执行前置检查', error);
      return null;
    }
  }

  private async unfollowByHandle(handle: string): Promise<{ ok: boolean; reason: string }> {
    const normalized = normalizeHandle(handle);
    const candidate = await this.findUserCellByHandle(normalized);
    if (!candidate) {
      return { ok: false, reason: 'handle-not-found' };
    }

    const info = await this.extractHandleFromElement(candidate);
    if (normalizeHandle(info.handle) !== normalized) {
      return { ok: false, reason: `handle-mismatch:${info.handle || 'unknown'}` };
    }

    const ok = await this.helper.unfollowUser(candidate);
    return ok ? { ok: true, reason: 'unfollowed' } : { ok: false, reason: 'click-failed' };
  }

  private async findUserCellByHandle(handle: string): Promise<ElementHandle<Element> | null> {
    await this.helper.scrollToTop();

    for (let attempt = 0; attempt < 40; attempt++) {
      throwIfCancellationRequested();
      const users = await this.helper.getFollowingUsers();
      for (const user of users) {
        const info = await this.extractHandleFromElement(user);
        if (normalizeHandle(info.handle) === handle) {
          return user;
        }
      }

      await this.helper.scrollToBottom();
      await sleep(900);
    }

    return null;
  }

  private async extractHandleFromElement(
    userElement: ElementHandle<Element>
  ): Promise<{ handle: string | null }> {
    try {
      return await userElement.evaluate((el) => {
        const links = Array.from(el.querySelectorAll('a[href^="/"][role="link"]'));
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/^\/([^/?#]+)$/);
          if (match && !href.startsWith('/i/')) {
            return { handle: `@${match[1].replace(/^@+/, '')}` };
          }
        }
        return { handle: null };
      });
    } catch (error) {
      log.debug('提取关注用户 handle 失败', error);
      return { handle: null };
    }
  }

  private buildSessionItems(inputFile: string): FollowingSessionItem[] {
    const records = readJsonl<CliRecord>(path.resolve(process.cwd(), inputFile));
    const seen = new Set<string>();
    const items: FollowingSessionItem[] = [];

    for (const record of records) {
      const handle = normalizeHandle(record.handle);
      if (!handle || seen.has(handle)) {
        continue;
      }
      seen.add(handle);
      items.push({
        handle: canonicalHandle(handle),
        displayName: record.displayName || null,
        status: 'pending',
      });
    }

    return items;
  }

  private buildNonEmptySessionItems(inputFile: string): FollowingSessionItem[] {
    const items = this.buildSessionItems(inputFile);
    if (items.length === 0) {
      throw new Error('确认名单为空，已拒绝执行取关。请先人工编辑 approved-unfollow.jsonl。');
    }
    return items;
  }

  private createSession(
    inputFile: string,
    items: FollowingSessionItem[],
    status: FollowingExecutionSession['status'],
    runId = buildRunId()
  ): FollowingExecutionSession {
    const now = new Date().toISOString();
    return {
      runId,
      mode: 'execute',
      inputFile: path.resolve(process.cwd(), inputFile),
      startedAt: now,
      updatedAt: now,
      status,
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      maxUnfollowPerSession: getFollowingConfig(this.config).execution.maxUnfollowPerSession,
      items,
    };
  }

  private recountSession(session: FollowingExecutionSession): void {
    session.processed = session.items.filter((item) => item.status !== 'pending').length;
    session.success = session.items.filter((item) => item.status === 'success').length;
    session.failed = session.items.filter((item) => item.status === 'failed').length;
    session.skipped = session.items.filter((item) => item.status === 'skipped').length;
  }

  private loadSession(sessionPath: string): FollowingExecutionSession {
    return JSON.parse(fs.readFileSync(sessionPath, 'utf-8')) as FollowingExecutionSession;
  }

  private saveSession(sessionPath: string, session: FollowingExecutionSession): void {
    writeJsonAtomic(sessionPath, session);
  }
}
