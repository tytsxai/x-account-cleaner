# X Account Cleaner - X / Twitter Account Cleanup Tool

[![CI](https://github.com/tytsxai/x-account-cleaner/actions/workflows/ci.yml/badge.svg)](https://github.com/tytsxai/x-account-cleaner/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/tytsxai/x-account-cleaner)](https://github.com/tytsxai/x-account-cleaner/releases)
[![License: MIT](https://img.shields.io/github/license/tytsxai/x-account-cleaner)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.18.0-339933)](package.json)
[![Playwright](https://img.shields.io/badge/automation-Playwright-2EAD33)](https://playwright.dev/)
[![Local First](https://img.shields.io/badge/local--first-no%20server-blue)](#项目定位--what-it-is)

[Quick Start](QUICKSTART.md) · [Docs](docs/README.md) · [Security](SECURITY.md) · [llms.txt](llms.txt) · [Changelog](CHANGELOG.md) · [Issues](https://github.com/tytsxai/x-account-cleaner/issues)

**X Account Cleaner** 是一个本地运行的开源 X / Twitter 账号清理工具。它基于 **Node.js + TypeScript + Playwright + Chromium** 自动操作你自己的浏览器登录会话，用于批量删除推文和回复、取消转推、取消点赞、删除书签，并通过“导出关注列表 - 规则筛选 - 人工复核 - dry-run - 确认执行”的流程安全管理关注取关。

**English summary:** X Account Cleaner is an open-source, local-first Playwright automation tool for cleaning an X / Twitter account. It helps bulk delete tweets and replies, undo retweets, unlike tweets, remove bookmarks, and review/unfollow accounts through a confirmation-based workflow. It does not use the official X API and does not send your credentials to a third-party service.

**Repository:** <https://github.com/tytsxai/x-account-cleaner><br>
**旧名称 / Alias:** `twitter-auto-cleaner`

## 项目定位 / What It Is

| 项目 | 说明 |
|---|---|
| 项目类型 | 本地桌面自动化工具 / Local browser automation tool |
| 核心用途 | X / Twitter 账号内容清理、注销前清理、小号整理、关注列表复核 |
| 技术栈 | Node.js >= 18.18.0, TypeScript, Playwright, Chromium, Winston |
| 运行方式 | 本机运行，控制 Playwright Chromium 浏览器，不调用 X API |
| 适合人群 | 想清理自己 X / Twitter 账号内容的个人用户、开发者、自动化工具维护者 |
| 不适合 | 想恢复已删除内容、批量操作他人账号、绕过 X 风控或服务条款的人 |

常见搜索关键词包括：`X Account Cleaner`、`Twitter account cleanup tool`、`Twitter Auto Cleaner`、`X 账号清理工具`、`Twitter 批量删除推文`、`X 批量取消点赞`、`X 批量取消关注`、`Playwright Twitter cleaner`、`open-source Twitter cleaner`。

## 为什么值得收藏 / Why Star This

- **本地优先**：不需要 X API Key，不需要把账号交给第三方服务。
- **覆盖真实清理场景**：推文、回复、转推、点赞、书签和关注列表复核都在一个项目里。
- **关注取关有安全闭环**：导出、规则筛选、人工复核、dry-run、确认文件、慢速执行和 resume 分开处理。
- **选择器可维护**：X 页面变动时优先更新 [selectors.json](selectors.json)，不必直接改核心逻辑。
- **可验证工程面**：`npm run verify` 覆盖编译、lint、格式、CLI 帮助、选择器配置和关注管理核心测试；GitHub Actions 会在 PR 上执行同一套检查。

## 解决什么问题

很多用户在注销、转让、停用或重新整理 X / Twitter 账号前，需要批量清理历史内容。但 X 网页端没有提供完整的一键清理入口，官方 API 又有权限、费用和限制。本项目选择更直接的本地浏览器自动化路线：

- 使用你自己的登录会话打开 `x.com` / `twitter.com` 页面。
- 根据 `config.json` 决定要清理哪些内容类型。
- 通过选择器识别推文、回复、转推、点赞、书签和关注列表。
- 按批次、延迟、重试和运行上限执行，降低误操作和触发风控的概率。
- 关注取关默认走人工确认名单，避免把自动筛选结果直接执行。

## 核心功能 / Features

- 批量删除推文 / bulk delete tweets
- 批量删除回复 / bulk delete replies
- 取消转推 / undo retweets
- 取消点赞 / unlike liked tweets
- 删除书签 / remove bookmarks
- 关注管理 / following cleanup workflow
  - 导出关注列表为 JSONL / CSV
  - 按 handle、关键词和低信息账号规则生成候选名单
  - 人工把确认要取关的账号写入 `approved-unfollow.jsonl`
  - `dry-run` 预览后再慢速顺序执行
  - 中断后可通过 `resume` 继续
- 登录状态持久化到本地 `browser-data/state.json`
- 支持 `.env` 浏览器画像、日志级别和安全开关配置
- 支持 `selectors.json` 独立选择器配置，用于应对 X 前端 DOM 变动
- 每次运行写入 `logs/run-summary-*.json`，便于排障和审计

## 快速开始 / Quick Start

环境要求：

- Node.js >= 18.18.0
- npm
- Windows、macOS 或 Linux
- 一个可登录的 X / Twitter 账号

### Windows 一键运行

```bat
install.bat
start.bat
```

运行前建议先打开 `config.json`，把 `executionConfig.maxDeletePerSession` 调小到 `5` 或 `10` 做试跑。

### macOS / Linux 一键运行

```bash
chmod +x install.sh start.sh
./install.sh
./start.sh
```

### npm 命令运行

```bash
npm install
npx playwright install chromium

# 查看命令帮助，不会打开浏览器或执行清理
npm run start -- --help
npm run start -- followings --help

# 生产模式：先编译再运行
npm run build
npm run start:prod

# 开发模式：直接用 ts-node 运行
npm start
```

如果不想把账号密码写入 `.env`，保持 `TWITTER_USERNAME` / `TWITTER_PASSWORD` 为空即可。程序会打开浏览器，等待你手动登录；登录状态会保存在本机。

## 最小配置示例

主要配置文件是 [config.json](config.json)。首次运行建议只开少量目标，确认页面识别正确后再扩大范围。

```json
{
  "deleteOptions": {
    "tweets": true,
    "retweets": true,
    "replies": true,
    "likes": false,
    "bookmarks": false,
    "following": false
  },
  "executionConfig": {
    "maxDeletePerSession": 10,
    "deletePerBatch": 6,
    "delayBetweenActions": 1500,
    "delayJitterMs": 500,
    "delayBetweenBatches": 2500,
    "pageRefreshDelay": 4000,
    "refreshBatchInterval": 2
  }
}
```

可选环境变量文件：[env.example](env.example)。

```bash
cp env.example .env
```

常用环境变量：

```env
HEADLESS=false
BROWSER_TYPE=chromium
BROWSER_VIEWPORT_WIDTH=1512
BROWSER_VIEWPORT_HEIGHT=982
BROWSER_LOCALE=zh-CN
BROWSER_TIMEZONE_ID=Asia/Shanghai
LOG_LEVEL=info
LOG_TO_FILE=true
USER_DATA_DIR=./browser-data
ALLOW_LEGACY_FOLLOWING_DELETE=false
```

## 典型使用场景 / Use Cases

- 注销 X / Twitter 账号前清理历史推文、回复、点赞和书签。
- 整理长期不用的小号、测试号或运营账号。
- 账号转交前先删除不适合保留的个人内容。
- 批量导出关注列表，按规则找出疑似低质量、广告、空投、博彩类账号，再人工确认取关。
- 研究 Playwright 网页自动化、选择器维护、批量任务节流和本地运行日志设计。

## 关注清理推荐流程

不建议直接打开 `deleteOptions.following=true`。旧式直接取关路径默认会被 `ALLOW_LEGACY_FOLLOWING_DELETE=false` 拦截。推荐使用下面的确认名单流程：

```bash
# 1. 只读导出关注列表
npm run start -- followings export

# 2. 按 config.json 的 followingManagement.rules 生成候选、保留、复核文件
npm run start -- followings classify --input data/followings/<runId>/followings.jsonl

# 3. 人工从 candidates.jsonl 复制确认要取关的账号到 approved-unfollow.jsonl 后预览
npm run start -- followings dry-run --input data/followings/<runId>/approved-unfollow.jsonl

# 4. 慢速顺序执行最终确认名单
npm run start -- followings execute --confirm-file data/followings/<runId>/approved-unfollow.jsonl

# 5. 中断或达到 maxUnfollowPerSession 后继续
npm run start -- followings resume --run-id <runId>
```

详细说明见 [docs/FOLLOWING_MANAGEMENT.md](docs/FOLLOWING_MANAGEMENT.md)。

## 重要限制和风险 / Limitations

请先读完这一节再运行。

- 删除、取消点赞、取消转推、删除书签和取关都是账号上的真实操作，通常不可撤销。
- 本项目依赖 X / Twitter 网页 DOM 选择器，例如 `[data-testid="tweet"]`、`[data-testid="UserCell"]`。X 前端结构随时可能变化，选择器失效时需要更新 [selectors.json](selectors.json)。
- 本项目不保证规避风控。短时间大量操作、频繁切换 IP / UA / 时区 / 设备画像、无头模式硬跑，都可能触发验证或限制。
- 本项目不使用 X 官方 API，也不提供性能承诺、成功率承诺或账号安全承诺。
- 当前不支持按日期范围、关键词或互动数精确筛选推文后再删除。
- 当前不处理私信、列表、社群、粉丝移除和 X 付费功能。
- 使用者需要自行确认使用方式符合 X 服务条款和所在地法律法规。

## 选择器失效时怎么办

如果程序突然找不到按钮、计数不动、点击失败或页面流程卡住，通常是 X 页面结构变化导致选择器过期。

```bash
npm run test:selectors
```

处理路径：

1. 打开浏览器开发者工具，定位失效按钮或列表项。
2. 查看新的 `data-testid`、`aria-label`、`role` 或链接结构。
3. 更新 [selectors.json](selectors.json) 中对应选择器。
4. 重新运行 `npm run test:selectors`。
5. 先用小批量配置试跑。

参考文档：

- [选择器配置说明.md](选择器配置说明.md)
- [选择器快速参考.txt](选择器快速参考.txt)
- [docs/SELECTOR_UPDATE_GUIDE.md](docs/SELECTOR_UPDATE_GUIDE.md)

## 文档导航 / Documentation

- [QUICKSTART.md](QUICKSTART.md): 5 分钟快速开始。
- [START_HERE.md](START_HERE.md): 面向新用户的入口导航。
- [docs/README.md](docs/README.md): docs 目录索引，适合开发者和 AI 搜索引擎快速理解文档结构。
- [docs/FOLLOWING_MANAGEMENT.md](docs/FOLLOWING_MANAGEMENT.md): 关注导出、筛选、复核和取关工作流。
- [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md): 常见故障排查。
- [docs/ADVANCED.md](docs/ADVANCED.md): 高级配置。
- [docs/OPERATIONS.md](docs/OPERATIONS.md): 运行和运维建议。
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): 架构说明。
- [docs/API.md](docs/API.md): 代码接口说明。
- [docs/OPEN_SOURCE_READINESS.md](docs/OPEN_SOURCE_READINESS.md): 公开仓库展示、CI、Issue/PR、安全和发版检查清单。
- [llms.txt](llms.txt): 面向 AI 搜索、代码助手和摘要系统的项目说明。
- [SECURITY.md](SECURITY.md): 安全报告和本地账号数据保护说明。

## 开发与验证

```bash
# 编译
npm run build

# 代码检查
npm run lint
npm run format:check

# 选择器配置和关注管理脚本测试
npm run test:selectors
npm run test:following

# 一次性验证
npm run verify
```

项目结构：

```text
x-account-cleaner/
├── src/
│   ├── config/config.ts
│   ├── core/browser.ts
│   ├── core/login.ts
│   ├── core/deleter.ts
│   ├── core/following-management.ts
│   ├── utils/
│   └── types/index.ts
├── docs/
├── examples/
├── scripts/
├── config.json
├── selectors.json
├── env.example
├── README.md
└── llms.txt
```

## FAQ

### 需要 X API Key 或开发者账号吗？

不需要。本项目通过 Playwright 控制浏览器访问 X 网页端，不调用官方 API。

### 凭据会上传到服务器吗？

不会。项目设计为本机运行。自动登录凭据来自你的 `.env`，浏览器状态保存在本地 `USER_DATA_DIR`。仍然建议优先使用手动登录，避免明文保存密码。

### 可以只清理点赞或书签吗？

可以。只需要在 `config.json` 的 `deleteOptions` 中把目标类型设为 `true`，其他类型设为 `false`。

### 删除后可以恢复吗？

通常不能。运行前请备份重要内容，并先用 `maxDeletePerSession: 5` 或 `10` 小批量验证。

### 为什么有时没有删除任何内容？

常见原因是选择器过期、页面加载慢、登录状态失效、账号进入验证页，或对应内容类型本来为空。请查看 `logs/`、提高 `pageRefreshDelay`，并参考 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

### 能不能全自动大规模取关？

不建议。关注管理默认要求导出、筛选、人工确认和 dry-run，最终只执行确认名单。这样更慢，但更能避免误伤。

## GitHub Topics 建议

如果你维护这个仓库，可以在 GitHub repository topics 中加入：

`x` · `twitter` · `twitter-cleaner` · `x-account-cleaner` · `account-cleaner` · `bulk-delete-tweets` · `bulk-unlike` · `bulk-unfollow` · `playwright` · `typescript` · `automation` · `privacy-tool`

## 免责声明 / Disclaimer

本工具仅用于清理你自己有权操作的 X / Twitter 账号内容。使用本工具造成的内容丢失、账号限制、账号封禁或其他后果由使用者自行承担。请遵守 X / Twitter 服务条款和适用法律法规。

This project is provided for personal account cleanup and educational automation use. You are responsible for how you use it and for any account or data consequences.

## License

[MIT License](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=tytsxai/x-account-cleaner&type=Date)](https://www.star-history.com/#tytsxai/x-account-cleaner&Date)
