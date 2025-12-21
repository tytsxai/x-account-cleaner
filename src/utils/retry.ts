import { log } from './logger';

export interface RetryOptions {
  /**
   * 最大尝试次数（包含第一次执行）。
   * 例如 maxRetries=1 表示不重试，只执行 1 次。
   */
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff?: boolean;
  /**
   * 单次退避延迟上限（毫秒），用于防止指数退避无限增长
   */
  maxDelayMs?: number;
  /**
   * 抖动比例（0~1 常见），用于避免重试风暴。
   * delay = delay * (1 + (Math.random() - 0.5) * jitterRatio)
   */
  jitterRatio?: number;
  /**
   * 总耗时上限（毫秒），超过后立即终止并抛错（包含等待时间）
   */
  maxElapsedMs?: number;
  /**
   * 分类重试钩子：返回 false 则不重试，直接抛出当前错误
   */
  retryOn?: (error: unknown) => boolean;
}

/**
 * 重试机制包装器
 * @param fn 要执行的函数
 * @param options 重试配置
 * @param actionName 操作名称（用于日志）
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
  actionName = '操作'
): Promise<T> {
  const {
    maxRetries,
    retryDelay,
    exponentialBackoff = true,
    maxDelayMs,
    jitterRatio,
    maxElapsedMs,
    retryOn,
  } = options;

  const startedAt = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // 分类重试检查
      if (retryOn && !retryOn(error)) {
        throw error;
      }

      // 总耗时检查
      const elapsedMs = Date.now() - startedAt;
      if (maxElapsedMs !== undefined && elapsedMs > maxElapsedMs) {
        const timeoutError: Error & { cause?: unknown } = new Error(
          `${actionName}失败，已超过最大耗时 (${maxElapsedMs}ms)`
        );
        timeoutError.cause = error;
        throw timeoutError;
      }

      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) {
        log.error(`${actionName}失败，已达到最大重试次数 (${maxRetries})`);
        throw error;
      }

      // 计算延迟
      let delayMs = exponentialBackoff ? retryDelay * Math.pow(2, attempt - 1) : retryDelay;

      // 应用延迟上限
      if (maxDelayMs !== undefined && Number.isFinite(maxDelayMs)) {
        delayMs = Math.min(delayMs, Math.max(0, maxDelayMs));
      }

      // 应用抖动
      if (jitterRatio !== undefined && Number.isFinite(jitterRatio) && jitterRatio > 0) {
        const ratio = Math.max(0, jitterRatio);
        delayMs = delayMs * (1 + (Math.random() - 0.5) * ratio);
      }

      // 确保延迟有效
      if (!Number.isFinite(delayMs)) {
        delayMs = 0;
      }
      delayMs = Math.max(0, Math.floor(delayMs));

      // 检查等待后是否会超时
      const elapsedBeforeSleepMs = Date.now() - startedAt;
      if (maxElapsedMs !== undefined && elapsedBeforeSleepMs + delayMs > maxElapsedMs) {
        const timeoutError: Error & { cause?: unknown } = new Error(
          `${actionName}失败，已超过最大耗时 (${maxElapsedMs}ms)`
        );
        timeoutError.cause = error;
        throw timeoutError;
      }

      log.warn(
        `${actionName}失败 (尝试 ${attempt}/${maxRetries})，${delayMs}ms 后重试...`,
        error instanceof Error ? error.message : String(error)
      );

      await sleep(delayMs);
    }
  }

  throw new Error(`${actionName}失败`);
}

/**
 * 延迟函数
 * @param ms 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 随机延迟（模拟人类行为）
 * @param min 最小延迟（毫秒）
 * @param max 最大延迟（毫秒）
 */
export function randomSleep(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}
