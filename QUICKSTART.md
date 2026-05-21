# 快速开始指南 / Quick Start

5 分钟快速上手 **X Account Cleaner**，一个本地运行的 X / Twitter 账号清理工具。

## 第一步：安装依赖

```bash
# 确保 Node.js 版本 >= 18.18.0
node --version

# 安装依赖
npm install
npx playwright install chromium

# 查看命令帮助，不会打开浏览器或执行清理
npm run start -- --help
```

## 第二步：创建配置文件

```bash
# Windows
copy env.example .env

# macOS/Linux
cp env.example .env
```

## 第三步：编辑 .env 文件

打开 `.env` 文件，填入你的 Twitter 账号信息：

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
    "maxDeletePerSession": 10
  }
}
```

含义：

- `tweets: true` 删除推文
- `retweets: true` 取消转推
- `replies: true` 删除回复
- `likes: false` 不取消点赞
- `bookmarks: false` 不删除书签
- `following: false` 不走旧式直接取关，关注清理建议使用 `followings` 子命令

## 第五步：运行程序

```bash
npm run build
npm run start:prod
```

程序会：
1. ✓ 打开浏览器
2. ✓ 自动登录（或等待你手动登录）
3. ✓ 显示配置信息
4. ✓ 倒计时 10 秒
5. ✓ 开始删除
6. ✓ 显示进度和统计

## 🎉 完成！

首次运行建议：
- 先设置 `maxDeletePerSession: 5` 测试
- 观察浏览器操作是否正常
- 确认无误后再增加删除数量
- 如果只想管理关注列表，阅读 [docs/FOLLOWING_MANAGEMENT.md](docs/FOLLOWING_MANAGEMENT.md)
- 遇到命令不确定时先运行 `npm run start -- --help`

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

- 📖 阅读 [README.md](README.md) 了解详细功能
- 📚 查看 [docs/README.md](docs/README.md) 选择后续文档
- 🔧 查看 [故障排查指南](docs/TROUBLESHOOTING.md)
- 🚀 探索 [高级用法](docs/ADVANCED.md)
- ✅ 准备贡献或发版时运行 `npm run verify` 和 `npm pack --dry-run`

---

**警告**：删除的内容无法恢复，请谨慎操作！

























