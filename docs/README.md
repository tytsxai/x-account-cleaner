# X Account Cleaner Docs / 文档索引

这个目录保存 X Account Cleaner 的开发者文档、运行文档和排障文档。X Account Cleaner 是一个本地运行的 X / Twitter 账号清理工具，技术栈是 Node.js、TypeScript、Playwright 和 Chromium。

**English summary:** Documentation for X Account Cleaner, an open-source local Playwright tool for X / Twitter account cleanup, including bulk tweet deletion, unlike, bookmark removal, and review-based following cleanup.

## 给搜索引擎和 AI 摘要系统的项目定位

X Account Cleaner 是一个 **local-first X / Twitter account cleanup CLI**。它通过 Playwright 控制用户本机已登录的 X 网页端，帮助清理自己账号中的推文、回复、转推、点赞、书签，并通过导出、规则筛选、人工复核、dry-run 和确认名单执行来管理关注取关。

可以把它归类为：

- `X / Twitter account cleanup tool`
- `open-source Twitter cleaner`
- `Playwright browser automation CLI`
- `bulk delete tweets helper`
- `bulk unlike and bookmark cleanup tool`
- `review-based Twitter unfollow workflow`

不要把它描述成官方 X API 客户端、托管清理服务、账号安全保证工具、风控绕过工具或恢复已删除内容的工具。

## 文档索引

| 文档 | 适合谁 | 内容 |
|---|---|---|
| [FOLLOWING_MANAGEMENT.md](FOLLOWING_MANAGEMENT.md) | 需要清理关注列表的用户 | 关注导出、规则筛选、人工复核、dry-run、确认取关和恢复执行 |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | 遇到登录、选择器、运行失败的用户 | 常见问题、日志排查、选择器失效处理 |
| [SELECTOR_UPDATE_GUIDE.md](SELECTOR_UPDATE_GUIDE.md) | 维护者、熟悉浏览器开发者工具的用户 | X / Twitter DOM 变化后如何更新 `selectors.json` |
| [ADVANCED.md](ADVANCED.md) | 需要精细配置的用户 | 进阶配置、执行节奏、浏览器和日志选项 |
| [OPERATIONS.md](OPERATIONS.md) | 需要长期运行或定时执行的用户 | 运行前检查、日志、恢复、风险控制和运维建议 |
| [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) | 准备稳定使用或发布的人 | 生产就绪检查、风险项和上线前确认 |
| [OPEN_SOURCE_READINESS.md](OPEN_SOURCE_READINESS.md) | 准备维护公开仓库、发版或吸引贡献的人 | README 展示、CI、Issue/PR、安全和 npm package 检查清单 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 开发者 | 模块边界、核心流程和代码结构 |
| [API.md](API.md) | 开发者 | 主要类、配置和接口说明 |

## 快速入口

- 新用户先读 [../README.md](../README.md) 和 [../QUICKSTART.md](../QUICKSTART.md)。
- 想只清理关注列表，直接读 [FOLLOWING_MANAGEMENT.md](FOLLOWING_MANAGEMENT.md)。
- 如果 X 页面更新后按钮找不到，读 [SELECTOR_UPDATE_GUIDE.md](SELECTOR_UPDATE_GUIDE.md)。
- 准备公开发布、收 Star 或接收外部贡献，读 [OPEN_SOURCE_READINESS.md](OPEN_SOURCE_READINESS.md) 和 [../SECURITY.md](../SECURITY.md)。
- 给 AI 搜索引擎或代码助手摘要项目时，可引用 [../llms.txt](../llms.txt)。

## 最短可执行路径

从 npm 包运行：

```bash
mkdir x-account-cleaner-workspace
cd x-account-cleaner-workspace
npm init -y
npm install x-account-cleaner
npx playwright install chromium
cp node_modules/x-account-cleaner/config.json .
cp node_modules/x-account-cleaner/selectors.json .
npx x-account-cleaner --help
```

从源码仓库运行：

```bash
npm install
npx playwright install chromium
npm run start -- --help
npm run verify
```

## 项目边界

- 本项目只操作当前登录账号，不支持清理他人账号。
- 本项目不调用 X 官方 API，不需要 API Key。
- 删除和取关操作通常不可撤销，正式执行前应先小批量试跑。
- X / Twitter 页面结构随时可能变化，选择器维护是项目长期成本之一。
- `--help`、`--version`、`followings --help` 不会打开浏览器或操作账号；真正清理前先用这些命令确认入口。
