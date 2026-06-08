# 高级使用指南

本文档介绍一些高级用法和自定义方法。

## 自定义选择器

### 为什么需要自定义选择器？

Twitter 经常更新页面结构，导致默认选择器失效。你需要根据最新的页面结构更新选择器。

### 如何找到正确的选择器？

1. **打开 Twitter 页面**
   - 访问你的个人主页
   - 找到一条推文

2. **打开开发者工具**
   - 按 F12 或右键 → 检查
   - 点击元素选择器图标（Ctrl + Shift + C）

3. **找到关键元素**
   - 推文容器：通常有 `data-testid="tweet"`
   - "更多"按钮：查找 `aria-label` 包含"更多"
   - 删除按钮：`data-testid` 可能包含 "delete"

4. **测试选择器**
   ```javascript
   // 在 Console 中测试
   document.querySelector('[data-testid="tweet"]')
   document.querySelectorAll('[data-testid="tweet"]').length
   ```

5. **更新配置文件**
   ```json
   {
     "selectors": {
       "tweet": "[data-testid='tweet']",
       "tweetMoreButton": "[aria-label*='更多']"
     }
   }
   ```

### 推荐的选择器优先级

1. `[data-testid="xxx"]` - 最稳定（推荐）
2. `[aria-label="xxx"]` - 较稳定
3. `[role="xxx"]` - 一般
4. `.class-name` - 容易变化（不推荐）

## 配置优化

### 速度优化（激进模式）

适用于快速清理大量内容（风险较高）：

```json
{
  "executionConfig": {
    "maxDeletePerSession": 500,
    "deletePerBatch": 10,
    "delayBetweenActions": 1000,
    "delayJitterMs": 300,
    "delayBetweenBatches": 2000,
    "pageRefreshDelay": 3000,
    "refreshBatchInterval": 2
  },
  "retryConfig": {
    "maxRetries": 2,
    "retryDelay": 3000,
    "exponentialBackoff": false
  }
}
```

**参数说明：**
- `delayJitterMs`：动作延迟的随机抖动范围（越小越快，但更容易触发限制）
- `refreshBatchInterval`：每 N 个批次刷新一次页面（减少刷新频率可提升速度）
- `retryConfig.retryDelay`：普通动作失败的基础重试延迟；频率限制会触发更长的内部退避，不建议用很小的值压缩重试间隔

### 稳定模式（保守模式）

适用于重要账号，避免触发限制：

首次运行仍建议使用根目录 `config.json` 的默认 `maxDeletePerSession: 5`；下面配置适合已经完成小批量验证后的长期分批清理。

```json
{
  "executionConfig": {
    "maxDeletePerSession": 50,
    "deletePerBatch": 3,
    "delayBetweenActions": 3000,
    "delayBetweenBatches": 5000,
    "pageRefreshDelay": 8000
  },
  "retryConfig": {
    "maxRetries": 5,
    "retryDelay": 10000,
    "exponentialBackoff": true
  }
}
```

### 测试模式

用于测试选择器是否正确：

```json
{
  "executionConfig": {
    "maxDeletePerSession": 5,
    "deletePerBatch": 1,
    "delayBetweenActions": 5000,
    "delayBetweenBatches": 5000,
    "pageRefreshDelay": 5000
  }
}
```

## 多账号管理

### 方法 1：多个浏览器数据目录

```bash
# 先构建一次
npm run build

# 账号 1
set USER_DATA_DIR=./browser-data-account1
npm run start:prod

# 账号 2
set USER_DATA_DIR=./browser-data-account2
npm run start:prod
```

### 方法 2：多个 .env 文件

```bash
# 创建多个配置文件
.env.account1
.env.account2

# 使用时复制
copy .env.account1 .env
npm run start:prod
```

### 方法 3：配置文件切换

```javascript
// 创建启动脚本 run-account.js
const fs = require('fs');
const { spawn } = require('child_process');

const account = process.argv[2] || '1';
const envFile = `.env.account${account}`;

if (fs.existsSync(envFile)) {
  fs.copyFileSync(envFile, '.env');
  spawn('npm', ['run', 'start:prod'], { stdio: 'inherit' });
} else {
  console.error(`配置文件 ${envFile} 不存在`);
}
```

使用：
```bash
node run-account.js 1
node run-account.js 2
```

## 定时任务

### Windows 任务计划程序

1. **创建批处理脚本** (`run-cleaner.bat`)
   ```batch
   @echo off
   cd /d "C:\path\to\推特高效清理"
   call npm run build
   call npm run start:prod
   ```

2. **添加到任务计划**
   - Win + R → `taskschd.msc`
   - 创建基本任务
   - 设置触发器（每天/每周）
   - 操作：启动程序 → 选择 `run-cleaner.bat`

### Linux/macOS Cron

1. **创建脚本** (`run-cleaner.sh`)
   ```bash
   #!/bin/bash
   cd /path/to/推特高效清理
   npm run build
   npm run start:prod
   ```

2. **添加执行权限**
   ```bash
   chmod +x run-cleaner.sh
   ```

3. **配置 Crontab**
   ```bash
   crontab -e
   
   # 每天凌晨 2 点执行
   0 2 * * * /path/to/run-cleaner.sh >> /path/to/logs/cron.log 2>&1
   ```

## Docker 部署

### Dockerfile 示例

```dockerfile
FROM node:18-alpine

# 安装 Playwright 依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  twitter-cleaner:
    build: .
    volumes:
      - ./config.json:/app/config.json
      - ./browser-data:/app/browser-data
      - ./logs:/app/logs
    environment:
      - HEADLESS=true
      - LOG_LEVEL=info
    restart: unless-stopped
```

### 使用

```bash
# 构建
docker-compose build

# 运行
docker-compose up

# 后台运行
docker-compose up -d

# 查看日志
docker-compose logs -f
```

## 代码扩展

### 添加自定义过滤器

编辑 `src/core/deleter.ts`：

```typescript
/**
 * 自定义过滤：只删除点赞数少于 10 的推文
 */
private async shouldDeleteTweet(tweetElement: any): Promise<boolean> {
  try {
    // 获取点赞数
    const likeButton = await tweetElement.$('[data-testid="like"]');
    const likeText = await likeButton?.textContent();
    const likes = parseInt(likeText || '0');

    // 只删除点赞数少于 10 的
    return likes < 10;
  } catch {
    return true; // 如果无法获取，默认删除
  }
}

// 在 deleteSingleTweet 中使用
private async deleteSingleTweet(tweetElement: any, type: ContentType): Promise<boolean> {
  // 添加过滤逻辑
  if (!await this.shouldDeleteTweet(tweetElement)) {
    log.debug('跳过高互动推文');
    return false;
  }

  // 原有删除逻辑...
}
```

### 添加导出功能

```typescript
/**
 * 导出推文为 JSON
 */
async exportTweets(username: string, outputFile: string) {
  const tweets = [];
  const url = this.config.urls.tweets.replace('{username}', username);
  
  await this.page.goto(url);
  
  const tweetElements = await this.selectorHelper.getTweets();
  
  for (const tweet of tweetElements) {
    const text = await tweet.$eval('[data-testid="tweetText"]', el => el.textContent);
    const time = await tweet.$eval('time', el => el.getAttribute('datetime'));
    
    tweets.push({ text, time });
  }
  
  fs.writeFileSync(outputFile, JSON.stringify(tweets, null, 2));
  log.success(`已导出 ${tweets.length} 条推文到 ${outputFile}`);
}
```

### 添加通知功能

```typescript
import nodemailer from 'nodemailer';

/**
 * 发送邮件通知
 */
async sendNotification(stats: DeleteStats) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER,
    subject: 'Twitter 清理完成',
    text: `
      删除统计：
      推文: ${stats.tweets}
      回复: ${stats.replies}
      转推: ${stats.retweets}
    `,
  });
}
```

## 性能监控

### 添加性能日志

```typescript
// src/utils/performance.ts
export class PerformanceMonitor {
  private startTime: number = 0;
  private metrics: Map<string, number[]> = new Map();

  start() {
    this.startTime = Date.now();
  }

  record(operation: string, duration: number) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation)!.push(duration);
  }

  report() {
    console.log('\n=== 性能报告 ===');
    
    for (const [op, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      console.log(`${op}: 平均 ${avg.toFixed(2)}ms, 共 ${durations.length} 次`);
    }
    
    const total = Date.now() - this.startTime;
    console.log(`总耗时: ${(total / 1000).toFixed(2)}秒`);
  }
}
```

## API 集成（高级）

如果你有 Twitter API 开发者权限：

```typescript
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

// 使用 API 删除（更快更稳定）
async function deleteViaAPI(tweetId: string) {
  await client.v2.deleteTweet(tweetId);
}
```

**注意**：Twitter API 需要申请开发者账号，且有速率限制。

## 故障恢复

### 实现断点续传

```typescript
// 保存进度
class ProgressTracker {
  private progressFile = './progress.json';

  save(deletedIds: string[]) {
    fs.writeFileSync(this.progressFile, JSON.stringify(deletedIds));
  }

  load(): string[] {
    if (fs.existsSync(this.progressFile)) {
      return JSON.parse(fs.readFileSync(this.progressFile, 'utf-8'));
    }
    return [];
  }

  clear() {
    if (fs.existsSync(this.progressFile)) {
      fs.unlinkSync(this.progressFile);
    }
  }
}
```

## 安全建议

### 代理设置

```typescript
// 在 BrowserManager 的 launchPersistentContext() 选项中添加代理支持
this.context = await browserType.launchPersistentContext(profileDir, {
  proxy: {
    server: 'http://proxy-server:port',
    username: 'user',
    password: 'pass',
  },
});
```

### 稳定请求画像

```typescript
this.context = await browserType.launchPersistentContext(profileDir, {
  userAgent: envConfig.userAgent,
  locale: envConfig.locale,
  timezoneId: envConfig.timezoneId,
});
```

同一账号应长期保持同一个 `USER_DATA_DIR/profile/` 和同一套 UA、视口、语言、时区配置；频繁随机化画像更容易造成异常漂移。

---

更多高级用法请参考源代码或提交 Issue 讨论。























