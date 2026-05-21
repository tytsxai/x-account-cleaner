# 生产就绪评估

更新时间：2026-05-21

## 当前结论

项目已经具备本地生产运行的基本条件：配置化执行、登录状态复用、运行锁、文件日志、运行摘要、选择器校验、关注清理四步流、错误退出码和恢复会话都已存在。

当前最需要守住的生产边界不是扩展新功能，而是避免不可逆动作被误触发、避免中断时状态损坏、避免选择器失效时继续批量点击。

## 已补强的上线关键项

- 关注清理确认链路：`classify` 只生成空的 `approved-unfollow.jsonl`，候选名单不会自动变成执行名单。
- 执行入口保护：`execute` 默认拒绝直接执行 `candidates.jsonl`、`followings.jsonl`、`keep-list.jsonl`，并拒绝空确认名单。
- 执行文件约束：`requireConfirmFile=true` 时，确认文件名必须包含 `approved` 或 `confirm`。
- 进度文件可靠性：`session.json` 改为临时文件加重命名写入，降低进程中断导致半截 JSON 的概率。
- 中断状态记录：关注执行收到取消时会把 session 标记为 `cancelled` 并写入 `stopReason`。
- 质量门槛：新增确认文件保护、空名单拒绝、分类空模板的本地测试。
- 运行环境：Node.js 基线提高到 `>=18.18.0`，与当前 ESLint / TypeScript 工具链保持一致。

## 上线前必须检查

```bash
npm install
npx playwright install chromium
npm run verify
```

破坏性运行前必须确认：

- `config.json` 只启用了本次要清理的类目。
- 首次生产运行使用小批量，例如 `maxDeletePerSession: 10`。
- `LOG_TO_FILE=true`，需要自动化监控时设置 `FAIL_ON_ERRORS=true`。
- 同一账号固定 `USER_DATA_DIR`，不要多实例或多机器同时操作。
- 关注取关必须经过 `export -> classify -> 人工编辑 approved-unfollow.jsonl -> dry-run -> execute`。

## 仍需人工确认

- X / Twitter DOM 会无预警变化，选择器通过本地格式校验不等于线上 DOM 一定可用。
- 删除、取消点赞、取关等动作不可回滚，真正大批量运行前应先完成小批量试跑。
- 账号风控策略不可完全由代码规避；出现验证码、访问限制、账号异常文案时应停止并人工处理。
