@echo off
chcp 65001 > nul
REM ========================================
REM   Twitter 清理工具 - 开发模式启动器
REM ========================================

echo.
echo ========================================
echo      开发模式启动 - Windows
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
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>18||(v[0]===18&&v[1]>=18)?0:1)" >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] Node.js 版本过低，请升级到 18.18.0 或更高版本
    node --version
    pause
    exit /b 1
)

echo [✓] Node.js 已安装
node --version
echo.

REM 检查 npm 是否安装
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm
    pause
    exit /b 1
)

REM 检查依赖是否安装
if not exist "node_modules\" (
    echo [提示] 检测到依赖未安装，正在安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
    echo.
)

REM 检查配置文件
if not exist "config.json" (
    echo [警告] 未找到 config.json 配置文件
    echo 请确保 config.json 文件存在于项目根目录
    pause
    exit /b 1
)

echo.
echo [✓] 所有检查通过，准备启动开发模式...
echo.
echo ========================================
echo  开发模式说明（热加载）
echo ========================================
echo.
echo ✅ 代码修改后自动重新编译和重启
echo ✅ 无需手动运行 build 命令
echo ✅ 实时查看代码更改效果
echo ✅ 自动监听 src/ 目录下的所有文件
echo.
echo ⚠️  注意：
echo   - 修改代码保存后会自动重启程序
echo   - 开发模式会占用更多资源
echo   - 按 Ctrl+C 可以随时停止
echo.
echo ========================================
echo.
echo [提示] 登录方式说明：
echo.
echo   方式一：手动登录（推荐，默认方式）
echo   - 程序会打开浏览器并导航到 Twitter 登录页
echo   - 请在浏览器中手动输入您的账号密码
echo   - 登录成功后程序会自动继续
echo.
echo   方式二：自动登录（可选）
echo   - 需要配置 .env 文件，填入账号密码
echo   - 查看 "登录说明.md" 了解详细配置方法
echo.
echo ========================================
echo.
echo 按任意键启动开发模式（热加载）...
pause >nul
echo.

echo [启动] 正在以开发模式启动程序...
echo [监听] 文件更改将自动触发重启
echo.
echo ========================================
echo.

REM 启动开发模式（使用 ts-node-dev 实现热加载）
call npm run dev

REM 检查退出状态
if %errorlevel% neq 0 (
    echo.
    echo [错误] 程序执行出错
    pause
    exit /b 1
)

pause
