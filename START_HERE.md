# 🚀 从这里开始

欢迎使用 **X Account Cleaner（X / Twitter 自动清理工具）**！

## 📖 快速导航

### 新手入门
1. **[README.md](README.md)** - 项目介绍和功能特性（⭐ 推荐阅读）
2. **[QUICKSTART.md](QUICKSTART.md)** - 5分钟快速开始
3. **[docs/README.md](docs/README.md)** - docs 目录索引，按使用、排障、开发场景跳转
4. **[选择器配置说明.md](选择器配置说明.md)** - 当 Twitter 更新时如何修复

### 快速开始（3步）

#### Windows 用户
1. 双击 `install.bat` 安装依赖
2. 编辑 `config.json` 配置清理选项
3. 双击 `start.bat` 启动程序

#### Linux/Mac 用户
```bash
./install.sh          # 1. 安装依赖
# 编辑 config.json    # 2. 配置清理选项
./start.sh            # 3. 启动程序
```

---

## 📚 核心文档

### 🚀 快速开始
- **[QUICKSTART.md](QUICKSTART.md)** - 5分钟快速开始指南
- **[README.md](README.md)** - 完整项目介绍和使用说明

### 🔧 配置相关
- **[选择器配置说明.md](选择器配置说明.md)** - 当 Twitter 更新后如何修复
- **[选择器快速参考.txt](选择器快速参考.txt)** - 快速参考卡片
- **[docs/README.md](docs/README.md)** - 文档索引和项目边界说明
- **[docs/SELECTOR_UPDATE_GUIDE.md](docs/SELECTOR_UPDATE_GUIDE.md)** - 详细的选择器更新教程
- **[docs/ADVANCED.md](docs/ADVANCED.md)** - 高级配置选项
- **[docs/OPERATIONS.md](docs/OPERATIONS.md)** - 生产运行与运维指南
- **[docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)** - 生产就绪评估与上线检查

### 👨‍💻 开发相关
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** - 项目架构说明
- **[docs/API.md](docs/API.md)** - API 文档
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - 贡献指南
- **[选择器配置系统更新说明.md](选择器配置系统更新说明.md)** - 选择器系统技术说明

### 🆘 问题排查
- **[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - 问题排查指南
- **[CHANGELOG.md](CHANGELOG.md)** - 更新日志

---

## 🔥 启动模式对比

| 特性 | 生产模式 | 开发模式 |
|-----|---------|---------|
| **启动脚本** | `start.bat` / `start.sh` | `开发模式启动.bat` / `开发模式启动.sh` |
| **NPM 命令** | `npm run build && npm run start:prod` | `npm run dev` |
| **热加载** | ❌ | ✅ |
| **自动重启** | ❌ | ✅ |
| **适用场景** | 日常使用 | 代码开发 |

---

## ⚙️ 核心配置文件

### config.json - 清理配置（必需）
```json
{
  "deleteOptions": {
    "tweets": true,      // 删除推文
    "retweets": true,    // 取消转推
    "replies": true,     // 删除回复
    "likes": false,      // 取消点赞
    "bookmarks": false,  // 删除书签
    "following": false   // 保持关闭；关注清理使用 followings 子命令
  },
  "executionConfig": {
    "maxDeletePerSession": 5,    // 每个启用类目单次最多处理 5 项
    "deletePerBatch": 3,         // 每批最多处理 3 项
    "delayBetweenActions": 1500  // 操作间基础延迟（毫秒）
  }
}
```

### .env - 环境配置（可选）
```env
# 自动登录（可选）
TWITTER_USERNAME=your_username
TWITTER_PASSWORD=your_password

# 浏览器配置
HEADLESS=false
BROWSER_TYPE=chromium
```

---

## 💡 使用建议

### 首次使用
1. ⚠️ **先小批量测试**：保持默认 `maxDeletePerSession: 5`
2. 📖 **阅读 README**：了解登录方式和配置选项
3. 💾 **重要内容备份**：删除操作不可逆
4. 🔧 **准备选择器配置**：熟悉选择器更新方法（以防 Twitter 更新）
5. 👀 **关注清理只读起步**：需要清理关注时先运行 `npm run start -- followings export`，不要启用旧式 `deleteOptions.following`

### 日常使用
- 使用**生产模式**（`start.bat` 或 `start.sh`）
- 根据需要调整 `config.json` 配置
- 查看 `logs/` 目录了解运行日志

### 代码开发
- 使用**开发模式**（`开发模式启动.bat` 或 `开发模式启动.sh`）
- 享受热加载带来的便利
- 修改代码后自动重启，无需手动编译

---

## 📞 需要帮助？

- 📖 阅读 [README.md](README.md) - 完整使用说明
- 🔧 阅读 [选择器配置说明.md](选择器配置说明.md) - Twitter 更新后如何修复
- 🔍 查看 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - 问题排查
- 💬 提交 GitHub Issue

---

## ⚠️ 重要提醒

1. **删除不可逆**：所有删除操作无法撤销
2. **谨慎操作**：建议先小批量测试
3. **备份重要内容**：删除前请备份
4. **遵守规则**：遵守 Twitter 服务条款
5. **准备应对更新**：Twitter 可能更新页面结构，请熟悉选择器配置

---

## 🎯 Twitter 更新后怎么办？

如果程序突然无法工作（Twitter 更新页面结构），请：

1. 📖 查看 [选择器快速参考.txt](选择器快速参考.txt) - 2分钟快速修复指南
2. 📚 阅读 [选择器配置说明.md](选择器配置说明.md) - 5分钟上手指南
3. 📖 参考 [docs/SELECTOR_UPDATE_GUIDE.md](docs/SELECTOR_UPDATE_GUIDE.md) - 详细教程
4. 🧪 运行 `npm run test:selectors` 验证配置

**预计修复时间**：5-10 分钟 ⚡

---

**准备好了吗？**

👉 阅读 [README.md](README.md) 了解完整使用说明

👉 或直接运行 `start.bat` (Windows) / `./start.sh` (Linux/Mac) 开始使用！
