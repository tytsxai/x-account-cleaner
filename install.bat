@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo      Twitter 自动清理工具安装器
echo ========================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo [✓] Node.js 已安装
node --version
npm --version

echo.
echo ========================================
echo 步骤 1/3: 安装项目依赖
echo ========================================
echo.

call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [✓] 依赖安装成功
echo.

echo ========================================
echo 步骤 2/3: 安装 Playwright 浏览器
echo ========================================
echo.
echo 这将下载约 240 MB 的浏览器文件，请稍候...
echo.

call npx playwright install chromium
if %errorlevel% neq 0 (
    echo [错误] Playwright 浏览器安装失败
    pause
    exit /b 1
)

echo.
echo [✓] Playwright 浏览器安装成功
echo.

echo ========================================
echo 步骤 3/3: 编译 TypeScript 代码
echo ========================================
echo.

call npm run build
if %errorlevel% neq 0 (
    echo [警告] 编译失败，但可以使用 ts-node 运行
)

echo.
echo ========================================
echo [✓] 安装完成！
echo ========================================
echo.
echo 后续步骤：
echo 1. 检查并配置 config.json 文件
echo 2. （可选）复制 env.example 为 .env 并配置登录信息
echo 3. 运行 start.bat 启动程序
echo.
pause




