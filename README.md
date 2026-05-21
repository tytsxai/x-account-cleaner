# X Account Cleaner - X / Twitter 自动清理工具

[![Release](https://img.shields.io/github/v/release/tytsxai/x-account-cleaner)](https://github.com/tytsxai/x-account-cleaner/releases) · [llms.txt](llms.txt) · [Changelog](CHANGELOG.md) · [Issues](https://github.com/tytsxai/x-account-cleaner/issues)

> **关键词**:X Account Cleaner · X 账号清理工具 · Twitter 账号清理工具 · Twitter Auto Cleaner · Twitter Cleaner · X 批量删除推文 · Twitter 批量删除推文 · X 批量取消点赞 · X 批量取消关注 · X 删书签 · X 注销前清理 · X 小号整理 · X 批量清理工具
>
> **Keywords**: X Account Cleaner · Twitter Auto Cleaner · Twitter cleaner · X account cleanup tool · Twitter account wipe · bulk delete tweets · bulk unlike Twitter · bulk unfollow Twitter · Twitter pre-deletion cleanup · Playwright Twitter cleaner · open-source X cleaner · alternative to redact for Twitter

**X Account Cleaner** 是一个基于 Playwright 的本地 X / Twitter 账号清理工具，也可按旧名称 `twitter-auto-cleaner` 搜索到。它可以批量删除推文、回复、转推、点赞、书签，并通过导出、规则筛选、人工复核、确认名单执行的流程安全管理关注取关。**完全本地运行** —— Playwright 控制 Chromium 浏览器自动化你自己的登录会话，**不走 X 官方 API**，凭据只在本机。

**仓库地址**:https://github.com/tytsxai/x-account-cleaner

> ⚠️ **Best-effort,不保证可用 — X 的 DOM 随时变,选择器随时坏**
>
> 这个工具靠抓取 `x.com` / `twitter.com` 的页面元素（如 `[data-testid="UserCell"]`、`[href*="/status/"]`，见 `src/utils/selector.ts`）来识别推文、回复、关注等。**X 的前端结构会无预警变动**，一次发布就可能让选择器全部失效；恢复需要重新对照线上 DOM 校准。
>
> - 删除后无法撤销（X 不提供 trash），**先在 `config.json` 里把 `deleteOptions` 中不想动的类目设为 `false`、把 `executionConfig.maxDeletePerSession` 调小**（默认 100）做小批量试跑，确认目标识别正确再全量。
> - 卡在某一步、计数不动、或动作明显误伤：基本可以判断是选择器过期，提 issue 附上当时的 X 页面 HTML 片段更便于修。
> - 维护策略：**坏了才修**，不做主动跟进，无 CI 守护进程探测线上 DOM 变化。

## ✨ 功能特性

### 核心清理功能
- 🐦 **删除推文**：批量删除所有普通推文
- 💬 **删除回复**：批量删除所有回复内容
- 🔄 **取消转推**：批量取消所有转推
- ❤️ **取消点赞**：批量取消所有点赞的推文
- 🔖 **删除书签**：批量删除所有保存的书签
- 👥 **关注管理**：导出关注列表、规则筛选候选、人工复核确认、慢速顺序取消关注

### 技术特性
- 🔐 **登录管理**：支持自动登录和手动登录，保存登录状态
- ⚙️ **配置化管理**：通过配置文件自定义清理策略
- 🔄 **智能重试**：自动重试失败的操作，支持指数退避
- 📊 **详细日志**：完整的日志记录，支持文件输出
- 🎯 **批量处理**：分批清理，避免触发 Twitter 限制
- 🛡️ **反检测**：模拟真实用户行为，降低被检测风险
- 📈 **进度追踪**：实时显示清理进度和统计信息

## 📋 环境要求

- Node.js >= 18.18.0（当前 ESLint / TypeScript 工具链要求 Node 18.18+）
- npm 或 yarn
- Windows / macOS / Linux

## 🚀 快速开始

> 💡 **新手友好**：我们提供了一键启动脚本，无需了解命令行！

### 方式一：一键启动（推荐）

**Windows 用户：**
1. 双击运行 `install.bat` 安装依赖
2. 双击运行 `start.bat` 启动程序
3. 在浏览器中完成登录
4. 程序自动开始清理

**Linux/Mac 用户：**
```bash
# 1. 安装依赖
chmod +x install.sh
./install.sh

# 2. 启动程序
chmod +x start.sh
./start.sh
```

### 方式二：命令行启动

如果你熟悉命令行，可以使用 npm 命令：

```bash
# 1. 安装依赖
npm install
npx playwright install chromium

# 2. 启动程序（生产模式）
npm run build
npm run start:prod

# 快速运行（非生产）
npm start

# 或：开发模式（热加载，代码修改自动重启）
npm run dev
```

---

## 📖 启动模式说明

### 🚀 生产模式（正常使用）

**启动方式：**
- Windows: 双击 `start.bat`
- Linux/Mac: `./start.sh`
- 命令行: `npm run build && npm run start:prod`

**特点：** 稳定可靠，适合日常使用

### 🔥 开发模式（代码开发）

**启动方式：**
- Windows: 双击 `开发模式启动.bat`
- Linux/Mac: `./开发模式启动.sh`
- 命令行: `npm run dev`

**特点：**
- ✨ **热加载** - 修改代码后自动重启
- ✨ 实时查看代码更改效果
- ✨ 无需手动编译

**详细启动说明请查看：** [启动指南.md](启动指南.md)

---

## ⚙️ 配置说明

### 1. 配置环境变量（可选）

复制 `env.example` 到 `.env` 并填写配置：

```bash
# Windows
copy env.example .env

# macOS/Linux
cp env.example .env
```

编辑 `.env` 文件：

```env
# Twitter 登录信息（可选）
TWITTER_USERNAME=your_username_or_email
TWITTER_PASSWORD=your_password

# 浏览器配置
HEADLESS=false                    # 是否无头模式（建议设为 false）
BROWSER_TYPE=chromium             # 浏览器类型：chromium/firefox/webkit
BROWSER_VIEWPORT_WIDTH=1512       # 稳定设备画像：14 英寸 MacBook Pro 全屏基准
BROWSER_VIEWPORT_HEIGHT=982
BROWSER_DEVICE_SCALE_FACTOR=2
BROWSER_LOCALE=zh-CN
BROWSER_TIMEZONE_ID=Asia/Shanghai
BROWSER_USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36

# 日志配置
LOG_LEVEL=info                    # 日志级别：error/warn/info/debug
LOG_TO_FILE=true                  # 是否记录到文件

# 运行配置
FAIL_ON_ERRORS=false              # 是否在出现错误时退出码非 0
ALLOW_LEGACY_FOLLOWING_DELETE=false # 默认禁止旧式直接取关，推荐 followings 四步工作流

# 其他配置
USER_DATA_DIR=./browser-data      # 浏览器数据目录
```

### 2. 配置删除选项（必需）

编辑 `config.json` 文件，自定义删除策略：

```json
{
  "deleteOptions": {
    "tweets": true,      // 是否删除推文
    "retweets": true,    // 是否取消转推
    "replies": true,     // 是否删除回复
    "likes": false,      // 是否取消点赞
    "bookmarks": false,  // 是否删除书签 ⭐ 新功能
    "following": false   // 是否取消关注 ⭐ 新功能
  },
  "executionConfig": {
    "maxDeletePerSession": 100,  // 单次运行最大删除数量
    "deletePerBatch": 6,         // 每批删除数量
    "delayBetweenActions": 1500, // 操作间延迟（毫秒）
    "delayJitterMs": 500,        // 操作延迟随机抖动（毫秒，可选）
    "delayBetweenBatches": 2500, // 批次间延迟（毫秒）
    "pageRefreshDelay": 4000,    // 页面刷新后等待时间（毫秒）
    "refreshBatchInterval": 2    // 每 N 个批次刷新一次页面（可选）
  },
  "retryConfig": {
    "maxRetries": 3,             // 最大重试次数
    "retryDelay": 5000,          // 重试延迟（毫秒）
    "exponentialBackoff": true   // 是否使用指数退避
  },
  "followingPlan": {
    "mode": "export"             // followings 默认子命令：export/classify/dry-run/execute
  },
  "followingManagement": {
    "enabled": false,
    "outputDir": "data/followings",
    "rules": {
      "keepHandles": [],
      "dropHandles": [],
      "keepKeywords": ["ai", "developer", "科技"],
      "dropKeywords": ["airdrop", "casino", "空投"],
      "lowInfoCandidate": true
    },
    "execution": {
      "minDelayMs": 6000,
      "maxDelayMs": 14000,
      "maxUnfollowPerSession": 50,
      "requireConfirmFile": true,
      "maxConsecutiveFailures": 3,
      "cooldownEveryActions": 20,
      "cooldownMs": 300000
    },
    "safety": {
      "requireHeadfulForExecute": true,
      "stopOnRiskSignals": true,
      "riskTextPatterns": ["unusual activity", "account locked", "请验证", "访问受限"]
    }
  }
}
```

## 📖 使用说明

### 登录方式

工具支持两种登录方式：

#### 方式 1：自动登录（推荐）

在 `.env` 文件中设置账号密码：

```env
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password
```

程序会自动登录并保存登录状态。

#### 方式 2：手动登录

如果未设置账号密码，或自动登录失败，程序会打开浏览器等待你手动登录。登录完成后，程序会自动检测并继续执行。

### 登录状态保存

首次登录成功后，登录状态会保存在 `browser-data/state.json`。下次运行时会自动使用保存的登录状态，无需重复登录。

如需重新登录，删除该文件即可：

```bash
# Windows
del browser-data\state.json

# macOS/Linux
rm browser-data/state.json
```

### 清理流程：推文、点赞、书签等内容

1. 程序启动后会显示配置信息
2. 倒计时 10 秒后开始执行（可按 Ctrl+C 取消）
3. 按配置依次执行清理操作：
   - 删除推文（如启用）
   - 删除回复（如启用）
   - 取消转推（如启用）
   - 取消点赞（如启用）
   - 删除书签（如启用）⭐ 新增
   - 取消关注（如启用）⭐ 新增
4. 实时显示清理进度
5. 完成后显示详细统计信息

### 关注管理流程（推荐）

关注清理建议不要直接打开 `deleteOptions.following` 一键执行，而是使用四步复核流程：

> `deleteOptions.following=true` 的旧式直接取关路径默认会被拦截；如确需兼容旧流程，需要显式设置 `ALLOW_LEGACY_FOLLOWING_DELETE=true`。

```bash
# 1. 只读导出关注列表
npm run start -- followings export

# 2. 按 config.json 的 followingManagement.rules 生成候选/保留/复核文件
npm run start -- followings classify --input data/followings/<runId>/followings.jsonl

# 3. 人工从 candidates.jsonl 复制确认要取关的账号到 approved-unfollow.jsonl 后预览
npm run start -- followings dry-run --input data/followings/<runId>/approved-unfollow.jsonl

# 4. 慢速顺序执行最终确认名单
npm run start -- followings execute --confirm-file data/followings/<runId>/approved-unfollow.jsonl
```

中断或达到 `maxUnfollowPerSession` 后，可继续：

```bash
npm run start -- followings resume --run-id <runId>
```

详细文件格式和配置说明见 [docs/FOLLOWING_MANAGEMENT.md](docs/FOLLOWING_MANAGEMENT.md)。

### 安全建议

- ⚠️ **谨慎操作**：删除的内容无法恢复
- 🔒 **保护账号**：不要在公共环境使用
- 🕒 **控制频率**：避免短时间内大量操作
- 💾 **备份数据**：重要内容请提前备份
- 🖥️ **稳定画像**：同一账号固定 `USER_DATA_DIR`、UA、视口、语言、时区，不要频繁随机切换
- 🧯 **风险熔断**：关注取关默认有头执行，命中验证码/限制/账号异常文案或连续失败会停止

## 🛠️ 开发指南

### 项目结构

```
x-account-cleaner/
├── src/
│   ├── config/
│   │   └── config.ts          # 配置管理
│   ├── core/
│   │   ├── browser.ts         # 浏览器初始化和管理
│   │   ├── login.ts           # 登录逻辑
│   │   └── deleter.ts         # 删除核心逻辑
│   ├── utils/
│   │   ├── selector.ts        # 元素选择器工具
│   │   ├── logger.ts          # 日志工具
│   │   └── retry.ts           # 重试机制
│   ├── types/
│   │   └── index.ts           # TypeScript 类型定义
│   └── index.ts               # 主入口
├── config.json                # 用户配置文件
├── env.example                # 环境变量示例
├── package.json
├── tsconfig.json
└── README.md
```

### 启动脚本

**一键启动脚本（推荐）：**

| 平台 | 安装依赖 | 生产模式 | 开发模式（热加载） |
|------|---------|---------|------------------|
| Windows | `install.bat` | `start.bat` | `开发模式启动.bat` |
| Linux/Mac | `install.sh` | `start.sh` | `开发模式启动.sh` |

**NPM 命令：**

```bash
# 运行
npm run build         # 编译 TypeScript 到 dist/
npm run start:prod    # 生产模式运行
npm start             # 快速运行（非生产）
npm run dev           # 开发模式运行（热加载，代码修改自动重启）

# 代码质量
npm run lint          # 检查代码
npm run lint:fix      # 修复代码问题
npm run format        # 格式化代码
npm run format:check  # 检查格式

# 清理
npm run clean         # 清理编译输出
```

> 📖 **详细启动说明**：请查看 [启动指南.md](启动指南.md)

### 自定义选择器（应对页面结构更新）⭐ 新功能

**🎯 重要：** Twitter 经常更新页面结构，导致选择器失效。现在我们提供了**独立的选择器配置系统**！

#### 方式 1：使用独立配置文件（推荐）

我们提供了 `selectors.json` 文件，当功能失效时只需更新此文件：

```json
{
  "selectors": {
    "tweetMoreButton": {
      "primary": "[aria-label*='更多'][role='button']",  // 主选择器
      "fallback": "[data-testid='caret']",              // 备用选择器
      "description": "推文的'更多'按钮"
    }
  }
}
```

**优点：**
- ✅ 支持主选择器和备用选择器
- ✅ 详细的注释和说明
- ✅ 无需修改代码
- ✅ 包含更新指南

**快速修复步骤：**
1. 按 F12 打开浏览器开发者工具
2. 定位失效的按钮，查看 `data-testid` 或 `aria-label` 属性
3. 更新 `selectors.json` 中对应的选择器
4. 重新运行程序

📖 **详细教程：** 查看 [选择器配置说明.md](选择器配置说明.md) 和 [选择器更新指南](docs/SELECTOR_UPDATE_GUIDE.md)

#### 方式 2：直接修改 config.json

如果不想使用独立配置文件，可以编辑 `config.json` 中的 `selectors` 部分：

```json
{
  "selectors": {
    "tweetMoreButton": "[aria-label*='更多'][role='button']",
    "deleteButton": "[role='menuitem'][data-testid*='delete']",
    "confirmDeleteButton": "[data-testid='confirmationSheetConfirm']",
    "tweet": "[data-testid='tweet']",
    "unretweet": "[data-testid='unretweet']",
    "unretweetConfirm": "[data-testid='unretweetConfirm']"
  }
}
```

**配置优先级：** `selectors.json` > `config.json`

### 调试技巧

1. **查看浏览器操作**：将 `HEADLESS` 设为 `false`
2. **查看详细日志**：将 `LOG_LEVEL` 设为 `debug`
3. **查看日志文件**：检查 `logs/` 目录
4. **调整延迟时间**：增加 `delayBetweenActions` 以观察操作

## ❓ 常见问题

### Q: 程序运行但没有删除任何内容？

**A**: 可能的原因：
- 选择器已过期（Twitter 更新了页面结构）
- 页面加载时间不足（增加 `pageRefreshDelay`）
- 没有找到对应的内容类型
- 查看日志文件获取详细错误信息

### Q: 登录失败怎么办？

**A**: 尝试以下方法：
- 使用手动登录方式
- 检查账号密码是否正确
- 查看是否需要额外验证（手机号/邮箱验证码）
- 删除 `browser-data/state.json` 后重试

### Q: 如何避免被 Twitter 检测？

**A**: 建议：
- 降低删除速度（增加延迟时间）
- 减少单次删除数量
- 分多次运行，间隔时间长一些
- 不要在短时间内频繁操作

### Q: 删除速度太慢？

**A**: 可以调整配置：
- 减少 `delayBetweenActions`
- 增加 `deletePerBatch`
- 减少 `pageRefreshDelay`

**注意**：速度过快可能触发 Twitter 限制！

### Q: 程序中途出错怎么办？

**A**:
- 查看日志文件确定错误原因
- 重新运行程序会从当前状态继续
- 如果反复出错，尝试减少删除速度

### Q: 如何只删除特定时间段的内容？

**A**: 当前版本不支持此功能，这是未来的改进方向。

### Q: 新增的书签和关注管理功能如何使用？

**A**: 在 `config.json` 中启用对应选项：
```json
{
  "deleteOptions": {
    "bookmarks": true,   // 启用删除书签
    "following": false   // 主账号建议保持 false，改用 followings 子命令复核后取关
  }
}
```
⚠️ 关注清理推荐先运行 `followings export` 和 `followings classify`。`approved-unfollow.jsonl` 默认是空文件，需要人工从 `candidates.jsonl` 复制确认账号后再执行；程序会拒绝直接执行 `candidates.jsonl` / `followings.jsonl` / `keep-list.jsonl`。

### Q: 取消关注会影响什么？

**A**:
- 会取消关注你关注列表中的用户
- 操作不可逆，需要手动重新关注
- 建议谨慎使用，先导出关注列表备份

## 🔮 未来改进方向

### 短期改进

- [x] **取消点赞**：批量取消所有点赞 ✅ 已完成
- [x] **删除书签**：批量删除所有书签 ✅ 已完成
- [x] **关注管理**：导出、筛选、复核、确认名单取关 ✅ 已完成
- [ ] **移除粉丝**：批量移除粉丝
- [ ] **清理私信**：批量删除私信对话
- [ ] **日期过滤**：支持按时间范围删除内容
- [ ] **关键词过滤**：根据内容关键词选择性删除
- [ ] **互动筛选**：保留高互动内容（点赞数、转发数）
- [x] **关注导出备份**：取关前导出关注列表 JSONL/CSV ✅ 已完成
- [x] **关注模拟预览**：确认名单 dry-run 预览 ✅ 已完成

### 中期改进

- [ ] **多账号支持**：管理多个 Twitter 账号
- [ ] **定时任务**：设置定时自动清理
- [ ] **Web 界面**：提供图形化配置界面
- [ ] **增量删除**：记录已删除内容，避免重复操作
- [ ] **更智能的选择器**：自动适配页面结构变化

### 长期改进

- [ ] **Docker 部署**：容器化部署，简化环境配置
- [ ] **云端调度**：部署到云服务器定期执行
- [ ] **API 集成**：使用 Twitter API（需要开发者账号）
- [ ] **机器学习**：智能识别重要内容
- [ ] **反检测增强**：更好地模拟人类行为
- [ ] **浏览器扩展**：开发 Chrome/Firefox 扩展

### 技术优化

- [ ] **并发处理**：支持多标签页同时删除
- [ ] **错误恢复**：断点续传功能
- [ ] **性能优化**：减少内存占用
- [ ] **测试覆盖**：添加单元测试和集成测试
- [ ] **CI/CD**：自动化构建和发布

## 📝 更新日志

### v1.1.0 (2025-10-04)

- ✨ **新增功能**：删除书签
- ✨ **新增功能**：取消关注用户
- ✨ **完善功能**：完整实现取消点赞功能
- 🔧 扩展类型系统和选择器工具
- 📊 更新统计信息显示
- 📖 新增《功能升级说明.md》文档

### v1.0.0 (2024-01-XX)

- ✨ 初始版本发布
- 🤖 支持自动删除推文、回复、转推
- 🔐 支持自动登录和手动登录
- ⚙️ 完整的配置化管理
- 📊 详细的日志和统计

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⚖️ 免责声明

本工具仅供学习和研究使用。使用本工具造成的任何后果由使用者自行承担。请遵守 Twitter 的服务条款和使用政策。

## 📄 许可证

MIT License

---

**注意**：本工具会永久删除你的 Twitter 内容，请谨慎使用！建议先小批量测试，确认无误后再大规模使用。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tytsxai/x-account-cleaner&type=Date)](https://www.star-history.com/#tytsxai/x-account-cleaner&Date)
