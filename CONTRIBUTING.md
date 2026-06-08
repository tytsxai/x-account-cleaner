# 贡献指南

感谢你对本项目的关注！我们欢迎各种形式的贡献。

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 在 Issues 中搜索，确认问题未被报告
2. 创建新 Issue，详细描述问题或建议
3. 提供必要的信息：
   - 系统环境（操作系统、Node.js 版本）
   - 复现步骤
   - 预期行为和实际行为
   - 相关日志或截图

### 提交代码

1. **Fork 项目**
2. **创建分支**：`git checkout -b feature/your-feature`
3. **编写代码**：遵循项目的代码规范
4. **测试**：确保代码能正常运行
5. **提交**：`git commit -m "feat: add some feature"`
6. **推送**：`git push origin feature/your-feature`
7. **创建 Pull Request**

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

示例：
```
feat: 添加按日期过滤删除功能
fix: 修复登录状态保存问题
docs: 更新 README 安装说明
```

## 代码规范

### TypeScript

- 使用 TypeScript 编写代码
- 为函数和复杂类型添加类型注解
- 使用 ESLint 检查代码质量
- 使用 Prettier 格式化代码

### 命名规范

- 文件名：小写 + 连字符（如 `browser-manager.ts`）
- 类名：大驼峰（如 `BrowserManager`）
- 函数/变量名：小驼峰（如 `getUserName`）
- 常量：大写 + 下划线（如 `MAX_RETRIES`）

### 代码风格

运行以下命令确保代码符合规范：

```bash
# 检查代码
npm run lint

# 自动修复
npm run lint:fix

# 格式化
npm run format
```

## 开发流程

### 环境设置

```bash
# 安装依赖
npm install

# 开发模式（自动重启）
npm run dev

# 编译
npm run build
```

### 测试

在提交前，请确保：

```bash
npm run release:check
```

`npm run release:check` 会先执行 `npm run verify`，再执行 `npm pack --dry-run`。`verify` 覆盖 TypeScript 编译、ESLint、Prettier 检查、CLI 帮助命令测试、选择器配置测试和关注管理核心测试；pack dry-run 用于确认公开包不会带入日志、浏览器数据、关注导出文件或其他本地私密文件。

如果改动影响真实 X / Twitter 页面自动化，还需要用 `HEADLESS=false` 和小批量配置做一次人工浏览器验证。

### 安全与隐私

- 不要提交 `.env`、cookies、`browser-data/`、`logs/`、关注导出文件或任何真实账号私密数据。
- 破坏性操作必须继续保留小批量、dry-run、确认文件或人工确认路径。
- 任何命令行帮助、文档示例和 Issue 回复都不应鼓励绕过 X 风控或服务条款。
- 安全问题处理方式见 [SECURITY.md](SECURITY.md)。

## 需要帮助？

如有任何问题，欢迎：

- 创建 Issue 讨论
- 在 Pull Request 中提问
- 查看现有的 Issues 和 Discussions

再次感谢你的贡献！🎉


























