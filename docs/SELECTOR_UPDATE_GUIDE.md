# 选择器更新指南

## 📋 概述

当 X（原 Twitter）更新页面结构导致功能失效时，你只需要更新 `selectors.json` 文件即可，无需修改代码。

## 🎯 为什么需要这个配置文件？

X 会持续调整其网页结构，这会导致原有的元素选择器失效。通过将选择器配置独立出来，你可以：

- ✅ 快速应对 X 页面结构变化
- ✅ 无需修改代码即可更新选择器
- ✅ 支持主选择器和备用选择器
- ✅ 便于测试和调试
- ✅ 社区可以共享最新的选择器配置

## 📁 配置文件位置

```
x-account-cleaner/
├── selectors.json          ← 独立的选择器配置文件
├── config.json             ← 主配置文件（也包含选择器，作为备用）
└── src/
```

**加载优先级：** `selectors.json` > `config.json`

## 🔧 如何检查选择器是否失效？

### 症状：
- ❌ 程序运行但没有删除任何内容
- ❌ 日志中出现"未找到元素"的错误
- ❌ 点击操作没有反应

### 诊断方法：
1. 将日志级别设为 `debug`（在 `.env` 中设置 `LOG_LEVEL=debug`）
2. 运行程序并查看日志
3. 查找类似 "等待元素失败" 或 "点击元素失败" 的消息
4. 记录失效的选择器名称

## 🛠️ 如何更新选择器？

### 方法一：使用浏览器开发者工具（推荐）

#### 步骤 1：打开开发者工具
1. 打开 X 网站：https://x.com （twitter.com 会 301 跳转到 x.com）
2. 登录你的账号
3. 按 `F12` 打开开发者工具（或右键 → 检查）

#### 步骤 2：定位元素
1. 点击开发者工具左上角的 **元素选择器**（或按 `Ctrl+Shift+C`）
2. 移动鼠标到你想要操作的按钮上（例如：推文的"更多"按钮）
3. 点击该按钮
4. 开发者工具会自动跳转到对应的 HTML 元素

#### 步骤 3：查找选择器
在 Elements 面板中，查看元素的属性，**优先查找**：

1. **data-testid** ⭐⭐⭐⭐⭐（最推荐）
   ```html
   <div data-testid="tweet">...</div>
   ```
   选择器：`[data-testid='tweet']`

2. **aria-label** ⭐⭐⭐⭐（推荐）
   ```html
   <button aria-label="更多">...</button>
   ```
   选择器：`[aria-label='更多']` 或 `[aria-label*='更多']`（模糊匹配）

3. **role** ⭐⭐⭐（可用）
   ```html
   <button role="button">...</button>
   ```
   选择器：`[role='button']`

4. **class** ⭐（不推荐）
   ```html
   <div class="css-1dbjc4n r-18u37iz">...</div>
   ```
   ❌ 不推荐：类名可能随时变化

#### 步骤 4：测试选择器
在开发者工具的 **Console** 面板中测试：

```javascript
// 测试选择器是否能找到元素
document.querySelector('[data-testid="tweet"]')

// 如果返回元素，说明选择器有效
// 如果返回 null，说明选择器无效
```

#### 步骤 5：更新配置文件
打开 `selectors.json`，找到对应的选择器并更新：

```json
{
  "selectors": {
    "tweet": {
      "primary": "[data-testid='tweet']",           ← 主选择器
      "fallback": "article[role='article']",       ← 备用选择器
      "description": "推文容器元素"
    }
  }
}
```

### 方法二：使用 Playwright Inspector

如果你熟悉 Playwright，可以使用其自带的调试工具：

```bash
# 启动 Playwright Inspector
npx playwright codegen https://x.com
```

这会打开一个浏览器窗口和调试工具，可以直接生成选择器。

## 📝 选择器配置格式

### 基本结构
```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-10-05",
  "description": "选择器配置文件",
  "selectors": {
    "选择器名称": {
      "primary": "主选择器",
      "fallback": "备用选择器（可选）",
      "description": "说明文字（可选）"
    }
  }
}
```

### 示例
```json
{
  "selectors": {
    "tweetMoreButton": {
      "primary": "[data-testid='caret']",
      "fallback": "[aria-label*='更多'][role='button'], [aria-label='More'][role='button']",
      "description": "推文的'更多'按钮（三个点图标）"
    }
  }
}
```

### 主选择器 vs 备用选择器

- **primary**：首选选择器，通常写与界面语言无关的 `data-testid`
- **fallback**：备用选择器，可以写多个，用逗号分隔（例如同时覆盖中文和英文界面）

程序在加载时会把两者合并成一条列表：`primary, fallback`，然后交给 Playwright 查找。

> ⚠️ **重要：合并后的列表按 DOM 顺序命中，不是按书写顺序优先。**
> 也就是说，如果 fallback 匹配到的元素在页面里出现得更靠前，它会先被选中。
> 因此 fallback **必须与 primary 语义完全一致**，绝不能匹配到功能不同的按钮。
> 反例：给 `unretweet` 加上 `[aria-label*='Repost']`，会命中"转推"按钮本身，导致误转推而不是撤销转推。

### 界面语言的影响

`data-testid` 与界面语言无关，最稳定；`aria-label` 和 `:has-text()` 会随 X 的界面语言变化。
本项目默认对删除、取消关注等关键按钮同时提供中文和英文备用值。如果你的 X 界面是其他语言，
建议在 `fallback` 里追加对应语言的文案，或干脆把界面语言切换到中文 / 英文再运行。

### 动态 data-testid

X 的关注按钮 testid 里带账号 ID，形如 `1234567890-unfollow`（已关注）/ `1234567890-follow`（未关注）。
这类选择器必须用后缀匹配 `[data-testid$='-unfollow']`，不能写成 `[data-testid*='following']`（匹配不到任何元素）。

## 🔍 常见选择器更新场景

### 场景 1：推文删除功能失效

**症状：** 程序运行但没有删除任何推文

**可能原因：** `tweetMoreButton` 或 `deleteButton` 选择器失效

**解决步骤：**
1. 打开 x.com，找到任意一条你的推文
2. 使用开发者工具定位"更多"按钮（三个点图标）
3. 查找 `data-testid` 或 `aria-label` 属性
4. 更新 `selectors.json` 中的 `tweetMoreButton`
5. 点击"更多"按钮，定位"删除"菜单项
6. 更新 `deleteButton` 选择器
7. 重新运行程序测试

### 场景 2：取消转推功能失效

**更新选择器：** `unretweet` 和 `unretweetConfirm`

**测试方法：**
1. 打开你的 X 个人主页
2. 找到一条你转推的内容
3. 定位"取消转推"按钮
4. 更新选择器配置

### 场景 3：取消点赞功能失效

**更新选择器：** `unlikeButton`

**测试方法：**
1. 打开"喜欢"页面（https://x.com/你的用户名/likes）
2. 定位"取消喜欢"按钮（红心图标）
3. 更新选择器配置

### 场景 4：取消关注功能失效

**更新选择器：** `userCell`, `followingButton`, `unfollowConfirm`

**测试方法：**
1. 打开"正在关注"页面
2. 定位用户卡片元素（`userCell`）
3. 定位"正在关注"按钮（`followingButton`）
4. 点击按钮，定位确认对话框（`unfollowConfirm`）
5. 更新选择器配置

## 💡 选择器编写技巧

### 1. 使用属性选择器
```css
/* 精确匹配 */
[data-testid='tweet']

/* 包含匹配（模糊） */
[aria-label*='更多']

/* 开头匹配 */
[data-testid^='user']

/* 结尾匹配 */
[data-testid$='button']
```

### 2. 组合选择器
```css
/* AND 条件 */
[role='button'][aria-label='删除']

/* OR 条件（用逗号分隔） */
[data-testid='delete'], [aria-label='删除']

/* 父子关系 */
article[data-testid='tweet'] button[role='button']
```

### 3. 伪类选择器
```css
/* 包含文本 */
button:has-text('删除')

/* 第一个元素 */
div:first-child

/* 可见元素 */
button:visible
```

### 4. 避免使用
```css
/* ❌ 不要用 class（容易变化） */
.css-1dbjc4n

/* ❌ 不要用复杂的层级关系 */
div > div > div > button

/* ❌ 不要用索引 */
button:nth-child(3)
```

## 🧪 测试选择器

### 在浏览器 Console 中测试

```javascript
// 测试单个选择器
document.querySelector('[data-testid="tweet"]')

// 测试多个元素
document.querySelectorAll('[data-testid="tweet"]')

// 测试是否可见
document.querySelector('[data-testid="tweet"]').offsetParent !== null

// 测试点击
document.querySelector('[data-testid="tweet"]').click()
```

### 使用 Playwright 的 page.locator()

```javascript
// 在程序中添加调试代码
await page.locator('[data-testid="tweet"]').first().click()
```

## 📋 选择器清单

以下是所有需要维护的选择器：

| 选择器名称 | 用途 | 重要性 |
|-----------|------|--------|
| `tweet` | 推文容器 | ⭐⭐⭐⭐⭐ |
| `tweetMoreButton` | 推文"更多"按钮 | ⭐⭐⭐⭐⭐ |
| `deleteButton` | 删除按钮 | ⭐⭐⭐⭐⭐ |
| `confirmDeleteButton` | 确认删除 | ⭐⭐⭐⭐⭐ |
| `unretweet` | 取消转推按钮 | ⭐⭐⭐⭐ |
| `unretweetConfirm` | 确认取消转推 | ⭐⭐⭐⭐ |
| `unlikeButton` | 取消点赞按钮 | ⭐⭐⭐⭐ |
| `removeBookmarkButton` | 删除书签按钮 | ⭐⭐⭐ |
| `followingButton` | 正在关注按钮（`[data-testid$='-unfollow']`） | ⭐⭐⭐ |
| `unfollowButton` | 取消关注按钮 | ⭐⭐⭐ |
| `unfollowConfirm` | 确认取消关注 | ⭐⭐⭐ |
| `userCell` | 用户卡片 | ⭐⭐⭐ |
| `likeButton` / `bookmarkButton` | 点赞 / 书签按钮（状态判断用） | ⭐⭐ |
| `loginUsernameInput` / `loginPasswordInput` / `loginNextButton` / `loginButton` | 自动登录流程 | ⭐⭐ |
| `profileLink` | 已登录判断信号之一 | ⭐⭐ |

## 🤝 共享你的配置

如果你更新了选择器并验证可用，欢迎：
1. 提交 Issue 分享最新的选择器
2. 发起 Pull Request 更新 `selectors.json`
3. 在社区讨论最佳实践

## ❓ 常见问题

### Q1：为什么要用两个配置文件？
**A：** `config.json` 包含所有配置（包括选择器），`selectors.json` 是独立的选择器配置。如果 `selectors.json` 存在，会优先使用它；否则使用 `config.json` 中的配置。这样既保持了向后兼容，又提供了更灵活的管理方式。

### Q2：如何知道哪个选择器失效了？
**A：** 将日志级别设为 `debug`，运行程序后查看日志输出，会显示具体哪个元素查找失败。

### Q3：备用选择器什么时候生效？
**A：** 程序把主选择器和备用选择器合并成 `primary, fallback` 一条列表交给 Playwright，只要其中一个能找到元素就会成功。注意命中顺序取决于元素在 DOM 中的位置，而不是你写的先后顺序，所以备用选择器不能匹配语义不同的按钮。

### Q4：可以添加自定义选择器吗？
**A：** 可以！在 `selectors.json` 的 `customSelectors` 部分添加即可。

### Q5：选择器更新后需要重新编译吗？
**A：** 不需要！配置文件在运行时加载，只需重新运行程序即可。

## 📚 参考资源

- [Playwright Selectors 文档](https://playwright.dev/docs/selectors)
- [CSS Selectors 参考](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors)
- [Chrome DevTools 文档](https://developer.chrome.com/docs/devtools/)

---

**提示：** 建议定期备份你的 `selectors.json` 文件，以便在更新失败时快速恢复。
