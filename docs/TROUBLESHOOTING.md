# 故障排查指南

本文档提供常见问题的详细排查步骤。

## 安装问题

### Q: npm install 失败

**可能原因**：
- 网络问题
- Node.js 版本过低
- npm 源速度慢

**解决方案**：

```bash
# 检查 Node.js 版本（需要 >= 18.18.0）
node --version

# 使用国内镜像源
npm config set registry https://registry.npmmirror.com

# 清除缓存重试
npm cache clean --force
npm install

# 或使用 yarn
npm install -g yarn
yarn install
```

### Q: Playwright 浏览器下载失败

**解决方案**：

```bash
# 手动安装浏览器
npx playwright install chromium

# 或设置国内镜像
set PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright/
npx playwright install
```

## 运行问题

### Q: 程序启动失败

**检查清单**：

1. **检查配置文件是否存在**
   ```bash
   # 确保这些文件存在
   dir config.json
   dir .env
   ```

2. **检查配置文件格式**
   - `config.json` 必须是有效的 JSON
   - `.env` 格式正确
   - `selectors.json` 存在时请运行 `npm run test:selectors`

3. **查看错误日志**
   ```bash
   # 查看日志文件
   type logs\combined.log
   type logs\error.log
   ```

### Q: 提示已有实例正在运行

**可能原因**：
- 上次运行异常退出，残留 `run.lock`
- 同一账号（同一 `USER_DATA_DIR`）被重复启动

**解决方案**：
1. 确认没有其他实例在运行
2. 删除 `USER_DATA_DIR/run.lock`（默认路径 `browser-data/run.lock`）
3. 如需同时运行多个账号，给不同账号配置不同的 `USER_DATA_DIR`

### Q: 浏览器无法启动

**可能原因**：
- 缺少系统依赖（Linux）
- 端口被占用
- 权限问题

**解决方案**：

**Linux/WSL**：
```bash
# Ubuntu/Debian
sudo apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2
```

**Windows**：
- 以管理员身份运行
- 检查防火墙设置
- 关闭杀毒软件（临时）

## 登录问题

### Q: 自动登录失败

**可能原因**：
1. 账号密码错误
2. Twitter 要求额外验证
3. IP 被标记为可疑
4. 登录流程变化
5. 页面已跳转但已认证 DOM 尚未加载完成

自动登录会按阶段重试：导航到登录页、输入用户名、检测验证 detour、输入密码、提交、等待已认证 DOM。日志中的“自动登录阶段 xxx”可以帮助判断卡在登录页渲染、用户名步骤、密码步骤还是最终校验。

**解决方案**：

1. **验证账号密码**
   ```env
   # .env 文件
   TWITTER_USERNAME=正确的用户名或邮箱
   TWITTER_PASSWORD=正确的密码
   ```

2. **使用手动登录**
   ```env
   # 注释掉账号密码，使用手动登录
   # TWITTER_USERNAME=
   # TWITTER_PASSWORD=
   ```

3. **清除登录状态重试**
   ```bash
   # Windows
   del browser-data\state.json

   # macOS/Linux
   rm browser-data/state.json
   ```

   `state.json` 只是登录状态快照。若需要完整重新登录，请同时删除持久浏览器 profile：

   ```bash
   # Windows
   rmdir /s /q browser-data\profile

   # macOS/Linux
   rm -rf browser-data/profile
   ```

4. **增加调试日志**
   ```env
   LOG_LEVEL=debug
   HEADLESS=false  # 观察登录过程
   ```

5. **处理验证 detour**
   - 有头模式下，程序会保留当前验证页面并等待你手动完成
   - `HEADLESS=true` 无法处理验证码、2FA、账号访问限制或身份确认页，请改用 `HEADLESS=false`
   - 不建议频繁删除登录状态反复尝试；若账号进入风控页，先人工完成验证并等待一段时间

### Q: 登录后提示"无法获取用户名"

**解决方案**：

1. **手动导航到个人主页**
   - 程序会等待 10 秒
   - 在浏览器中点击你的头像进入个人主页

2. **修改代码获取用户名的逻辑**
   - 查看 `src/core/login.ts` 的 `getUsername()` 方法
   - 根据实际页面结构调整

### Q: 浏览器已经显示主页，但程序仍提示未登录

**原因**：

程序现在以已认证 DOM 信号为准，不再只看 URL。X / Twitter 有时会先跳到 `/home`，但账号菜单、个人资料导航或主页外壳还没加载完成，此时直接继续执行容易误删失败或触发后续异常。

**解决方案**：

1. 等待页面完整加载，确认左侧导航和账号菜单可见
2. 设置 `LOG_LEVEL=debug` 观察是否仍处于验证、登录流程或页面延迟渲染
3. 若页面出现验证码、账号访问限制或异常活动提示，请先人工处理后再运行

## 删除问题

### Q: 程序运行但没有删除任何内容

**排查步骤**：

1. **检查是否有可删除的内容**
   - 手动访问对应的页面
   - 确认有推文/回复/转推

2. **检查选择器是否过期**
   ```bash
   # 启用调试模式
   LOG_LEVEL=debug
   ```
   
   查看日志中是否有"未找到元素"的提示

3. **增加等待时间**
   ```json
   // config.json
   {
     "executionConfig": {
       "pageRefreshDelay": 10000,  // 增加到 10 秒
       "delayBetweenActions": 3000
     }
   }
   ```

4. **手动测试选择器**
   - 打开 Twitter 页面
   - 按 F12 打开开发者工具
   - 在 Console 中测试选择器：
   ```javascript
   document.querySelector('[data-testid="tweet"]')
   ```

### Q: 删除速度很慢

**正常现象**：为避免触发 Twitter 限制，程序有意降低速度。

**如需加速**（风险自负）：
```json
{
  "executionConfig": {
    "deletePerBatch": 10,        // 增加批次大小
    "delayBetweenActions": 1000, // 减少延迟
    "delayBetweenBatches": 2000,
    "pageRefreshDelay": 3000
  }
}
```

### Q: 部分内容删除失败

**可能原因**：
- 网络波动
- 页面加载不完整
- Twitter 临时限制

**解决方案**：
1. 重新运行程序（会继续删除剩余内容）
2. 增加重试次数和延迟
3. 手动删除失败的内容

### Q: 日志提示检测到阻断状态

**频率限制**：
- 程序会按 `RateLimitError` 进入较长退避重试
- 如果多次重试后仍失败，降低 `deletePerBatch`，增大 `delayBetweenActions` / `delayBetweenBatches`，并暂停一段时间再运行

**账号访问受限、验证、锁定或异常活动**：
- 程序会停止删除流程，不会把这类状态当作普通单条失败继续跳过
- 使用 `HEADLESS=false` 打开浏览器人工处理验证或账号页面
- 账号恢复后先用默认小批量上限重新验证，不要直接恢复大批量清理

**页面临时异常**：
- 程序会按可重试阻断处理
- 重试耗尽后，手动刷新对应页面确认是否是平台临时异常或选择器失效

## 选择器更新

### Twitter 页面结构变化

如果 Twitter 更新了页面结构，需要更新选择器。

**步骤**：

1. **使用浏览器开发者工具**
   - F12 打开开发者工具
   - 使用元素选择器（Ctrl + Shift + C）
   - 找到对应元素的选择器

2. **更新 config.json**
   ```json
   {
     "selectors": {
       "tweetMoreButton": "新的选择器",
       "deleteButton": "新的选择器"
     }
   }
   ```

3. **常用选择器类型**
   - `[data-testid="xxx"]` - 测试 ID（最稳定）
   - `[aria-label="xxx"]` - 无障碍标签
   - `.class-name` - CSS 类名（容易变化）
   - `#id` - ID 选择器

## 性能问题

### Q: 程序占用内存过高

**解决方案**：

1. **减少批次大小**
   ```json
   {
     "executionConfig": {
       "deletePerBatch": 3,
       "maxDeletePerSession": 50
     }
   }
   ```

2. **分多次运行**
   - 不要一次删除太多
   - 分批次，间隔运行

3. **关闭不必要的功能**
   ```json
   {
     "deleteOptions": {
       "tweets": true,
       "retweets": false,  // 暂时关闭
       "replies": false,
       "likes": false
     }
   }
   ```

## 错误代码

### 常见错误及含义

| 错误信息 | 含义 | 解决方案 |
|---------|------|---------|
| `配置文件 config.json 不存在` | 当前运行目录缺少配置文件 | 源码运行时检查文件是否存在；npm 安装时执行 `cp node_modules/x-account-cleaner/config.json . && cp node_modules/x-account-cleaner/selectors.json .` |
| `默认清理流程没有启用任何 deleteOptions` | 默认入口没有可执行清理类目 | 在 `config.json` 启用目标类目；只做关注管理时改用 `x-account-cleaner followings export` |
| `浏览器上下文未初始化` | 浏览器启动失败 | 查看浏览器日志 |
| `无法获取用户名` | 未能识别当前用户 | 手动导航到个人主页 |
| `TimeoutError` | 元素等待超时 | 增加 `pageRefreshDelay` |
| `页面未初始化` | 浏览器页面问题 | 重启程序 |

## 获取帮助

如果以上方案都无法解决问题：

1. **收集信息**
   - 操作系统和版本
   - Node.js 版本
   - 错误日志（`logs/` 目录）
   - 截图（如果相关）

2. **提交 Issue**
   - 访问项目的 Issues 页面
   - 搜索是否有类似问题
   - 创建新 Issue，附上收集的信息

3. **查看日志**
   ```bash
   # 查看完整日志
   type logs\combined.log

   # 只看错误日志
   type logs\error.log
   ```

4. **启用调试模式**
   ```env
   LOG_LEVEL=debug
   HEADLESS=false
   ```

---

**提示**：大多数问题可以通过查看日志文件找到原因。





















