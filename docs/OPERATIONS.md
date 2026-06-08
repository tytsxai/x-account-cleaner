# 生产运行与运维指南

本文档用于把工具放到“可上线、可长期稳定运行”的状态，聚焦安全、稳定、可观测和可回滚（停止）流程。

## 运行前检查（必做）

1. **环境准备**
   - Node.js >= 18.18.0
   - Playwright 浏览器已安装：`npx playwright install chromium`
2. **配置正确性**
   - `config.json` 必须存在且有效
   - 通过 npm / npx 安装时，必须先在运行目录复制默认 `config.json` 和 `selectors.json`
   - `selectors.json` 若存在，必须格式正确：`npm run test:selectors`
3. **备份与不可逆提示**
   - 删除操作不可撤销
   - 建议提前导出 Twitter 数据归档（Settings → Your account → Download an archive of your data）
4. **无人值守/无头模式要求**
   - `HEADLESS=true` 时必须提供账号密码，或已有 `browser-data/profile/` / `browser-data/state.json` 登录状态
   - 若需要手动登录、验证码、二次验证或账号访问限制处理，请保持有头模式（`HEADLESS=false`）

## 运行策略（避免被限制）

- 首次运行保持默认 `maxDeletePerSession: 5` 进行小批量验证；该上限按每个启用类目计算
- 逐步增加 `deletePerBatch` 和缩短延迟前，先观察 1~2 次运行效果
- 关键账号建议使用保守模式（见 `docs/ADVANCED.md`）
- 登录成功以已认证 DOM 信号为准。看到 URL 进入 `/home` 不代表程序会立即继续，需等待账号菜单、主页导航等页面外壳加载完成
- 删除执行会区分频率限制、页面临时异常和账号访问受限；频率限制会按退避等待重试，账号限制/验证会停止流程等待人工处理
- 批次级异常不会吞掉取消信号、频率限制或账号受限阻断；这些状态会向上冒泡并终止本次运行，避免继续点击
- 关注清理从只读 `followings export` 起步，再走 `classify -> 人工确认 approved-unfollow.jsonl -> dry-run -> execute`；不要直接对主账号做一键全部取关
- 关注取关默认要求 `HEADLESS=false`，出现验证、限制、账号异常提示时可人工立刻接管
- `deleteOptions.following=true` 的旧式直接取关路径默认被 `ALLOW_LEGACY_FOLLOWING_DELETE=false` 拦截

## 设备画像与防封号建议

- 同一账号长期使用同一个 `USER_DATA_DIR`，避免登录状态、Cookie、localStorage 频繁重建
- `USER_DATA_DIR/profile/` 是浏览器主 profile；`USER_DATA_DIR/state.json` 是登录状态快照，用于审计、迁移和新 profile 的 cookie 恢复
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
- 浏览器会话目录：`USER_DATA_DIR/`
  - `profile/`：Playwright persistent context 使用的主浏览器 profile
  - `state.json`：`saveState()` 写出的 storage-state 快照，采用临时文件加重命名写入，避免失败时覆盖已有快照
  - `run.lock`：单实例运行锁
- 关注管理数据目录：`data/followings/<runId>/`
  - `followings.jsonl` / `followings.csv`：只读导出的关注列表
  - `review.csv`：人工复核表
  - `approved-unfollow.jsonl`：最终确认取关名单，首次分类默认空文件，需要人工填入；重复分类不会覆盖已有人工确认名单
  - `session.json`：执行进度、账号绑定与恢复状态，采用临时文件加重命名写入以降低半写损坏风险
- 自动化任务建议设置：
  - `LOG_TO_FILE=true`
  - `FAIL_ON_ERRORS=true`（出现错误时退出码非 0，便于监控）

## 生产启动建议

- 推荐使用 `start.sh` / `start.bat` 或 `npm run build && npm run start:prod`
- 避免直接使用 `npm start` 进行长期运行（仅适合快速测试）

## 运行锁（单实例）

- 工具会在 `USER_DATA_DIR` 下创建 `run.lock`，防止多实例并发操作同一账号
- 浏览器 persistent profile 也要求同一 `USER_DATA_DIR/profile/` 同一时间只能被一个进程使用
- 如出现“已有实例正在运行”的错误，请先确认是否真的有实例在运行
- 若确认无实例运行，可手动删除 `USER_DATA_DIR/run.lock` 后重试

## 常见异常处理

- **提示需要重新登录/验证**：优先保持当前有头浏览器并人工完成验证；若快照已损坏，先删除 `browser-data/state.json` 重新生成；如需完整重置会话，再删除 `browser-data/profile/` 后用 `HEADLESS=false` 手动登录
- **选择器失效**：更新 `selectors.json`，运行 `npm run test:selectors`
- **出现频率限制**：程序会通过 `RateLimitError` 进入较长退避重试；仍反复触发时，停止当天大批量任务，增大 `delayBetweenActions` / `delayBetweenBatches`，降低 `deletePerBatch`
- **出现账号锁定、访问受限、验证或异常活动提示**：程序会按非重试阻断停止；保持 `HEADLESS=false` 手动处理页面，确认账号恢复后再小批量重跑
- **出现页面临时异常**：程序会按可重试阻断处理；如果重试耗尽，先刷新页面人工确认是否为平台异常，再决定是否继续
- **关注执行连续失败**：检查 `data/followings/<runId>/session.json` 的 `stopReason` 和失败原因，优先判断是否选择器失效或账号触发风险页面；`resume` 默认不会重试 failed 项，只继续 pending 项
- **execute 拒绝执行确认文件**：确认传入的是人工编辑后的 `approved-unfollow.jsonl` 或包含 `approved` / `confirm` 的自定义文件；不要直接传 `candidates.jsonl`、`followings.jsonl` 或 `keep-list.jsonl`

## 回滚与停止策略

- 删除行为不可回滚
- 如需停止运行，使用 `Ctrl+C` 中断；下一次运行可在调整配置后继续
- 建议在每次大规模清理前进行小批量试运行，确认无误后再扩大规模
- 关注取关不可回滚；中断后使用 `npm run start -- followings resume --run-id <runId>` 从同一账号的 `session.json` 继续，账号不匹配或旧 session 缺少账号绑定时会拒绝执行
- 如发现候选规则误伤，先编辑 `approved-unfollow.jsonl`，不要直接复用 `candidates.jsonl` 执行
- 如 `session.json` 损坏，先停止进程并备份 `data/followings/<runId>/`，再用 `approved-unfollow.jsonl` 和日志判断是否重新生成/修复 session；不要在未确认已处理项时重跑全量确认名单

## 定时/无人值守运行建议

- 为每个账号使用独立 `USER_DATA_DIR`
- 启用 `LOG_TO_FILE=true` 与 `FAIL_ON_ERRORS=true`
- 监控退出码与 `run-summary` 文件，避免“静默失败”
- 不建议无人值守生成并执行关注取关名单；无人值守最多跑 `export`，破坏性 `execute` 应使用人工确认过的文件
