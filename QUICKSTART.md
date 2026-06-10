# 快速开始指南 / Quick Start

5 分钟快速上手 **X Account Cleaner**：一个本地运行的开源 X / Twitter 账号清理 CLI。它通过 Playwright 控制你自己的浏览器会话，适合批量清理推文、回复、转推、点赞、书签，以及按人工确认名单管理关注取关。

**Safe first step:** `--help`、`--version` 和 `followings --help` 只打印 CLI 信息，不会打开浏览器或操作账号。首次运行请先用这些命令确认入口，再做小批量有头试跑。

## 先选你的目标

| 目标 | 推荐入口 |
|---|---|
| 先确认 CLI 是否安装成功 | `npx x-account-cleaner --help` |
| 从源码仓库确认入口 | `npm run start -- --help` |
| 清理推文、回复、转推、点赞或书签 | 编辑 `config.json` 后运行 `npx x-account-cleaner` 或 `npm run start:prod` |
| 只复核和清理关注列表 | 从 `followings export` 开始，不要启用旧式 `deleteOptions.following` |

## 第一步：选择运行方式

如果你是从 npm 安装，先创建一个专用工作目录。CLI 会从当前目录读取 `config.json`、`selectors.json` 和可选 `.env`。

```bash
# 确保 Node.js 版本 >= 18.18.0
node --version

mkdir x-account-cleaner-workspace
cd x-account-cleaner-workspace
npm init -y
npm install x-account-cleaner
npx playwright install chromium

cp node_modules/x-account-cleaner/config.json .
cp node_modules/x-account-cleaner/selectors.json .
cp node_modules/x-account-cleaner/env.example .env

# 查看命令帮助，不会打开浏览器或执行清理
npx x-account-cleaner --help
```

如果你是直接克隆源码仓库：

```bash
# 确保 Node.js 版本 >= 18.18.0
node --version

# 安装依赖
npm install
npx playwright install chromium

# 查看命令帮助，不会打开浏览器或执行清理
npm run start -- --help
```

## 第二步：决定是否创建 .env 文件

`.env` 是可选文件。推荐第一次使用时保持手动登录：不填写账号密码，让程序打开浏览器后你自己登录。只有确实需要自动登录时，才复制 `env.example` 并填写凭据。

如果你使用 npm 包安装：

```bash
cp node_modules/x-account-cleaner/env.example .env
```

如果你从源码仓库运行：

```bash
# Windows
copy env.example .env

# macOS/Linux
cp env.example .env
```

## 第三步：按需编辑 .env 文件

如果选择自动登录，打开 `.env` 文件，填入你的 X / Twitter 账号信息：

```env
TWITTER_USERNAME=你的邮箱或用户名
TWITTER_PASSWORD=你的密码
HEADLESS=false
```

**提示**：如果不想保存密码，可以留空，程序会引导你手动登录。

## 第四步：配置删除选项

打开 `config.json`，设置要删除的内容类型：

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
    "maxDeletePerSession": 5,
    "deletePerBatch": 3
  }
}
```

含义：

- `tweets: true` 删除推文
- `retweets: true` 取消转推
- `replies: true` 删除回复
- `likes: false` 不取消点赞
- `bookmarks: false` 不删除书签
- `following: false` 不走旧式直接取关，关注清理从 `followings export` 开始
- `maxDeletePerSession: 5` 表示每个启用类目本次最多处理 5 项，不是所有类目合计 5 项

## 第五步：运行程序

如果使用 npm 包：

```bash
npx x-account-cleaner
```

如果使用源码仓库：

```bash
npm run build
npm run start:prod
```

程序会：
1. 打开浏览器
2. 自动登录或等待你手动登录
3. 显示配置信息
4. 倒计时 10 秒
5. 开始执行已启用的清理类目
6. 显示进度和统计，并写入 `logs/run-summary-*.json`

## 首次运行建议

- 保持默认 `maxDeletePerSession: 5` 测试。
- 第一次只启用 1-2 个内容类目，确认页面识别正确后再扩大范围。
- 保持 `HEADLESS=false`，观察浏览器操作是否正常。
- 确认无误后再增加删除数量。
- 如果只想管理关注列表，先运行 `npx x-account-cleaner followings export` 或 `npm run start -- followings export`，再阅读 [docs/FOLLOWING_MANAGEMENT.md](docs/FOLLOWING_MANAGEMENT.md)
- 遇到命令不确定时先运行 `npx x-account-cleaner --help` 或 `npm run start -- --help`

## 常见问题

**Q: 登录失败？**
- 检查账号密码是否正确
- 尝试手动登录（留空 TWITTER_USERNAME 和 TWITTER_PASSWORD）

**Q: 没有删除任何内容？**
- 检查是否有对应类型的内容
- 查看日志文件：`logs/combined.log`
- 增加延迟时间：`pageRefreshDelay: 8000`

**Q: 想停止删除？**
- 按 `Ctrl + C`

## 下一步

- 阅读 [README.md](README.md) 了解详细功能。
- 查看 [docs/README.md](docs/README.md) 选择后续文档。
- 查看 [故障排查指南](docs/TROUBLESHOOTING.md)。
- 探索 [高级用法](docs/ADVANCED.md)。
- 准备贡献或发版时运行 `npm run release:check`。

---

**警告**：删除的内容无法恢复，请谨慎操作！





















