#!/usr/bin/env node

import { BrowserManager } from './core/browser';
import { LoginManager } from './core/login';
import { TwitterDeleter } from './core/deleter';
import {
  FollowingClassifier,
  FollowingCollector,
  FollowingExecutor,
} from './core/following-management';
import { getEnvConfig, loadConfig, validateConfig } from './config/config';
import { initLogger, log } from './utils/logger';
import { acquireRunLock, RunLock } from './utils/run-lock';
import { isCancellationError, requestCancellation } from './utils/cancellation';
import { sleep } from './utils/retry';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import type { Config, DeleteStats } from './types';

type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

type RunContext = {
  runId: string;
  startedAt: string;
  status: RunStatus;
  username?: string;
  config?: {
    deleteOptions: Config['deleteOptions'];
    executionConfig: Config['executionConfig'];
    retryConfig: Config['retryConfig'];
    urls: Config['urls'];
  };
  env?: {
    headless: boolean;
    browserType: string;
    userAgent: string;
    viewport: string;
    deviceScaleFactor: number;
    locale: string;
    timezoneId: string;
    logLevel: string;
    logToFile: boolean;
    failOnErrors: boolean;
    userDataDir: string;
    allowLegacyFollowingDelete: boolean;
  };
  lock?: {
    path: string;
    userDataDir: string;
  };
  selectors?: {
    source: string;
    path: string;
    version?: string;
    lastUpdated?: string;
    error?: string;
  };
  stats?: DeleteStats;
  error?: string;
};

type FollowingCommand = 'export' | 'classify' | 'dry-run' | 'execute' | 'resume';

type ParsedArgs = {
  command: string | null;
  subcommand: string | null;
  options: Map<string, string | boolean>;
};

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const runContext: RunContext = {
  runId,
  startedAt: new Date().toISOString(),
  status: 'running',
};
const appVersion = getAppVersion();
let summaryWritten = false;
let browserManager: BrowserManager | null = null;
let closingPromise: Promise<void> | null = null;
let shutdownInProgress = false;
let runLock: RunLock | null = null;

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getAppVersion(): string | null {
  const candidatePaths = [
    path.join(__dirname, '..', 'package.json'),
    path.join(process.cwd(), 'package.json'),
  ];

  try {
    for (const pkgPath of candidatePaths) {
      if (!fs.existsSync(pkgPath)) {
        continue;
      }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof pkg.version === 'string') {
        return pkg.version;
      }
    }
  } catch (error) {
    log.debug('读取版本信息失败', error);
  }
  return null;
}

function buildEnvSummary() {
  const envConfig = getEnvConfig();
  return {
    headless: envConfig.headless,
    browserType: envConfig.browserType,
    userAgent: envConfig.userAgent,
    viewport: `${envConfig.viewportWidth}x${envConfig.viewportHeight}`,
    deviceScaleFactor: envConfig.deviceScaleFactor,
    locale: envConfig.locale,
    timezoneId: envConfig.timezoneId,
    logLevel: envConfig.logLevel,
    logToFile: envConfig.logToFile,
    failOnErrors: envConfig.failOnErrors,
    allowLegacyFollowingDelete: envConfig.allowLegacyFollowingDelete,
    userDataDir: envConfig.userDataDir,
  };
}

function captureConfigSummary(config: Config): void {
  runContext.config = {
    deleteOptions: config.deleteOptions,
    executionConfig: config.executionConfig,
    retryConfig: config.retryConfig,
    urls: config.urls,
  };
  runContext.selectors = getSelectorsMetadata();
}

function getSelectorsMetadata() {
  const selectorsPath = path.join(process.cwd(), 'selectors.json');
  if (!fs.existsSync(selectorsPath)) {
    return { source: 'config.json', path: 'config.json' };
  }

  try {
    const selectors = JSON.parse(fs.readFileSync(selectorsPath, 'utf-8'));
    return {
      source: 'selectors.json',
      path: 'selectors.json',
      version: selectors.version,
      lastUpdated: selectors.lastUpdated,
    };
  } catch (error) {
    return {
      source: 'selectors.json',
      path: 'selectors.json',
      error: formatError(error),
    };
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const options = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const withoutPrefix = arg.slice(2);
      const [key, inlineValue] = withoutPrefix.split('=', 2);
      if (inlineValue !== undefined) {
        options.set(key, inlineValue);
        continue;
      }
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        options.set(key, next);
        i++;
      } else {
        options.set(key, true);
      }
    } else {
      positionals.push(arg);
    }
  }

  return {
    command: positionals[0] || null,
    subcommand: positionals[1] || null,
    options,
  };
}

function getStringOption(args: ParsedArgs, name: string): string | null {
  const value = args.options.get(name);
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function hasBooleanOption(args: ParsedArgs, ...names: string[]): boolean {
  return names.some((name) => args.options.get(name) === true);
}

function isHelpRequested(args: ParsedArgs): boolean {
  return (
    args.command === 'help' ||
    args.command === '-h' ||
    args.subcommand === 'help' ||
    args.subcommand === '-h' ||
    hasBooleanOption(args, 'help', 'h')
  );
}

function isVersionRequested(args: ParsedArgs): boolean {
  return (
    args.command === 'version' || args.command === '-v' || hasBooleanOption(args, 'version', 'v')
  );
}

function assertFollowingCommand(value: string | null): FollowingCommand {
  const commands: FollowingCommand[] = ['export', 'classify', 'dry-run', 'execute', 'resume'];
  if (!value || !commands.includes(value as FollowingCommand)) {
    throw new Error(`未知 followings 子命令: ${value || '(空)'}。可用: ${commands.join(', ')}`);
  }
  return value as FollowingCommand;
}

async function prepareLoggedInPage(
  config: Config
): Promise<{ page: ReturnType<BrowserManager['getPage']>; username: string }> {
  const envConfig = getEnvConfig();
  runLock = acquireRunLock(runId, envConfig.userDataDir);
  runContext.lock = { path: runLock.lockPath, userDataDir: envConfig.userDataDir };

  browserManager = new BrowserManager();
  await browserManager.initialize();
  const page = browserManager.getPage();

  const loginManager = new LoginManager(page);
  const loginResult = await loginManager.login();
  if (!loginResult.success) {
    throw new Error(loginResult.message || '登录失败');
  }

  await browserManager.saveState();

  let username = await loginManager.getUsername();
  if (!username) {
    log.warn('无法自动获取用户名，请在浏览器中导航到你的个人主页');
    log.info('等待 10 秒...');
    await sleep(10000);
    username = await loginManager.getUsername();
  }

  if (!username) {
    throw new Error('无法获取用户名');
  }

  runContext.username = username;
  captureConfigSummary(config);
  log.success(`当前用户: @${username}`);

  return { page, username };
}

async function runFollowingsCommand(parsedArgs: ParsedArgs): Promise<void> {
  initLogger();
  printWelcome();

  const config = loadConfig();
  if (config.followingManagement) {
    config.followingManagement.enabled = true;
  }
  validateConfig(config);
  const subcommand = parsedArgs.subcommand
    ? assertFollowingCommand(parsedArgs.subcommand)
    : config.followingPlan?.mode || config.followingManagement?.defaultMode || 'export';

  runContext.env = buildEnvSummary();
  captureConfigSummary(config);

  if (subcommand === 'classify') {
    const input = getStringOption(parsedArgs, 'input') || config.followingPlan?.input || null;
    if (!input) {
      throw new Error('followings classify 需要 --input <followings.jsonl>');
    }
    const result = new FollowingClassifier(config).classify(input);
    log.success(
      `分类完成: total=${result.total}, candidates=${result.candidates}, keep=${result.keep}`
    );
    runContext.status = 'completed';
    return;
  }

  if (subcommand === 'dry-run') {
    const input =
      getStringOption(parsedArgs, 'input') ||
      config.followingPlan?.input ||
      config.followingPlan?.confirmFile ||
      null;
    if (!input) {
      throw new Error('followings dry-run 需要 --input <approved-unfollow.jsonl>');
    }
    const session = new FollowingExecutor({} as never, config, 'dry-run').dryRun(input);
    log.info(`dry-run 将处理 ${session.items.length} 个账号，不会打开浏览器或点击取关`);
    for (const item of session.items) {
      log.info(`[DRY_RUN_UNFOLLOW] handle=${item.handle} name="${item.displayName || ''}"`);
    }
    runContext.status = 'completed';
    return;
  }

  const confirmFile =
    subcommand === 'execute'
      ? getStringOption(parsedArgs, 'confirm-file') || config.followingPlan?.confirmFile || null
      : null;
  if (subcommand === 'execute' && !confirmFile) {
    throw new Error('followings execute 必须提供 --confirm-file <approved-unfollow.jsonl>');
  }

  const resumeRunId =
    subcommand === 'resume'
      ? getStringOption(parsedArgs, 'run-id') || config.followingPlan?.runId || null
      : null;
  if (subcommand === 'resume' && !resumeRunId) {
    throw new Error('followings resume 需要 --run-id <runId>');
  }

  const { page, username } = await prepareLoggedInPage(config);

  if (subcommand === 'export') {
    const requestedRunId = getStringOption(parsedArgs, 'run-id') || config.followingPlan?.runId;
    const result = await new FollowingCollector(page, config, username).export(requestedRunId);
    log.success(`导出完成: ${result.count} 个关注账号，runId=${result.runId}`);
    runContext.status = 'completed';
    return;
  }

  if (subcommand === 'execute') {
    if (!confirmFile) {
      throw new Error('followings execute 必须提供 --confirm-file <approved-unfollow.jsonl>');
    }
    const runId = getStringOption(parsedArgs, 'run-id') || config.followingPlan?.runId;
    const result = await new FollowingExecutor(page, config, username).execute(confirmFile, runId);
    log.success(
      `执行状态已保存: ${result.sessionPath} success=${result.session.success} failed=${result.session.failed} pending=${result.session.items.length - result.session.processed}`
    );
    runContext.status = 'completed';
    return;
  }

  if (!resumeRunId) {
    throw new Error('followings resume 需要 --run-id <runId>');
  }
  const result = await new FollowingExecutor(page, config, username).resume(resumeRunId);
  log.success(
    `恢复执行状态已保存: ${result.sessionPath} success=${result.session.success} failed=${result.session.failed} pending=${result.session.items.length - result.session.processed}`
  );
  runContext.status = 'completed';
}

async function writeRunSummary(exitCode: number): Promise<void> {
  if (summaryWritten) {
    return;
  }
  summaryWritten = true;

  try {
    const finishedAt = new Date();
    const startedAt = new Date(runContext.startedAt);
    const durationMs = Number.isFinite(startedAt.getTime())
      ? finishedAt.getTime() - startedAt.getTime()
      : null;

    const summary = {
      runId: runContext.runId,
      startedAt: runContext.startedAt,
      finishedAt: finishedAt.toISOString(),
      durationMs,
      status: runContext.status,
      exitCode,
      username: runContext.username ?? null,
      appVersion,
      runtime: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        cwd: process.cwd(),
      },
      env: runContext.env ?? null,
      lock: runContext.lock ?? null,
      config: runContext.config ?? null,
      selectors: runContext.selectors ?? null,
      stats: runContext.stats ?? null,
      error: runContext.error ?? null,
    };

    const logsDir = path.join(process.cwd(), 'logs');
    await fs.promises.mkdir(logsDir, { recursive: true });

    const summaryPath = path.join(logsDir, `run-summary-${runContext.runId}.json`);
    await fs.promises.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    log.info(`运行摘要已保存: ${summaryPath}`);
  } catch (error) {
    log.warn('写入运行摘要失败', error);
  }
}

async function closeBrowser(): Promise<void> {
  if (!browserManager) {
    return;
  }

  if (!closingPromise) {
    closingPromise = browserManager.close().catch((error) => {
      log.error('关闭浏览器失败:', error);
    });
  }

  await closingPromise;
}

function releaseRunLock(): void {
  if (!runLock) {
    return;
  }
  runLock.release();
  runLock = null;
}

async function shutdown(
  exitCode: number,
  message?: string,
  error?: unknown,
  statusOverride?: RunStatus
): Promise<void> {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;
  requestCancellation(message);

  if (message) {
    if (exitCode === 0) {
      log.info(message);
    } else {
      log.error(message, error);
    }
  }

  if (error) {
    runContext.error = formatError(error);
  }
  runContext.status = statusOverride ?? (exitCode === 0 ? 'completed' : 'failed');

  await writeRunSummary(exitCode);
  await closeBrowser();
  releaseRunLock();

  // 设置退出码但不调用 process.exit()，让事件循环自然结束
  // 这确保所有异步操作（如日志写入）有机会完成
  process.exitCode = exitCode;
}

/**
 * 主函数
 */
async function main() {
  initLogger();
  let deleter: TwitterDeleter | null = null;

  try {
    // 打印欢迎信息
    printWelcome();

    const envConfig = getEnvConfig();
    runContext.env = buildEnvSummary();
    runLock = acquireRunLock(runId, envConfig.userDataDir);
    runContext.lock = { path: runLock.lockPath, userDataDir: envConfig.userDataDir };

    log.info(`运行 ID: ${runId}`);
    if (appVersion) {
      log.info(`版本: ${appVersion}`);
    }
    log.info(`日志目录: ${path.join(process.cwd(), 'logs')}`);
    if (!envConfig.logToFile) {
      log.warn('文件日志未开启，如需排障请设置 LOG_TO_FILE=true');
    }

    // 加载配置
    log.info('加载配置文件...');
    const config = loadConfig();
    validateConfig(config);
    log.success('配置加载成功');
    if (!Object.values(config.deleteOptions).some((enabled) => enabled === true)) {
      throw new Error(
        '默认清理流程没有启用任何 deleteOptions。请在 config.json 启用至少一个清理类目，或使用 `x-account-cleaner followings export` 进入关注管理流程。'
      );
    }
    if (config.deleteOptions.following && !envConfig.allowLegacyFollowingDelete) {
      throw new Error(
        '为降低账号风险，已默认禁止 deleteOptions.following 旧式直接取关。请使用 `npm run start -- followings export/classify/dry-run/execute`；如确需旧路径，设置 ALLOW_LEGACY_FOLLOWING_DELETE=true。'
      );
    }
    captureConfigSummary(config);

    // 初始化浏览器
    browserManager = new BrowserManager();
    await browserManager.initialize();

    const page = browserManager.getPage();

    // 登录
    const loginManager = new LoginManager(page);
    const loginResult = await loginManager.login();

    if (!loginResult.success) {
      log.error('登录失败，程序退出');
      runContext.status = 'failed';
      runContext.error = loginResult.message || '登录失败';
      process.exitCode = 1;
      return;
    }

    // 保存登录状态
    await browserManager.saveState();

    // 获取用户名
    let username = await loginManager.getUsername();

    // 如果无法自动获取用户名，等待用户手动导航到个人主页
    if (!username) {
      log.warn('无法自动获取用户名，请在浏览器中导航到你的个人主页');
      log.info('等待 10 秒...');
      await sleep(10000);
      username = await loginManager.getUsername();
    }

    if (!username) {
      log.error('无法获取用户名，程序退出');
      runContext.status = 'failed';
      runContext.error = '无法获取用户名';
      process.exitCode = 1;
      return;
    }

    runContext.username = username;
    log.success(`当前用户: @${username}`);

    // 确认开始删除
    log.info('');
    log.info(chalk.yellow('==================================='));
    log.info(chalk.yellow('警告：即将开始删除 Twitter 内容！'));
    log.info(chalk.yellow('==================================='));
    log.info('清理选项:');
    if (config.deleteOptions.tweets) log.info('  ✓ 推文');
    if (config.deleteOptions.retweets) log.info('  ✓ 转推');
    if (config.deleteOptions.replies) log.info('  ✓ 回复');
    if (config.deleteOptions.likes) log.info('  ✓ 点赞');
    if (config.deleteOptions.bookmarks) log.info('  ✓ 书签');
    if (config.deleteOptions.following) log.info('  ✓ 关注');
    log.info(`最大清理数量: ${config.executionConfig.maxDeletePerSession}`);
    log.info('');
    log.info(chalk.red('程序将在 10 秒后开始执行，按 Ctrl+C 可取消...'));

    // 倒计时
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r${chalk.yellow(`倒计时: ${i} 秒...`)}  `);
      await sleep(1000);
    }
    console.log('');

    // 开始删除
    deleter = new TwitterDeleter(page, config);
    const stats = await deleter.startDeleting(username);
    runContext.stats = stats;
    runContext.status = 'completed';

    if (stats.errors > 0) {
      log.warn(`本次运行出现 ${stats.errors} 个错误，请检查日志`);
      if (envConfig.failOnErrors) {
        log.error('FAIL_ON_ERRORS=true，运行将以失败状态退出');
        runContext.status = 'failed';
        process.exitCode = 1;
      }
    }

    // 完成
    log.info('');
    log.success('===============================');
    log.success('所有任务执行完成！');
    log.success('===============================');
    log.info('最终统计:');
    log.info(`  推文: ${stats.tweets}`);
    log.info(`  回复: ${stats.replies}`);
    log.info(`  转推: ${stats.retweets}`);
    log.info(`  点赞: ${stats.likes}`);
    log.info(`  书签: ${stats.bookmarks}`);
    log.info(`  关注: ${stats.following}`);
    log.info(`  错误: ${stats.errors}`);

    // 等待用户查看
    log.info('');
    log.info('浏览器将在 10 秒后关闭...');
    await sleep(10000);
  } catch (error) {
    if (isCancellationError(error)) {
      if (!shutdownInProgress) {
        runContext.status = 'cancelled';
        runContext.error = formatError(error);
        process.exitCode = 130;
      }
      return;
    }

    log.error('程序执行出错:', error);
    runContext.status = 'failed';
    runContext.error = formatError(error);
    if (deleter) {
      runContext.stats = deleter.getStats();
    }
    process.exitCode = 1;
  } finally {
    // 清理资源
    if (runContext.status === 'running') {
      runContext.status = process.exitCode === 0 ? 'completed' : 'failed';
    }
    const exitCode = typeof process.exitCode === 'number' ? process.exitCode : 0;
    await writeRunSummary(exitCode);
    await closeBrowser();
    releaseRunLock();
  }
}

/**
 * 打印欢迎信息
 */
function printWelcome() {
  const versionLabel = appVersion ? `v${appVersion}` : 'v1.0.0';
  console.log('');
  console.log(chalk.cyan('========================================'));
  console.log(chalk.cyan(`     X Account Cleaner ${versionLabel}`));
  console.log(chalk.cyan('========================================'));
  console.log('');
}

function printUsage(): void {
  const versionLabel = appVersion ? `v${appVersion}` : 'v1.0.0';
  console.log(`X Account Cleaner ${versionLabel}`);
  console.log('');
  console.log('Usage:');
  console.log('  x-account-cleaner [--help] [--version]');
  console.log('  x-account-cleaner followings <command> [options]');
  console.log('  npx x-account-cleaner [--help] [--version]');
  console.log('  npm run start -- [--help]');
  console.log('  npm run start -- followings <command> [options]');
  console.log('');
  console.log('Default cleanup flow:');
  console.log('  1. Run from a working directory that contains config.json and selectors.json.');
  console.log('  2. Keep maxDeletePerSession at 5 for the first headful smoke run.');
  console.log('  3. Keep HEADLESS=false when confirming browser behavior.');
  console.log('');
  console.log('Following cleanup commands:');
  console.log('  followings export');
  console.log('  followings classify --input data/followings/<runId>/followings.jsonl');
  console.log('  followings dry-run --input data/followings/<runId>/approved-unfollow.jsonl');
  console.log(
    '  followings execute --confirm-file data/followings/<runId>/approved-unfollow.jsonl'
  );
  console.log('  followings resume --run-id <runId>');
  console.log('');
  console.log('Docs: README.md, QUICKSTART.md, docs/README.md');
}

function printFollowingsUsage(): void {
  console.log('X Account Cleaner following workflow');
  console.log('');
  console.log('Usage:');
  console.log('  x-account-cleaner followings export [--run-id <runId>]');
  console.log('  x-account-cleaner followings classify --input <followings.jsonl>');
  console.log('  x-account-cleaner followings dry-run --input <approved-unfollow.jsonl>');
  console.log('  x-account-cleaner followings execute --confirm-file <approved-unfollow.jsonl>');
  console.log('  x-account-cleaner followings resume --run-id <runId>');
  console.log('');
  console.log('Safety model: export and classify are review steps; execute only uses an explicit');
  console.log(
    'approved-unfollow.jsonl confirmation file and is blocked in headless mode by default.'
  );
  console.log('Legacy deleteOptions.following direct unfollow is blocked by default.');
}

/**
 * 错误处理
 */
process.on('unhandledRejection', (error) => {
  void shutdown(1, '未处理的 Promise 错误:', error);
});

process.on('uncaughtException', (error) => {
  void shutdown(1, '未捕获异常:', error);
});

process.on('SIGINT', () => {
  void shutdown(130, '收到中断信号 (SIGINT)，正在退出...', undefined, 'cancelled');
});

process.on('SIGTERM', () => {
  void shutdown(143, '收到终止信号 (SIGTERM)，正在退出...', undefined, 'cancelled');
});

// 启动程序
const parsedArgs = parseArgs(process.argv.slice(2));
if (isVersionRequested(parsedArgs)) {
  console.log(appVersion || '0.0.0');
} else if (isHelpRequested(parsedArgs)) {
  if (parsedArgs.command === 'followings') {
    printFollowingsUsage();
  } else {
    printUsage();
  }
} else if (parsedArgs.command && parsedArgs.command !== 'followings') {
  console.error(`Unknown command: ${parsedArgs.command}`);
  console.error('Run `x-account-cleaner --help` for available commands.');
  process.exitCode = 1;
} else {
  const entrypoint =
    parsedArgs.command === 'followings' ? runFollowingsCommand(parsedArgs) : main();

  void entrypoint
    .then(async () => {
      if (parsedArgs.command === 'followings') {
        if (runContext.status === 'running') {
          runContext.status = 'completed';
        }
        await writeRunSummary(0);
        await closeBrowser();
        releaseRunLock();
      }
    })
    .catch((error) => {
      if (isCancellationError(error)) {
        return;
      }
      void shutdown(1, '启动失败:', error);
    });
}
