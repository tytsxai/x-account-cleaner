# 生产运行与运维指南

本文档用于把工具放到“可上线、可长期稳定运行”的状态，聚焦安全、稳定、可观测和可回滚（停止）流程。

## 运行前检查（必做）

1. **环境准备**
   - Node.js >= 16
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

## 日志与可观测性

- 运行日志目录：`logs/`
  - `logs/combined.log` / `logs/error.log`（需要 `LOG_TO_FILE=true`）
- 运行摘要：`logs/run-summary-<runId>.json`
  - 包含运行配置、环境、统计、错误等信息
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

## 回滚与停止策略

- 删除行为不可回滚
- 如需停止运行，使用 `Ctrl+C` 中断；下一次运行可在调整配置后继续
- 建议在每次大规模清理前进行小批量试运行，确认无误后再扩大规模

## 定时/无人值守运行建议

- 为每个账号使用独立 `USER_DATA_DIR`
- 启用 `LOG_TO_FILE=true` 与 `FAIL_ON_ERRORS=true`
- 监控退出码与 `run-summary` 文件，避免“静默失败”
