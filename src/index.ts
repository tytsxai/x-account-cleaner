#!/usr/bin/env node

import { BrowserManager } from './core/browser';
import { LoginManager } from './core/login';
import { TwitterDeleter } from './core/deleter';
import { getEnvConfig, loadConfig, validateConfig } from './config/config';
import { initLogger, log } from './utils/logger';
import { acquireRunLock, RunLock } from './utils/run-lock';
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
    logLevel: string;
    logToFile: boolean;
    failOnErrors: boolean;
    userDataDir: string;
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
  try {
    const pkgPath = path.join(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (typeof pkg.version === 'string') {
      return pkg.version;
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
    logLevel: envConfig.logLevel,
    logToFile: envConfig.logToFile,
    failOnErrors: envConfig.failOnErrors,
    userDataDir: envConfig.userDataDir,
  };
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
    runContext.config = {
      deleteOptions: config.deleteOptions,
      executionConfig: config.executionConfig,
      retryConfig: config.retryConfig,
      urls: config.urls,
    };
    runContext.selectors = getSelectorsMetadata();

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
      await new Promise((resolve) => setTimeout(resolve, 10000));
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
    await new Promise((resolve) => setTimeout(resolve, 10000));
  } catch (error) {
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
  console.log(chalk.cyan(`     Twitter 自动清理工具 ${versionLabel}`));
  console.log(chalk.cyan('========================================'));
  console.log('');
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
void main().catch((error) => {
  void shutdown(1, '启动失败:', error);
});
