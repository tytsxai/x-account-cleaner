# 项目架构说明

本文档描述项目的整体架构和设计思路。

## 目录结构

```
twitter-auto-cleaner/
├── src/                      # 源代码
│   ├── config/              # 配置管理
│   │   └── config.ts        # 配置加载和验证
│   ├── core/                # 核心功能
│   │   ├── browser.ts       # 浏览器管理
│   │   ├── login.ts         # 登录逻辑
│   │   └── deleter.ts       # 删除逻辑
│   ├── utils/               # 工具函数
│   │   ├── logger.ts        # 日志系统
│   │   ├── retry.ts         # 重试机制
│   │   └── selector.ts      # 选择器工具
│   ├── types/               # 类型定义
│   │   └── index.ts         # TypeScript 类型
│   └── index.ts             # 主入口
├── docs/                     # 文档
├── logs/                     # 日志文件（自动生成）
├── browser-data/             # 浏览器数据（自动生成）
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
启动 → 加载配置 → 初始化浏览器 → 登录 → 删除 → 清理退出
```

### 2. 核心层（Core Layer）

#### BrowserManager (`src/core/browser.ts`)

**职责**：
- 浏览器生命周期管理
- 浏览器配置和初始化
- 登录状态持久化
- 反自动化检测

**关键方法**：
- `initialize()`: 初始化浏览器
- `saveState()`: 保存登录状态
- `close()`: 关闭浏览器

#### LoginManager (`src/core/login.ts`)

**职责**：
- Twitter 登录管理
- 登录状态检测
- 用户信息获取

**关键方法**：
- `login()`: 执行登录
- `isLoggedIn()`: 检查登录状态
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
    ↓
删除执行（deleter.ts）
    ├→ 元素选择（selector.ts）
    ├→ 重试机制（retry.ts）
    └→ 日志记录（logger.ts）
    ↓
结果输出（统计信息）
```

## 设计模式

### 1. 单一职责原则（SRP）

每个类只负责一个功能领域：
- `BrowserManager` - 浏览器管理
- `LoginManager` - 登录管理
- `TwitterDeleter` - 删除管理

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
- 失败回调

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



























