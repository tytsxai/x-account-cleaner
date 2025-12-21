import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Config, SelectorConfig, Selectors, SelectorsJsonConfig, URLs } from '../types';
import { log } from '../utils/logger';
import { validateSelectors } from '../utils/selector';

// 加载环境变量
dotenv.config();

export type BrowserType = 'chromium' | 'firefox' | 'webkit';
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface EnvConfig {
  twitterUsername: string;
  twitterPassword: string;
  headless: boolean;
  browserType: BrowserType;
  logLevel: LogLevel;
  logToFile: boolean;
  failOnErrors: boolean;
  userDataDir: string;
}

function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const lower = value.toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(lower)) return true;
  if (['false', '0', 'no', 'off'].includes(lower)) return false;
  return defaultValue;
}

function validateEnvConfig(env: EnvConfig): void {
  const allowedBrowserTypes: BrowserType[] = ['chromium', 'firefox', 'webkit'];
  if (!allowedBrowserTypes.includes(env.browserType)) {
    throw new Error(
      `BROWSER_TYPE 无效: ${env.browserType}（允许: ${allowedBrowserTypes.join('/')}）`
    );
  }

  const allowedLogLevels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
  if (!allowedLogLevels.includes(env.logLevel)) {
    throw new Error(`LOG_LEVEL 无效: ${env.logLevel}（允许: ${allowedLogLevels.join('/')}）`);
  }

  if (!env.userDataDir || typeof env.userDataDir !== 'string') {
    throw new Error('USER_DATA_DIR 不能为空');
  }
}

/**
 * 加载选择器配置
 * 优先从 selectors.json 加载，如果不存在则使用 config.json 中的配置
 */
function loadSelectors(): Selectors {
  const selectorsPath = path.join(process.cwd(), 'selectors.json');

  // 如果存在独立的选择器配置文件
  if (fs.existsSync(selectorsPath)) {
    const selectorsContent = fs.readFileSync(selectorsPath, 'utf-8');
    let selectorsConfig: SelectorsJsonConfig;

    try {
      selectorsConfig = JSON.parse(selectorsContent) as SelectorsJsonConfig;
    } catch (error) {
      throw new Error(
        `selectors.json 解析失败：${error instanceof Error ? error.message : String(error)}。` +
          '请修复后再运行，或删除 selectors.json 以回退 config.json。可运行 npm run test:selectors 检查格式。'
      );
    }

    const validationErrors = validateSelectorsConfig(selectorsConfig);
    if (validationErrors.length > 0) {
      throw new Error(
        `selectors.json 配置无效：${validationErrors.join('；')}。` +
          '请修复后再运行，或删除 selectors.json 以回退 config.json。可运行 npm run test:selectors 检查格式。'
      );
    }

    log.info(
      `✓ 加载选择器配置文件 (版本: ${selectorsConfig.version}, 更新日期: ${selectorsConfig.lastUpdated})`
    );

    // 转换配置格式：将 { primary, fallback } 合并为单个选择器字符串
    const selectors: Record<string, string> = {};
    const allSelectors = {
      ...selectorsConfig.selectors,
      ...(selectorsConfig.customSelectors || {}),
    };

    for (const [key, value] of Object.entries(allSelectors)) {
      const selectorConfig = value as SelectorConfig;
      // 合并主选择器和备用选择器，用逗号分隔
      selectors[key] = selectorConfig.fallback
        ? `${selectorConfig.primary}, ${selectorConfig.fallback}`
        : selectorConfig.primary;
    }

    return selectors as Selectors;
  }

  // 返回空对象，将由 config.json 提供
  return {} as Selectors;
}

function validateSelectorsConfig(config: SelectorsJsonConfig): string[] {
  const errors: string[] = [];

  if (!config || typeof config !== 'object') {
    errors.push('配置内容不是有效对象');
    return errors;
  }

  if (!config.version || typeof config.version !== 'string') {
    errors.push('缺少 version 字段');
  }

  if (!config.lastUpdated || typeof config.lastUpdated !== 'string') {
    errors.push('缺少 lastUpdated 字段');
  }

  if (!config.selectors || typeof config.selectors !== 'object') {
    errors.push('缺少 selectors 字段');
    return errors;
  }

  for (const [key, value] of Object.entries(config.selectors)) {
    const selectorConfig = value as SelectorConfig;
    if (!selectorConfig || typeof selectorConfig !== 'object') {
      errors.push(`选择器 ${key} 配置不是对象`);
      continue;
    }
    if (!selectorConfig.primary || typeof selectorConfig.primary !== 'string') {
      errors.push(`选择器 ${key} 缺少 primary 字段`);
    }
    if (selectorConfig.fallback && typeof selectorConfig.fallback !== 'string') {
      errors.push(`选择器 ${key} fallback 字段必须是字符串`);
    }
  }

  if (config.customSelectors && typeof config.customSelectors !== 'object') {
    errors.push('customSelectors 字段必须是对象');
  }

  // 校验 customSelectors 内部条目的形状
  if (config.customSelectors && typeof config.customSelectors === 'object') {
    for (const [key, value] of Object.entries(config.customSelectors)) {
      const selectorConfig = value as SelectorConfig;
      if (!selectorConfig || typeof selectorConfig !== 'object') {
        errors.push(`自定义选择器 ${key} 配置不是对象`);
        continue;
      }
      if (!selectorConfig.primary || typeof selectorConfig.primary !== 'string') {
        errors.push(`自定义选择器 ${key} 缺少 primary 字段`);
      }
      if (selectorConfig.fallback && typeof selectorConfig.fallback !== 'string') {
        errors.push(`自定义选择器 ${key} fallback 字段必须是字符串`);
      }
    }
  }

  return errors;
}

/**
 * 加载配置文件
 */
export function loadConfig(): Config {
  const configPath = path.join(process.cwd(), 'config.json');

  if (!fs.existsSync(configPath)) {
    throw new Error('配置文件 config.json 不存在，请先创建配置文件');
  }

  const configContent = fs.readFileSync(configPath, 'utf-8');
  const config: Config = JSON.parse(configContent);

  // 尝试加载独立的选择器配置
  const selectorsFromFile = loadSelectors();

  // 如果存在独立选择器配置，则使用它；否则使用 config.json 中的配置
  if (Object.keys(selectorsFromFile).length > 0) {
    config.selectors = {
      ...config.selectors,
      ...selectorsFromFile,
    };
  }

  return config;
}

/**
 * 获取环境变量配置
 */
export function getEnvConfig(): EnvConfig {
  const defaults: EnvConfig = {
    twitterUsername: '',
    twitterPassword: '',
    headless: false,
    browserType: 'chromium',
    logLevel: 'info',
    logToFile: false,
    failOnErrors: false,
    userDataDir: './browser-data',
  };

  const browserTypeRaw = process.env.BROWSER_TYPE?.toLowerCase();
  const browserType: BrowserType =
    browserTypeRaw === 'chromium' || browserTypeRaw === 'firefox' || browserTypeRaw === 'webkit'
      ? (browserTypeRaw as BrowserType)
      : defaults.browserType;

  const logLevelRaw = process.env.LOG_LEVEL?.toLowerCase();
  const logLevel: LogLevel =
    logLevelRaw === 'error' ||
    logLevelRaw === 'warn' ||
    logLevelRaw === 'info' ||
    logLevelRaw === 'debug'
      ? (logLevelRaw as LogLevel)
      : defaults.logLevel;

  const env: EnvConfig = {
    ...defaults,
    twitterUsername: process.env.TWITTER_USERNAME ?? defaults.twitterUsername,
    twitterPassword: process.env.TWITTER_PASSWORD ?? defaults.twitterPassword,
    headless: parseEnvBoolean(process.env.HEADLESS, defaults.headless),
    browserType,
    logLevel,
    logToFile: parseEnvBoolean(process.env.LOG_TO_FILE, defaults.logToFile),
    failOnErrors: parseEnvBoolean(process.env.FAIL_ON_ERRORS, defaults.failOnErrors),
    userDataDir: process.env.USER_DATA_DIR ?? defaults.userDataDir,
  };

  validateEnvConfig(env);
  return env;
}

/**
 * 统一加载入口：ResolvedConfig = merge(fileConfig, envOverrides)
 */
export function loadResolvedConfig(): { config: Config; env: EnvConfig } {
  const config = loadConfig();
  const env = getEnvConfig();
  validateConfig(config);
  return { config, env };
}

/**
 * 验证配置
 */
export function validateConfig(config: Config): void {
  if (!config.deleteOptions) {
    throw new Error('缺少 deleteOptions 配置');
  }
  if (!config.executionConfig) {
    throw new Error('缺少 executionConfig 配置');
  }
  if (!config.retryConfig) {
    throw new Error('缺少 retryConfig 配置');
  }
  if (!config.selectors) {
    throw new Error('缺少 selectors 配置');
  }
  if (!config.urls) {
    throw new Error('缺少 urls 配置');
  }

  // 验证删除选项
  const hasDeleteOption = Object.values(config.deleteOptions).some((v) => v === true);
  if (!hasDeleteOption) {
    throw new Error(
      '至少需要启用一种删除选项（tweets/retweets/replies/likes/bookmarks/following）'
    );
  }

  // 验证执行配置
  if (
    !Number.isFinite(config.executionConfig.maxDeletePerSession) ||
    config.executionConfig.maxDeletePerSession <= 0
  ) {
    throw new Error('maxDeletePerSession 必须大于 0');
  }

  if (
    !Number.isFinite(config.executionConfig.deletePerBatch) ||
    config.executionConfig.deletePerBatch <= 0
  ) {
    throw new Error('deletePerBatch 必须大于 0');
  }

  if (config.executionConfig.maxDeletePerSession < config.executionConfig.deletePerBatch) {
    throw new Error('maxDeletePerSession 不能小于 deletePerBatch');
  }

  if (
    !Number.isFinite(config.executionConfig.delayBetweenActions) ||
    config.executionConfig.delayBetweenActions < 0
  ) {
    throw new Error('delayBetweenActions 不能小于 0');
  }

  if (
    config.executionConfig.delayJitterMs !== undefined &&
    (!Number.isFinite(config.executionConfig.delayJitterMs) ||
      config.executionConfig.delayJitterMs < 0)
  ) {
    throw new Error('delayJitterMs 不能小于 0');
  }

  if (
    !Number.isFinite(config.executionConfig.delayBetweenBatches) ||
    config.executionConfig.delayBetweenBatches < 0
  ) {
    throw new Error('delayBetweenBatches 不能小于 0');
  }

  if (
    !Number.isFinite(config.executionConfig.pageRefreshDelay) ||
    config.executionConfig.pageRefreshDelay < 0
  ) {
    throw new Error('pageRefreshDelay 不能小于 0');
  }

  if (config.executionConfig.refreshBatchInterval !== undefined) {
    const interval = config.executionConfig.refreshBatchInterval;
    if (!Number.isFinite(interval) || interval < 1 || !Number.isInteger(interval)) {
      throw new Error('refreshBatchInterval 必须是 >= 1 的整数');
    }
  }

  // 验证重试配置
  if (
    !Number.isFinite(config.retryConfig.maxRetries) ||
    config.retryConfig.maxRetries <= 0 ||
    !Number.isInteger(config.retryConfig.maxRetries)
  ) {
    throw new Error('maxRetries 必须是大于 0 的整数');
  }

  if (!Number.isFinite(config.retryConfig.retryDelay) || config.retryConfig.retryDelay < 0) {
    throw new Error('retryDelay 不能小于 0');
  }

  if (typeof config.retryConfig.exponentialBackoff !== 'boolean') {
    throw new Error('exponentialBackoff 必须是 boolean');
  }

  const requiredSelectors = new Set<string>();
  if (config.deleteOptions.tweets || config.deleteOptions.replies) {
    requiredSelectors.add('tweet');
    requiredSelectors.add('tweetMoreButton');
    requiredSelectors.add('deleteButton');
    requiredSelectors.add('confirmDeleteButton');
  }
  if (config.deleteOptions.retweets) {
    requiredSelectors.add('tweet');
    requiredSelectors.add('unretweet');
    requiredSelectors.add('unretweetConfirm');
  }
  if (config.deleteOptions.likes) {
    requiredSelectors.add('tweet');
    requiredSelectors.add('unlikeButton');
  }
  if (config.deleteOptions.bookmarks) {
    requiredSelectors.add('tweet');
    requiredSelectors.add('tweetMoreButton');
    requiredSelectors.add('removeBookmarkButton');
  }
  if (config.deleteOptions.following) {
    requiredSelectors.add('followingButton');
    requiredSelectors.add('unfollowConfirm');
  }

  const missingSelectors = Array.from(requiredSelectors).filter(
    (key) => config.selectors[key] === undefined
  );
  if (missingSelectors.length > 0) {
    throw new Error(`缺少必需的选择器配置: ${missingSelectors.join(', ')}`);
  }

  // 启动期验证选择器格式与空字符串
  validateSelectors(config.selectors);

  const requiredUrls = new Set<keyof URLs>();
  if (config.deleteOptions.tweets) {
    requiredUrls.add('tweets');
  }
  if (config.deleteOptions.replies) {
    requiredUrls.add('tweetsWithReplies');
  }
  if (config.deleteOptions.retweets) {
    requiredUrls.add('tweets');
  }
  if (config.deleteOptions.likes) {
    requiredUrls.add('likes');
  }
  if (config.deleteOptions.bookmarks) {
    requiredUrls.add('bookmarks');
  }
  if (config.deleteOptions.following) {
    requiredUrls.add('following');
  }

  const missingUrls = Array.from(requiredUrls).filter((key) => !config.urls[key]);
  if (missingUrls.length > 0) {
    throw new Error(`缺少必需的 URL 配置: ${missingUrls.join(', ')}`);
  }

  const usernameUrls: Array<keyof URLs> = ['tweets', 'tweetsWithReplies', 'likes', 'following'];
  const invalidUsernameUrls = usernameUrls.filter((key) => {
    if (!requiredUrls.has(key)) {
      return false;
    }
    const url = config.urls[key];
    return url && !url.includes('{username}');
  });
  if (invalidUsernameUrls.length > 0) {
    throw new Error(`以下 URL 必须包含 {username} 占位符: ${invalidUsernameUrls.join(', ')}`);
  }
}

export { Config };
