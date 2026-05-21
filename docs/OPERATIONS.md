# 生产运行与运维指南

本文档用于把工具放到“可上线、可长期稳定运行”的状态，聚焦安全、稳定、可观测和可回滚（停止）流程。

## 运行前检查（必做）

1. **环境准备**
   - Node.js >= 18.18.0
   - Playwright 浏览器已安装：`npx playwright install chromium`
2. **配置正确性**
   - `config.json` 必须存在且有效
   - `selectors.json` 若存在，必须格式正确：`npm run test:selectors`
3. **备份与不可逆提示**
   - 删除操作不可撤销
   - 建议提前导出 Twitter 数据归档（Settings → Your account → Download an archive of your data）
4. **无人值守/无头模式要求**
   - `HEADLESS=true` 时必须提供账号密码或已保存登录状态 (`browser-data/state.json`)
   - 若需要手动登录，请保持有头模式（`HEADLESS=false`）

## 运行策略（避免被限制）

- 首次运行建议 `maxDeletePerSession: 10` 进行小批量验证
- 逐步增加 `deletePerBatch` 和缩短延迟前，先观察 1~2 次运行效果
- 关键账号建议使用保守模式（见 `docs/ADVANCED.md`）
- 关注清理建议使用 `followings export -> classify -> dry-run -> execute`，不要直接对主账号做一键全部取关
- 关注取关默认要求 `HEADLESS=false`，出现验证、限制、账号异常提示时可人工立刻接管
- `deleteOptions.following=true` 的旧式直接取关路径默认被 `ALLOW_LEGACY_FOLLOWING_DELETE=false` 拦截

## 设备画像与防封号建议

- 同一账号长期使用同一个 `USER_DATA_DIR`，避免登录状态、Cookie、localStorage 频繁重建
- 同一账号保持稳定浏览器画像：`BROWSER_USER_AGENT`、`BROWSER_VIEWPORT_WIDTH/HEIGHT`、`BROWSER_DEVICE_SCALE_FACTOR`、`BROWSER_LOCALE`、`BROWSER_TIMEZONE_ID`
- 默认视口为 `1512 x 982` CSS px，贴近 14 英寸 MacBook Pro 全屏浏览器基准
- 不要为了“规避检测”频繁随机切换设备指纹；稳定一致比每次随机更安全
- 不要多实例、多机器、多个 IP 同时操作同一账号
- 大批量动作分天执行，保留 `cooldownEveryActions` / `cooldownMs` 冷却，不要高并发

## 日志与可观测性

- 运行日志目录：`logs/`
  - `logs/combined.log` / `logs/error.log`（需要 `LOG_TO_FILE=true`）
- 运行摘要：`logs/run-summary-<runId>.json`
  - 包含运行配置、环境、统计、错误等信息
- 关注管理数据目录：`data/followings/<runId>/`
  - `followings.jsonl` / `followings.csv`：只读导出的关注列表
  - `review.csv`：人工复核表
  - `approved-unfollow.jsonl`：最终确认取关名单，默认空文件，需要人工填入
  - `session.json`：执行进度与恢复状态，采用临时文件加重命名写入以降低半写损坏风险
- 自动化任务建议设置：
  - `LOG_TO_FILE=true`
  - `FAIL_ON_ERRORS=true`（出现错误时退出码非 0，便于监控）

## 生产启动建议

- 推荐使用 `start.sh` / `start.bat` 或 `npm run build && npm run start:prod`
- 避免直接使用 `npm start` 进行长期运行（仅适合快速测试）

## 运行锁（单实例）

- 工具会在 `USER_DATA_DIR` 下创建 `run.lock`，防止多实例并发操作同一账号
- 如出现“已有实例正在运行”的错误，请先确认是否真的有实例在运行
- 若确认无实例运行，可手动删除 `USER_DATA_DIR/run.lock` 后重试

## 常见异常处理

- **提示需要重新登录/验证**：删除 `browser-data/state.json`，重新运行并手动登录
- **选择器失效**：更新 `selectors.json`，运行 `npm run test:selectors`
- **出现限制或访问异常**：降低速度、延长间隔，等待一段时间后再试
- **关注执行连续失败**：检查 `data/followings/<runId>/session.json` 的 `stopReason` 和失败原因，优先判断是否选择器失效或账号触发风险页面
- **execute 拒绝执行确认文件**：确认传入的是人工编辑后的 `approved-unfollow.jsonl` 或包含 `approved` / `confirm` 的自定义文件；不要直接传 `candidates.jsonl`、`followings.jsonl` 或 `keep-list.jsonl`

## 回滚与停止策略

- 删除行为不可回滚
- 如需停止运行，使用 `Ctrl+C` 中断；下一次运行可在调整配置后继续
- 建议在每次大规模清理前进行小批量试运行，确认无误后再扩大规模
- 关注取关不可回滚；中断后使用 `npm run start -- followings resume --run-id <runId>` 从 `session.json` 继续
- 如发现候选规则误伤，先编辑 `approved-unfollow.jsonl`，不要直接复用 `candidates.jsonl` 执行
- 如 `session.json` 损坏，先停止进程并备份 `data/followings/<runId>/`，再用 `approved-unfollow.jsonl` 和日志判断是否重新生成/修复 session；不要在未确认已处理项时重跑全量确认名单

## 定时/无人值守运行建议

- 为每个账号使用独立 `USER_DATA_DIR`
- 启用 `LOG_TO_FILE=true` 与 `FAIL_ON_ERRORS=true`
- 监控退出码与 `run-summary` 文件，避免“静默失败”
- 不建议无人值守生成并执行关注取关名单；无人值守最多跑 `export`，破坏性 `execute` 应使用人工确认过的文件
