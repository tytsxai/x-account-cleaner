# 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 计划添加

- 按日期范围过滤删除。
- 按关键词过滤删除。
- 删除前导出备份。
- Web 管理界面。
- 多账号支持。

## [1.0.0] - 待发布

`1.0.0` 是下一次公开 npm / CLI 发版目标，也是项目从源码工具走向可安装包的第一个稳定版本。发布前必须确认 `package.json`、README、Quickstart、发版检查清单和 npm tarball 内容一致。

### 新增

- npm CLI 包入口：`bin.x-account-cleaner -> dist/index.js`，支持 `x-account-cleaner`、`npx x-account-cleaner`、`--help`、`--version` 和 `followings` 子命令。
- 发布检查脚本：`npm run release:check` 会执行 `npm run verify` 和 `npm pack --dry-run`。
- 关注清理确认流程：导出、规则筛选、人工确认、dry-run、执行和 resume 分离。
- 每次运行生成 `logs/run-summary-*.json`，记录版本、运行环境、配置摘要、选择器来源、状态和错误信息。
- 独立选择器配置 `selectors.json`，用于 X / Twitter DOM 变化后的快速维护。

### 变更

- 默认首次运行策略改为保守小批量：每个启用类目单次最多处理 `5` 项，批次大小为 `3`。
- 旧式 `deleteOptions.following=true` 直接取关路径默认被 `ALLOW_LEGACY_FOLLOWING_DELETE=false` 拦截，关注清理推荐从 `followings export` 开始。
- README 和 QUICKSTART 明确区分 npm / npx 安装运行、全局安装和源码仓库运行。
- npm 包内容显式包含 `LICENSE`、默认配置、选择器、文档和脚本。

### 安全

- destructive 操作继续要求用户本机登录会话执行，不上传账号凭据。
- `--help`、`--version`、`followings --help` 不会打开浏览器或触碰账号。
- 关注执行默认要求有头模式和明确确认文件。

## [0.1.0] - 2026-05-19

首个 tag 化源码版本，用于记录项目在 npm 包化前的基础清理能力。

### 包含

- 六种清理任务：删除推文、删除回复、取消转推、取消点赞、删除书签、取消关注。
- 自动登录和手动登录，会话持久化到本地 Playwright 用户数据目录。
- `config.json` 驱动的任务开关、批次大小和节流间隔。
- 指数退避重试、文件日志和实时进度。
- Windows `install.bat` / `start.bat` 与 macOS / Linux `install.sh` / `start.sh`。
- 双语文档、搜索关键词块和 `llms.txt`。

### 安全提醒

- 删除、取消点赞、取消转推、删除书签和取关通常不可恢复。
- 工具以用户自己的登录身份运行，但批量操作可能受 X / Twitter 政策和风控限制。
- 不处理 DMs、列表、社群、粉丝移除和付费功能。

## 版本说明

- **新增**：新功能。
- **变更**：现有功能的变更。
- **弃用**：即将移除的功能。
- **移除**：已移除的功能。
- **修复**：Bug 修复。
- **安全**：安全相关的修复。
