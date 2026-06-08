# 项目架构说明

本文档描述项目的整体架构和设计思路。

## 目录结构

```
x-account-cleaner/
├── src/                      # 源代码
│   ├── config/              # 配置管理
│   │   └── config.ts        # 配置加载和验证
│   ├── core/                # 核心功能
│   │   ├── browser.ts       # 浏览器管理
│   │   ├── login.ts         # 登录逻辑
│   │   ├── deleter.ts       # 删除逻辑
│   │   └── following-management.ts # 关注导出/筛选/确认执行
│   ├── utils/               # 工具函数
│   │   ├── logger.ts        # 日志系统
│   │   ├── retry.ts         # 重试机制
│   │   └── selector.ts      # 选择器工具
│   ├── types/               # 类型定义
│   │   └── index.ts         # TypeScript 类型
│   └── index.ts             # 主入口
├── docs/                     # 文档
├── logs/                     # 日志文件（自动生成）
├── browser-data/             # 浏览器数据（自动生成，含 profile/ 与 state.json）
├── config.json               # 用户配置
├── .env                      # 环境变量
└── package.json              # 项目配置
```

## 分层架构

### 1. 入口层（Entry Layer）

**文件**：`src/index.ts`

**职责**：
- 程序启动和初始化
- 协调各个模块
- 错误处理和资源清理
- 用户交互（确认、倒计时）

**流程**：
```
默认清理：启动 → 加载配置 → 初始化浏览器 → 登录 → 删除 → 清理退出
关注管理：启动 → 加载配置 → 导出/筛选/预览/执行 → 写入数据文件与 session → 清理退出
```

### 2. 核心层（Core Layer）

#### BrowserManager (`src/core/browser.ts`)

**职责**：
- 浏览器生命周期管理
- 浏览器配置和初始化
- 持久浏览器 profile 与登录状态快照管理
- 反自动化检测

**关键方法**：
- `initialize()`: 初始化浏览器
- `saveState()`: 保存 `state.json` 登录状态快照
- `close()`: 关闭浏览器

**会话状态职责拆分**：
- `USER_DATA_DIR/profile/` 是主会话存储，由 `launchPersistentContext()` 使用，长期保存 cookies、localStorage、IndexedDB、Service Worker 和浏览器 profile 元数据。
- `USER_DATA_DIR/state.json` 是 `saveState()` 写出的 Playwright storage-state 快照，主要用于审计、迁移和新 profile 的 cookie 恢复，不是已建立 profile 的唯一登录状态来源。
- `USER_DATA_DIR` 根目录保留项目控制文件，例如 `run.lock` 和 `state.json`，避免和浏览器 profile 内部文件混放。
- `initialize()` 启动失败时会关闭已创建的 page/context，并只清理本次新建的空 `profile/`；已有 profile 不会被自动删除。

#### LoginManager (`src/core/login.ts`)

**职责**：
- Twitter 登录管理
- 基于已认证 DOM 信号进行登录状态检测
- 自动登录分阶段重试：导航、用户名、验证 detour、密码、提交、最终校验
- 手动登录等待验证码、二次验证、账号访问限制和页面延迟渲染
- 用户信息获取

**关键方法**：
- `login()`: 执行登录
- `isLoggedIn()`: 导航到主页并通过 DOM 信号检查登录状态
- `getUsername()`: 获取用户名

#### TwitterDeleter (`src/core/deleter.ts`)

**职责**：
- 内容删除主逻辑
- 批量处理
- 进度追踪
- 统计信息

**关键方法**：
- `startDeleting()`: 开始删除流程
- `deleteContentType()`: 删除指定类型
- `deleteBatch()`: 批量删除
- `deleteSingleTweet()`: 删除单条

#### FollowingCollector / FollowingClassifier / FollowingExecutor (`src/core/following-management.ts`)

**职责**：
- 只读导出关注列表快照
- 按本地规则生成候选取关名单、保留名单和复核 CSV
- 生成空的 `approved-unfollow.jsonl`，要求人工填入最终确认名单
- 只根据 `approved-unfollow.jsonl` 执行确认过的取关，并拒绝直接执行候选/导出/保留名单
- 原子写入 `session.json`，支持中断后恢复
- 执行期风险门禁：有头模式要求、风险文案/限制页检测、连续失败熔断、批次冷却

**关键方法**：
- `FollowingCollector.export()`: 写出 `followings.jsonl` / `followings.csv`
- `FollowingClassifier.classify()`: 写出 `candidates.jsonl` / `keep-list.jsonl` / `review.csv`
- `FollowingExecutor.dryRun()`: 预览确认名单，不打开浏览器、不点击取关
- `FollowingExecutor.execute()`: 按 handle 精确匹配用户卡片后慢速取关
- `FollowingExecutor.resume()`: 从 `session.json` 继续执行

### 3. 工具层（Utility Layer）

#### Logger (`src/utils/logger.ts`)

**职责**：
- 统一日志管理
- 控制台输出美化
- 文件日志记录

**特性**：
- 多级别日志（error/warn/info/debug）
- 彩色输出
- 文件持久化

#### SelectorHelper (`src/utils/selector.ts`)

**职责**：
- DOM 元素选择和操作
- 安全的元素交互
- 页面滚动控制

**关键方法**：
- `waitForElement()`: 等待元素
- `safeClick()`: 安全点击
- `getTweets()`: 获取推文列表

#### Retry (`src/utils/retry.ts`)

**职责**：
- 重试机制封装
- 延迟控制
- 指数退避
- 按错误类型决定是否重试
- 识别 `RateLimitError.retryAfterMs` 并使用更长退避

**关键方法**：
- `withRetry()`: 重试包装器
- `sleep()`: 延迟
- `randomSleep()`: 随机延迟

### 4. 配置层（Configuration Layer）

#### Config (`src/config/config.ts`)

**职责**：
- 配置文件加载
- 环境变量管理
- 配置验证

**配置来源**：
1. `config.json` - 业务配置
2. `.env` - 环境变量
3. 默认值

## 数据流

```
用户输入（config.json, .env）
    ↓
配置加载（config.ts）
    ↓
浏览器初始化（browser.ts）
    ↓
登录验证（login.ts）
    ├→ 已认证 DOM 信号检测
    ├→ 自动登录分阶段重试
    └→ 手动登录/验证 detour 等待
    ↓
删除执行（deleter.ts）
    ├→ 元素选择（selector.ts）
    ├→ 重试机制（retry.ts）
    └→ 日志记录（logger.ts）
    ↓
结果输出（统计信息）
```

关注管理数据流：

```
X 关注页面
    ↓
FollowingCollector
    ↓
followings.jsonl / followings.csv
    ↓
FollowingClassifier + followingManagement.rules
    ↓
candidates.jsonl / keep-list.jsonl / review.csv
    ↓
人工确认 approved-unfollow.jsonl
    ↓
FollowingExecutor
    ↓
session.json / [UNFOLLOW_TARGET] 日志
```

设备画像由 `BrowserManager` 统一设置，来自 `.env` 的 `BROWSER_USER_AGENT`、视口、DPR、语言和时区。原则是同一账号长期保持稳定画像，而不是每次运行随机变化。

## 设计模式

### 1. 单一职责原则（SRP）

每个类只负责一个功能领域：
- `BrowserManager` - 浏览器管理
- `LoginManager` - 登录管理
- `TwitterDeleter` - 删除管理
- `FollowingCollector` / `FollowingClassifier` / `FollowingExecutor` - 关注管理

### 2. 依赖注入

通过构造函数注入依赖：

```typescript
class TwitterDeleter {
  constructor(
    private page: Page,      // 注入页面对象
    private config: Config   // 注入配置
  ) {}
}
```

### 3. 策略模式

删除策略可配置：

```typescript
// 不同的删除策略
deleteOptions: {
  tweets: true,
  retweets: true,
  replies: false,
  likes: false
}
```

### 4. 装饰器模式

`withRetry` 为函数添加重试能力：

```typescript
await withRetry(
  async () => { /* 原函数 */ },
  { maxRetries: 3 }
);
```

## 错误处理策略

### 1. 分层错误处理

```
应用层（index.ts）
  ↓ try-catch 捕获所有错误
核心层（core/）
  ↓ try-catch 捕获业务错误
工具层（utils/）
  ↓ 返回错误状态或抛出异常
```

### 2. 重试机制

对网络操作和 DOM 操作使用重试：
- 最大重试次数
- 指数退避
- 可选延迟上限、抖动和总耗时限制
- `retryOn` 分类重试
- 频率限制使用 `RateLimitError.retryAfterMs` 延长等待

删除器在每次破坏性动作前后检测阻断状态：
- 频率限制：按可重试阻断处理，进入退避重试
- 页面临时异常：按可重试阻断处理
- 登录验证、账号锁定、访问受限、异常活动：按非重试阻断停止流程

### 3. 日志记录

所有错误都记录到日志：
- 控制台输出
- 文件持久化
- 不同级别

## 性能优化

### 1. 批量处理

每次删除固定数量，刷新页面：
```typescript
deletePerBatch: 5  // 每批 5 条
```

### 2. 延迟控制

避免过快操作触发限制：
```typescript
delayBetweenActions: 2000   // 操作间延迟
delayBetweenBatches: 3000   // 批次间延迟
```

滚动和点击 helper 内部已经包含短等待，删除循环不再额外叠加同类固定等待；成功动作后的节流仍由 `delayBetweenActions + delayJitterMs` 控制。

### 3. 智能等待

使用 Playwright 的智能等待：
```typescript
await page.waitForSelector(selector, { state: 'visible' })
```

## 安全考虑

### 1. 反自动化检测

- 随机延迟
- 模拟人类行为
- 自定义 User-Agent
- 覆盖 webdriver 标志

### 2. 凭据保护

- 使用环境变量
- 不提交 `.env` 到版本控制
- 支持手动登录

### 3. 数据隔离

- 独立的浏览器数据目录
- 会话隔离

## 扩展性设计

### 1. 可配置性

核心逻辑不写死参数，通过配置控制：
```json
{
  "selectors": { /* 可自定义选择器 */ },
  "urls": { /* 可自定义 URL */ }
}
```

### 2. 模块化

功能模块独立，易于替换和扩展：
```typescript
// 可以轻松创建子类扩展功能
class MyDeleter extends TwitterDeleter {
  // 自定义逻辑
}
```

### 3. 类型安全

使用 TypeScript 确保类型安全：
```typescript
interface Config {
  deleteOptions: DeleteOptions;
  // 明确的类型定义
}
```

## 未来架构演进

### 短期

```
当前架构
    ↓
+ 数据持久层（存储删除记录）
+ 过滤器系统（按条件筛选）
```

### 中期

```
单体架构
    ↓
+ Web 服务层（REST API）
+ 前端界面（React/Vue）
+ 数据库（SQLite/PostgreSQL）
```

### 长期

```
单机部署
    ↓
+ 微服务架构
+ 消息队列（异步处理）
+ 分布式调度
+ 云端部署
```

## 技术栈

### 核心依赖

- **Playwright**: 浏览器自动化
- **TypeScript**: 类型安全
- **Winston**: 日志系统
- **Dotenv**: 环境变量管理

### 开发工具

- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **ts-node**: TypeScript 运行
- **ts-node-dev**: 开发热重载

## 最佳实践

### 1. 代码组织

- 按功能分层
- 单文件单一职责
- 导出清晰的接口

### 2. 命名规范

- 类名：PascalCase
- 函数/变量：camelCase
- 常量：UPPER_SNAKE_CASE
- 文件：kebab-case

### 3. 注释和文档

- 关键逻辑添加注释
- 公开方法添加 JSDoc
- 复杂算法说明原理

### 4. 错误处理

- 不吞掉错误
- 提供有意义的错误信息
- 记录错误上下文

## 总结

本项目采用**分层模块化架构**，具有以下特点：

✅ **清晰的职责划分**：每个模块职责明确  
✅ **良好的扩展性**：易于添加新功能  
✅ **高可维护性**：代码结构清晰  
✅ **类型安全**：TypeScript 保障  
✅ **配置驱动**：行为可配置  
✅ **错误恢复**：完善的重试和日志

这种架构适合当前规模，也为未来扩展预留了空间。




















