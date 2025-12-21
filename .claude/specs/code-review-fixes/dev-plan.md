# Code Review Fixes - Development Plan

## Overview
修复代码审查中发现的 10 个关键问题，涵盖选择器加载、重试机制、节流策略、配置管理、浏览器初始化、登录判定、日志输出、运行锁和进程退出等核心模块的健壮性与可靠性。

## Task Breakdown

### Task 1: selectors.json 与加载逻辑兼容修复
- **ID**: task-1
- **Description**: 修复 customSelectors 结构与加载逻辑不兼容问题；增强 selectors schema 校验机制；修复测试脚本"缺少必需选择器仍通过"的缺陷，确保选择器配置的完整性和正确性
- **File Scope**:
  - `selectors.json` - 选择器配置文件
  - `src/config/config.ts` - 配置加载逻辑
  - `src/types/index.ts` - 类型定义
  - `scripts/test-selectors.js` - 选择器测试脚本
- **Dependencies**: None
- **Test Command**:
  ```bash
  npm run test:selectors && npm run verify
  ```
- **Test Focus**:
  - 验证 customSelectors 结构与代码加载逻辑完全兼容
  - 测试缺少必需选择器时测试脚本正确失败
  - 验证 schema 校验能捕获所有无效配置
  - 测试选择器加载后类型安全性

### Task 2: retry.ts 退避策略与分类重试增强
- **ID**: task-2
- **Description**: 引入 maxDelayMs（退避上限）、jitter（随机抖动）、maxElapsedMs（总耗时控制）；实现 retryOn(error) 分类钩子支持不同错误类型的重试策略；明确 maxRetries 语义（是否包含首次尝试）
- **File Scope**:
  - `src/utils/retry.ts` - 重试工具函数
  - `src/utils/errors.ts` - 错误分类（新建）
- **Dependencies**: None
- **Test Command**:
  ```bash
  npm run lint && npm run verify
  ```
- **Test Focus**:
  - 验证指数退避达到 maxDelayMs 后不再增长
  - 测试 jitter 在合理范围内随机化延迟
  - 验证 maxElapsedMs 超时后立即停止重试
  - 测试 retryOn 钩子正确分类可重试/不可重试错误
  - 验证 maxRetries 语义一致性（首次尝试 + N 次重试）

### Task 3: deleter.ts 统一节流与限流退避策略
- **ID**: task-3
- **Description**: 实现 detectBlockingState() 返回结构化输出（阻塞类型、建议等待时间）；引入 rate limit 退避策略；统一 action/batch sleep 策略避免重复等待；修复 stale ElementHandle 导致的操作失败
- **File Scope**:
  - `src/core/deleter.ts` - 删除核心逻辑
  - `src/utils/retry.ts` - 重试工具（依赖 Task 2）
  - `src/utils/selector.ts` - 选择器工具
- **Dependencies**: task-2
- **Test Command**:
  ```bash
  npm run lint && npm run verify
  ```
- **Test Focus**:
  - 验证 detectBlockingState() 正确识别不同阻塞状态
  - 测试 rate limit 触发时自动退避等待
  - 验证 action/batch 层级不重复 sleep
  - 测试 ElementHandle 在使用前重新查询避免 stale 错误
  - 验证节流策略在高频操作下的稳定性

### Task 4: selector.ts 选择器验证与错误上下文保留
- **ID**: task-4
- **Description**: 启动期验证关键 selector 存在性；safeClick/waitForElement 返回丰富结果（成功/失败/超时/元素不存在）；日志输出保留完整上下文（选择器名称、页面 URL、操作类型）
- **File Scope**:
  - `src/utils/selector.ts` - 选择器工具函数
  - `src/config/config.ts` - 配置加载
- **Dependencies**: None
- **Test Command**:
  ```bash
  npm run lint && npm run verify
  ```
- **Test Focus**:
  - 验证启动期检测到缺失关键选择器时抛出明确错误
  - 测试 safeClick 返回结构化结果而非 boolean
  - 验证错误日志包含选择器名称、页面 URL、操作类型
  - 测试超时场景下上下文信息完整性
  - 验证选择器验证不影响启动性能

### Task 5: config.ts 环境变量与文件配置统一合并
- **ID**: task-5
- **Description**: 实现 ResolvedConfig = merge(fileConfig, envOverrides) 统一配置合并逻辑；增强 env 解析健壮性（类型转换、默认值、错误处理）；validateConfig() 覆盖所有配置字段的完整性和合法性校验
- **File Scope**:
  - `src/config/config.ts` - 配置管理
  - `env.example` - 环境变量示例
- **Dependencies**: task-1
- **Test Command**:
  ```bash
  npm run verify
  ```
- **Test Focus**:
  - 验证环境变量正确覆盖文件配置
  - 测试类型转换（字符串 → 数字/布尔）的健壮性
  - 验证缺失必需配置时 validateConfig() 抛出错误
  - 测试非法值（负数、超范围）被正确拒绝
  - 验证配置合并优先级符合预期

### Task 6: browser.ts 持久化上下文与初始化失败回滚
- **ID**: task-6
- **Description**: 使用 launchPersistentContext 真正利用 userDataDir；初始化失败时回滚清理（关闭浏览器、删除临时文件）；明确 storageState 与 userDataDir 的角色分工
- **File Scope**:
  - `src/core/browser.ts` - 浏览器管理
  - `src/index.ts` - 主入口
  - `src/config/config.ts` - 配置管理
- **Dependencies**: task-5
- **Test Command**:
  ```bash
  npm run lint
  ```
- **Test Focus**:
  - 验证使用 launchPersistentContext 而非 launch + newContext
  - 测试初始化失败时浏览器实例被正确关闭
  - 验证临时文件在失败时被清理
  - 测试 userDataDir 路径冲突时的错误处理
  - 验证 storageState 仅用于跨会话状态导入/导出

### Task 7: login.ts 可靠登录态判定与结构化重试
- **ID**: task-7
- **Description**: 登录态判定改为页面结构信号（检测特定 DOM 元素而非 URL）；自动登录分步重试（导航、输入、提交各自独立重试）；手动登录流程不被自动超时打断
- **File Scope**:
  - `src/core/login.ts` - 登录逻辑
  - `src/utils/selector.ts` - 选择器工具
  - `src/utils/retry.ts` - 重试工具
- **Dependencies**: task-2, task-4
- **Test Command**:
  ```bash
  npm run lint
  ```
- **Test Focus**:
  - 验证登录态判定基于 DOM 元素而非 URL
  - 测试自动登录各步骤独立重试机制
  - 验证手动登录等待时间不受自动超时限制
  - 测试登录失败时返回明确错误原因
  - 验证登录态检测的误判率（false positive/negative）

### Task 8: logger.ts 堆栈输出与敏感信息过滤
- **ID**: task-8
- **Description**: console 输出包含完整 stack trace；logs/ 目录延迟创建（首次写入时）避免副作用；敏感信息 redaction（密码、token、cookie）
- **File Scope**:
  - `src/utils/logger.ts` - 日志工具
  - `src/index.ts` - 主入口
- **Dependencies**: None
- **Test Command**:
  ```bash
  npm run lint && npm run verify
  ```
- **Test Focus**:
  - 验证错误日志包含完整 stack trace
  - 测试 logs/ 目录在首次写入前不存在
  - 验证密码、token 等敏感信息被正确脱敏
  - 测试日志文件写入失败时不影响主流程
  - 验证日志格式符合结构化日志标准

### Task 9: run-lock.ts 路径约束与 PID 复用防护
- **ID**: task-9
- **Description**: userDataDir 路径约束（禁止系统目录、根目录）；心跳/租约机制防止 PID 复用导致的误判；release 更健壮（清理锁文件、处理权限错误）
- **File Scope**:
  - `src/utils/run-lock.ts` - 运行锁管理
  - `src/config/config.ts` - 配置管理
  - `src/index.ts` - 主入口
- **Dependencies**: task-5, task-6
- **Test Command**:
  ```bash
  npm run lint
  ```
- **Test Focus**:
  - 验证系统目录（/tmp、/var、/etc）被拒绝作为 userDataDir
  - 测试心跳机制正确检测进程存活状态
  - 验证 PID 复用场景下锁不被误判为有效
  - 测试锁文件权限错误时的降级处理
  - 验证 release 在异常情况下仍能清理锁

### Task 10: index.ts 进程退出语义与退出码规范
- **ID**: task-10
- **Description**: shutdown() 不调用 process.exit()，由调用方决定退出时机；SIGINT/SIGTERM 信号处理器设置非 0 退出码；确保日志完整写入后再退出
- **File Scope**:
  - `src/index.ts` - 主入口
  - `src/utils/logger.ts` - 日志工具
- **Dependencies**: task-8
- **Test Command**:
  ```bash
  npm run lint
  ```
- **Test Focus**:
  - 验证 shutdown() 返回 Promise 而非直接退出
  - 测试 SIGINT 信号触发退出码为 130
  - 测试 SIGTERM 信号触发退出码为 143
  - 验证日志缓冲区在退出前完全刷新
  - 测试异常退出时退出码非 0

## Acceptance Criteria
- [ ] 所有 10 个任务的修复点完整实现
- [ ] selectors.json 结构与代码完全兼容，测试脚本正确验证
- [ ] 重试机制支持退避上限、jitter、总耗时控制和错误分类
- [ ] 删除逻辑统一节流策略，无 stale ElementHandle 错误
- [ ] 选择器操作返回结构化结果，错误日志包含完整上下文
- [ ] 配置管理支持环境变量覆盖，校验覆盖所有字段
- [ ] 浏览器使用持久化上下文，初始化失败正确回滚
- [ ] 登录态判定基于 DOM 结构，自动登录分步重试
- [ ] 日志输出包含 stack trace，敏感信息被脱敏
- [ ] 运行锁防护 PID 复用，路径约束生效
- [ ] 进程退出码符合 Unix 规范，日志完整写入
- [ ] 所有 lint 检查通过：`npm run lint`
- [ ] 所有验证通过：`npm run verify`
- [ ] 代码覆盖率 ≥90%（通过人工审查和集成测试验证）

## Technical Notes

### 架构决策
- **重试机制分层**: retry.ts 提供通用重试能力，deleter.ts/login.ts 实现业务级重试策略
- **配置优先级**: 环境变量 > 文件配置 > 默认值，确保部署灵活性
- **错误分类**: 引入 errors.ts 统一错误类型定义，支持细粒度重试决策
- **日志分离**: console 输出用于实时监控，文件日志用于事后分析

### 关键约束
- **向后兼容**: 所有修复不破坏现有 API 签名，仅增强内部实现
- **性能影响**: 选择器验证、配置校验在启动期完成，运行时零开销
- **测试策略**: 无单元测试框架，通过 lint + verify + 人工集成测试保证质量
- **依赖最小化**: 不引入新的 npm 依赖，仅使用 Node.js 内置模块和现有依赖

### 风险点
- **Task 3 复杂度**: 节流策略涉及多层调用，需仔细设计避免死锁
- **Task 6 破坏性**: 切换到 launchPersistentContext 可能影响现有用户数据目录结构
- **Task 9 平台差异**: PID 检测在 Windows/Linux/macOS 行为不同，需跨平台测试
- **Task 10 信号处理**: 信号处理器中的异步操作需确保完成后再退出

### 实施顺序建议
1. **第一批（并行）**: Task 1, 2, 4, 8 - 基础工具增强，无依赖
2. **第二批（并行）**: Task 5, 3 - 配置管理和删除逻辑，依赖第一批
3. **第三批（并行）**: Task 6, 7, 9 - 浏览器、登录、锁管理，依赖第二批
4. **第四批（串行）**: Task 10 - 进程退出，依赖日志完善

### 测试覆盖策略
由于项目无单元测试框架，采用以下验证方式：
- **静态检查**: ESLint + Prettier + TypeScript 编译
- **选择器测试**: `npm run test:selectors` 验证配置完整性
- **集成测试**: 手动运行完整删除流程，覆盖正常/异常/边界场景
- **代码审查**: 人工检查关键路径的错误处理和边界条件
