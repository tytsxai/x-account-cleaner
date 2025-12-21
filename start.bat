@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ========================================
echo      Twitter 自动清理工具启动器
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

REM 检查是否有 node_modules
if not exist "node_modules\" (
    echo.
    echo [提示] 检测到依赖未安装，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
    echo [提示] 正在安装 Playwright 浏览器...
    call npx playwright install chromium
    if %errorlevel% neq 0 (
        echo [警告] Playwright 浏览器安装失败，程序可能无法正常运行
    )
) else (
    REM 检查 Playwright 浏览器是否已安装
    if not exist "%USERPROFILE%\AppData\Local\ms-playwright\chromium-*" (
        echo.
        echo [提示] 检测到 Playwright 浏览器未安装，正在安装...
        call npx playwright install chromium
        if %errorlevel% neq 0 (
            echo [警告] Playwright 浏览器安装失败，程序可能无法正常运行
        )
    )
)

REM 检查配置文件
if not exist "config.json" (
    echo.
    echo [警告] 未找到 config.json 配置文件
    echo 请确保 config.json 文件存在于项目根目录
    pause
    exit /b 1
)

REM 检查环境变量文件（可选）
if not exist ".env" (
    if exist "env.example" (
        echo.
        echo [提示] 未找到 .env 文件，但这是可选的
        echo 如果需要，可以复制 env.example 为 .env 并填入您的凭据
    )
)

echo.
echo [✓] 所有检查通过，准备启动程序...
echo.
echo ========================================
echo.
echo [提示] 登录方式说明：
echo.
echo   方式一：手动登录（推荐，默认方式）
echo   - 程序会打开浏览器并导航到 Twitter 登录页
echo   - 请在浏览器中手动输入您的账号密码
echo   - 登录成功后程序会自动继续
echo   - 登录状态会保存，下次运行无需重新登录
echo.
echo   方式二：自动登录（可选）
echo   - 需要配置 .env 文件，填入账号密码
echo   - 如开启了两步验证，可能仍需手动输入
echo   - 查看 "登录说明.md" 了解详细配置方法
echo.
echo ========================================
echo.
echo 按任意键开始运行程序...
pause >nul
echo.

REM 构建并启动生产模式
echo [提示] 正在构建生产版本...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [错误] 构建失败
    pause
    exit /b 1
)

echo.
echo [✓] 构建完成，启动生产模式...
echo.
call npm run start:prod

REM 如果程序异常退出，等待用户查看错误信息
if %errorlevel% neq 0 (
    echo.
    echo [错误] 程序执行出错，错误代码: %errorlevel%
    pause
)
