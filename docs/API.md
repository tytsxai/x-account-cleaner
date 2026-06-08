# API 文档

本文档描述主要类和方法的使用方式。

## 核心类

### BrowserManager

浏览器管理类，负责浏览器的初始化、配置和关闭。

#### 方法

##### `initialize(): Promise<void>`

初始化浏览器实例。

```typescript
const browserManager = new BrowserManager();
await browserManager.initialize();
```

##### `getPage(): Page`

获取当前浏览器页面实例。

```typescript
const page = browserManager.getPage();
```

##### `saveState(): Promise<void>`

保存浏览器状态（包括 Cookies 和 LocalStorage）。

```typescript
await browserManager.saveState();
```

##### `close(): Promise<void>`

关闭浏览器并清理资源。

```typescript
await browserManager.close();
```

---

### LoginManager

登录管理类，处理 Twitter 登录逻辑。登录成功以已认证页面 DOM 信号为准，而不是仅检查当前 URL。

#### 构造函数

```typescript
constructor(page: Page)
```

#### 方法

##### `isLoggedIn(): Promise<boolean>`

导航到主页后检查是否已登录。该方法等待已认证页面外壳 DOM（例如个人资料导航、账号菜单、主页导航等），不会只因为 URL 包含 `/home` 就判定成功。

```typescript
const loginManager = new LoginManager(page);
const loggedIn = await loginManager.isLoggedIn();
```

##### `login(): Promise<LoginResult>`

执行登录操作（自动或手动）。自动登录按导航、用户名输入、验证 detour 检测、密码输入、提交和最终 DOM 校验分阶段重试；遇到验证码、二次验证或账号访问限制时，有头模式会切换为手动等待，无头模式会明确失败。

```typescript
const result = await loginManager.login();
if (result.success) {
  console.log('登录成功');
}
```

**返回值**：
```typescript
interface LoginResult {
  success: boolean;
  message: string;
}
```

##### `getUsername(): Promise<string | null>`

获取当前登录用户的用户名。

```typescript
const username = await loginManager.getUsername();
console.log(`用户: @${username}`);
```

---

### TwitterDeleter

Twitter 内容删除器，执行实际的删除操作。

#### 构造函数

```typescript
constructor(page: Page, config: Config)
```

#### 方法

##### `startDeleting(username: string): Promise<DeleteStats>`

开始删除流程。

```typescript
const deleter = new TwitterDeleter(page, config);
const stats = await deleter.startDeleting('your_username');

console.log(`已删除 ${stats.tweets} 条推文`);
```

**返回值**：
```typescript
interface DeleteStats {
  tweets: number;
  retweets: number;
  replies: number;
  likes: number;
  errors: number;
}
```

##### `getStats(): DeleteStats`

获取当前统计信息。

```typescript
const stats = deleter.getStats();
```

---

### Following Management

关注管理模块位于 `src/core/following-management.ts`，用于把关注清理拆成导出、筛选、复核、确认执行四步。

#### `FollowingCollector`

```typescript
const collector = new FollowingCollector(page, config, username);
const result = await collector.export();
```

输出：
- `data/followings/<runId>/followings.jsonl`
- `data/followings/<runId>/followings.csv`

#### `FollowingClassifier`

```typescript
const classifier = new FollowingClassifier(config);
const result = classifier.classify('data/followings/<runId>/followings.jsonl');
```

输出：
- `candidates.jsonl`
- `keep-list.jsonl`
- `review.csv`
- `approved-unfollow.jsonl`（默认空文件，需要人工写入最终确认名单）

#### `FollowingExecutor`

```typescript
const executor = new FollowingExecutor(page, config, username);
const preview = executor.dryRun('data/followings/<runId>/approved-unfollow.jsonl');
const result = await executor.execute('data/followings/<runId>/approved-unfollow.jsonl');
const resumed = await executor.resume('<runId>');
```

执行器只读取确认名单，按 handle 在页面上重新匹配用户卡片后点击取关，并写入 `session.json`。默认会拒绝直接执行 `candidates.jsonl`、`followings.jsonl`、`keep-list.jsonl`，也会拒绝空确认名单。

安全行为：
- `safety.requireHeadfulForExecute=true` 时，`execute` 会拒绝 `HEADLESS=true`
- `safety.stopOnRiskSignals=true` 时，命中登录页、账号访问限制页或风险文案会停止
- `execution.maxConsecutiveFailures` 控制连续失败熔断
- `execution.cooldownEveryActions` / `execution.cooldownMs` 控制批次冷却
- `execution.requireConfirmFile=true` 时，确认文件名必须包含 `approved` 或 `confirm`

#### CLI

```bash
npm run start -- followings export
npm run start -- followings classify --input data/followings/<runId>/followings.jsonl
npm run start -- followings dry-run --input data/followings/<runId>/approved-unfollow.jsonl
npm run start -- followings execute --confirm-file data/followings/<runId>/approved-unfollow.jsonl
npm run start -- followings resume --run-id <runId>
```

---

### SelectorHelper

元素选择器工具类。

#### 构造函数

```typescript
constructor(page: Page, selectors: Selectors)
```

#### 方法

##### `waitForElement(selector: string, timeout?: number): Promise<boolean>`

等待元素出现。

```typescript
const helper = new SelectorHelper(page, selectors);
const found = await helper.waitForElement('[data-testid="tweet"]', 5000);
```

##### `safeClick(selector: string, timeout?: number): Promise<boolean>`

安全地点击元素。

```typescript
const clicked = await helper.safeClick('[data-testid="caret"]');
```

##### `getTweets(): Promise<ElementHandle[]>`

获取当前页面的所有推文元素。

```typescript
const tweets = await helper.getTweets();
console.log(`找到 ${tweets.length} 条推文`);
```

##### `scrollToBottom(): Promise<void>`

滚动到页面底部。

```typescript
await helper.scrollToBottom();
```

##### `scrollToTop(): Promise<void>`

滚动到页面顶部。

```typescript
await helper.scrollToTop();
```

---

## 工具函数

### Logger

日志工具。

```typescript
import { log } from './utils/logger';

log.info('信息日志');
log.warn('警告日志');
log.error('错误日志');
log.debug('调试日志');
log.success('成功日志');
```

---

### Retry

重试机制。

#### `withRetry<T>(fn: () => Promise<T>, options: RetryOptions, actionName?: string): Promise<T>`

为函数添加重试机制。

```typescript
import { withRetry } from './utils/retry';

const result = await withRetry(
  async () => {
    // 可能失败的操作
    return await someOperation();
  },
  {
    maxRetries: 3,
    retryDelay: 1000,
    exponentialBackoff: true,
  },
  '操作名称'
);
```

**参数**：
- `fn`: 要执行的函数
- `options`: 重试配置
  - `maxRetries`: 最大重试次数
  - `retryDelay`: 重试延迟（毫秒）
  - `exponentialBackoff`: 是否使用指数退避
  - `maxDelayMs`: 可选，单次退避延迟上限
  - `jitterRatio`: 可选，退避抖动比例
  - `maxElapsedMs`: 可选，总耗时上限
  - `retryOn`: 可选，按错误类型决定是否重试
- `actionName`: 操作名称（用于日志）

`RateLimitError` 可携带 `retryAfterMs`，`withRetry` 会优先使用该值作为下一次等待时间；`NonRetryableError` 应通过 `retryOn` 排除，直接向上抛出。

#### `sleep(ms: number): Promise<void>`

延迟指定毫秒数。

```typescript
import { sleep } from './utils/retry';

await sleep(2000); // 等待 2 秒
```

#### `randomSleep(min: number, max: number): Promise<void>`

随机延迟（模拟人类行为）。

```typescript
import { randomSleep } from './utils/retry';

await randomSleep(1000, 3000); // 随机等待 1-3 秒
```

---

## 配置管理

### `loadConfig(): Config`

加载配置文件。

```typescript
import { loadConfig } from './config/config';

const config = loadConfig();
```

### `validateConfig(config: Config): void`

验证配置是否有效。

```typescript
import { validateConfig } from './config/config';

validateConfig(config); // 如果无效会抛出错误
```

### `getEnvConfig()`

获取环境变量配置。

```typescript
import { getEnvConfig } from './config/config';

const envConfig = getEnvConfig();
console.log(envConfig.twitterUsername);
```

---

## 类型定义

### Config

```typescript
interface Config {
  deleteOptions: DeleteOptions;
  executionConfig: ExecutionConfig;
  retryConfig: RetryConfig;
  selectors: Selectors;
  urls: URLs;
}
```

### DeleteOptions

```typescript
interface DeleteOptions {
  tweets: boolean;
  retweets: boolean;
  replies: boolean;
  likes: boolean;
}
```

### ExecutionConfig

```typescript
interface ExecutionConfig {
  maxDeletePerSession: number;   // 单次最大删除数
  deletePerBatch: number;         // 每批删除数
  delayBetweenActions: number;    // 操作间延迟（ms）
  delayBetweenBatches: number;    // 批次间延迟（ms）
  pageRefreshDelay: number;       // 页面刷新延迟（ms）
}
```

### RetryConfig

```typescript
interface RetryConfig {
  maxRetries: number;             // 最大重试次数
  retryDelay: number;             // 重试延迟（ms）
  exponentialBackoff: boolean;    // 指数退避
}
```

删除执行内部会把频率限制、页面临时异常和账号访问受限映射到 `RetryableError` / `RateLimitError` / `NonRetryableError`。频率限制按退避重试；账号限制、验证、锁定或访问受限会停止删除流程。

### Selectors

```typescript
interface Selectors {
  tweetMoreButton: string;        // 推文"更多"按钮
  deleteButton: string;           // 删除按钮
  confirmDeleteButton: string;    // 确认删除按钮
  tweet: string;                  // 推文容器
  unretweet: string;              // 取消转推按钮
  unretweetConfirm: string;       // 确认取消转推
}
```

---

## 使用示例

### 基础使用

```typescript
import { BrowserManager } from './core/browser';
import { LoginManager } from './core/login';
import { TwitterDeleter } from './core/deleter';
import { loadConfig } from './config/config';

async function main() {
  const config = loadConfig();
  const browserManager = new BrowserManager();
  
  await browserManager.initialize();
  const page = browserManager.getPage();
  
  const loginManager = new LoginManager(page);
  await loginManager.login();
  
  const username = await loginManager.getUsername();
  
  const deleter = new TwitterDeleter(page, config);
  const stats = await deleter.startDeleting(username!);
  
  console.log('删除完成:', stats);
  
  await browserManager.close();
}

main();
```

### 自定义删除逻辑

```typescript
import { TwitterDeleter } from './core/deleter';

class MyCustomDeleter extends TwitterDeleter {
  // 覆盖删除逻辑
  protected async shouldDelete(tweet: any): Promise<boolean> {
    // 自定义过滤条件
    const text = await tweet.textContent();
    return text.includes('某个关键词');
  }
}

// 使用自定义删除器
const deleter = new MyCustomDeleter(page, config);
await deleter.startDeleting(username);
```

### 添加钩子函数

```typescript
class HookedDeleter extends TwitterDeleter {
  async onBeforeDelete(tweet: any) {
    // 删除前的操作
    console.log('准备删除推文');
  }

  async onAfterDelete(success: boolean) {
    // 删除后的操作
    if (success) {
      console.log('删除成功');
    }
  }
}
```

---

更多详细信息请查看源代码中的 JSDoc 注释。























