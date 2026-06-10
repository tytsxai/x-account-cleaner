@echo off
chcp 65001 >nul
echo ========================================
echo Twitter 自动清理工具 - 安装脚本
echo ========================================
echo.

:: 检查 Node.js
echo [1/5] 检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18.18.0 或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>18||(v[0]===18&&v[1]>=18)?0:1)" >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 版本过低，请升级到 18.18.0 或更高版本
    node --version
    pause
    exit /b 1
)
node --version
echo ✓ Node.js 已安装
echo.

:: 检查 npm
echo [2/5] 检查 npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm 未正确安装
    pause
    exit /b 1
)
npm --version
echo ✓ npm 已安装
echo.

:: 安装依赖
echo [3/5] 安装项目依赖...
echo 这可能需要几分钟，请耐心等待...
call npm install
if errorlevel 1 (
    echo ❌ 依赖安装失败
    echo 尝试清除缓存后重新安装...
    call npm cache clean --force
    call npm install
    if errorlevel 1 (
        echo ❌ 依赖安装仍然失败，请检查网络连接
        pause
        exit /b 1
    )
)
echo ✓ 依赖安装成功
echo.

:: 安装 Playwright 浏览器
echo [4/5] 安装 Playwright 浏览器...
call npx playwright install chromium
if errorlevel 1 (
    echo ⚠ Playwright 浏览器安装可能失败
    echo 如果后续运行出错，请手动执行: npx playwright install chromium
)
echo ✓ Playwright 浏览器安装完成
echo.

:: 创建配置文件
echo [5/5] 创建配置文件...
if not exist .env (
    if exist env.example (
        copy env.example .env >nul
        echo ✓ 已创建 .env 文件
        echo ⚠ 请编辑 .env 文件，填入你的 Twitter 账号信息
    ) else (
        echo ⚠ 未找到 env.example 文件
    )
) else (
    echo ✓ .env 文件已存在
)
echo.

:: 完成
echo ========================================
echo ✓ 安装完成！
echo ========================================
echo.
echo 下一步：
echo 1. 编辑 .env 文件，配置你的 Twitter 账号
echo 2. 编辑 config.json，配置删除选项
echo 3. 运行命令: npm start
echo.
echo 详细文档请查看: README.md
echo 快速开始请查看: QUICKSTART.md
echo.
pause



























