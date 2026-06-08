# 关注清理与账号管理工作流

本文档说明 `followings` 子命令的安全工作流。新用户入口必须从只读导出开始，推荐顺序是：导出关注列表 → 本地规则筛选 → 人工复核确认名单 → dry-run → 慢速顺序执行取关。

## 核心原则

- `export` 和 `classify` 都是只读流程，不会点击取关按钮。
- `classify` 首次生成的 `approved-unfollow.jsonl` 默认是空文件；如果该文件已存在，会保留人工编辑结果，不会覆盖。
- `execute` 拒绝直接读取 `candidates.jsonl`、`followings.jsonl`、`keep-list.jsonl`，避免把自动筛选结果绕过人工确认直接执行。
- `deleteOptions.following` 是旧式直接取关路径，默认被 `ALLOW_LEGACY_FOLLOWING_DELETE=false` 拦截，不作为入门入口。
- 每次执行都会写入带当前账号绑定的 `session.json`，中断后可以用 `resume` 继续；若当前登录账号与 session 账号不一致会拒绝执行。
- X 页面 DOM 会变化，正式执行前先用 `dry-run` 和小批量确认名单验证。
- 防封号重点是稳定画像和保守节奏，不建议频繁切换 UA、时区、视口、IP 或无头模式硬跑。

## 命令流程

```bash
# 1. 导出关注列表
npm run start -- followings export

# 2. 按本地规则生成候选/保留/复核文件
npm run start -- followings classify --input data/followings/<runId>/followings.jsonl

# 3. 人工从 candidates.jsonl 复制确认要取关的账号到 approved-unfollow.jsonl 后预览
npm run start -- followings dry-run --input data/followings/<runId>/approved-unfollow.jsonl

# 4. 执行取关
npm run start -- followings execute --confirm-file data/followings/<runId>/approved-unfollow.jsonl

# 5. 中断或达到上限后恢复
npm run start -- followings resume --run-id <runId>
```

也可以只运行 `npm run start -- followings`，工具会读取 `config.json` 里的 `followingPlan.mode`。

## 输出文件

所有文件默认写入 `data/followings/<runId>/`。

| 文件 | 作用 |
|---|---|
| `followings.jsonl` | 原始关注列表快照，每行一个账号 |
| `followings.csv` | 适合表格工具查看的原始快照 |
| `candidates.jsonl` | 规则命中的候选取关账号 |
| `keep-list.jsonl` | 规则判断应保留的账号 |
| `review.csv` | 人工复核表，包含命中原因 |
| `approved-unfollow.jsonl` | 最终确认取关名单，默认空文件，需要人工填入 |
| `session.json` | 执行进度、成功/失败/跳过状态和恢复信息 |

`followings.jsonl` 的主要字段：

```json
{
  "handle": "@example",
  "displayName": "Example",
  "bio": "profile text",
  "isVerified": false,
  "followsYou": false,
  "avatarUrl": "https://...",
  "profileUrl": "https://x.com/example",
  "collectedAt": "2026-05-21T00:00:00.000Z"
}
```

## 配置

`followingPlan` 控制默认模式，显式 CLI 子命令优先级更高。

```json
{
  "followingPlan": {
    "mode": "export",
    "input": "data/followings/<runId>/followings.jsonl",
    "confirmFile": "data/followings/<runId>/approved-unfollow.jsonl",
    "runId": "<runId>"
  }
}
```

`followingManagement.rules` 控制候选名单生成。白名单优先级高于黑名单和关键词命中。

```json
{
  "followingManagement": {
    "enabled": false,
    "outputDir": "data/followings",
    "rules": {
      "keepHandles": ["openai"],
      "dropHandles": ["spam_account"],
      "keepKeywords": ["ai", "developer", "科技"],
      "dropKeywords": ["airdrop", "casino", "空投"],
      "lowInfoCandidate": true
    },
    "execution": {
      "minDelayMs": 6000,
      "maxDelayMs": 14000,
      "maxUnfollowPerSession": 10,
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

## 执行安全边界

- `execute` 必须传 `--confirm-file` 或在 `followingPlan.confirmFile` 里明确配置。
- `execute` 默认要求确认文件名包含 `approved` 或 `confirm`，并拒绝自动生成的候选/导出/保留名单文件。
- 空确认名单会被拒绝执行；这用于防止刚分类完成后误把空模板当成已确认任务。
- 默认 `execute` 要求 `HEADLESS=false`，方便人工随时观察验证码、限制页、登录异常。
- 执行前会按 handle 在页面用户卡片中重新匹配，匹配不到或匹配不一致会跳过并写入失败原因。
- 达到 `maxUnfollowPerSession` 后停止，默认上限为 10，保留 `pending` 项供下次 `resume` 继续。
- 连续失败达到 `maxConsecutiveFailures` 后停止，避免选择器失效时继续点击。
- 每执行 `cooldownEveryActions` 个成功取关动作后会冷却 `cooldownMs`，默认 20 个动作冷却 5 分钟。
- 命中 `riskTextPatterns` 或跳到登录/账号访问限制页面时会停止并写入 `session.stopReason`。
- 失败项会保留在 `session.json` 中供人工复核，`resume` 默认只继续 `pending` 项，不会反复重试已失败项。
- 旧版 `session.json` 如果没有 `username` 字段，会被拒绝恢复；请重新走 `export -> classify -> execute` 生成带账号绑定的新 session。
- `session.json` 使用临时文件加重命名写入，进程中断时尽量避免写出半截 JSON；如果文件仍然损坏，应先根据日志和 `approved-unfollow.jsonl` 备份一份后再人工修复。

## 设备画像与账号安全

浏览器画像通过 `.env` 控制，默认使用 14 英寸 MacBook Pro 全屏浏览器基准：

```env
HEADLESS=false
BROWSER_TYPE=chromium
BROWSER_VIEWPORT_WIDTH=1512
BROWSER_VIEWPORT_HEIGHT=982
BROWSER_DEVICE_SCALE_FACTOR=2
BROWSER_LOCALE=zh-CN
BROWSER_TIMEZONE_ID=Asia/Shanghai
BROWSER_USER_AGENT=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36
```

建议：
- 同一账号固定 `USER_DATA_DIR`，不要多个工具同时操作同一账号。
- 同一账号长期保持同一套 UA、视口、时区、语言和 `USER_DATA_DIR/profile/` 持久浏览器 profile。
- 大规模取关拆成多天执行，优先使用 `maxUnfollowPerSession`、冷却和人工复核。
- 出现验证码、异常活动、账号访问受限时立即停止，人工处理后隔一段时间再恢复。
