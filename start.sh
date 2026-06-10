#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}     Twitter 自动清理工具启动器${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Node.js，请先安装 Node.js${NC}"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi
if ! node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>18||(v[0]===18&&v[1]>=18)?0:1)" >/dev/null 2>&1; then
    echo -e "${RED}[错误] Node.js 版本过低，请升级到 18.18.0 或更高版本${NC}"
    node --version
    exit 1
fi

echo -e "${GREEN}[✓] Node.js 已安装${NC}"
node --version

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 npm${NC}"
    exit 1
fi

# 检查是否有 node_modules
if [ ! -d "node_modules" ]; then
    echo ""
    echo -e "${YELLOW}[提示] 检测到依赖未安装，正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[错误] 依赖安装失败${NC}"
        exit 1
    fi
    echo ""
    echo -e "${YELLOW}[提示] 正在安装 Playwright 浏览器...${NC}"
    npx playwright install chromium
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[警告] Playwright 浏览器安装失败，程序可能无法正常运行${NC}"
    fi
else
    # 检查 Playwright 浏览器是否已安装
    if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ] && [ ! -d "$HOME/Library/Caches/ms-playwright/chromium-"* ]; then
        echo ""
        echo -e "${YELLOW}[提示] 检测到 Playwright 浏览器未安装，正在安装...${NC}"
        npx playwright install chromium
        if [ $? -ne 0 ]; then
            echo -e "${YELLOW}[警告] Playwright 浏览器安装失败，程序可能无法正常运行${NC}"
        fi
    fi
fi

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo ""
    echo -e "${RED}[警告] 未找到 config.json 配置文件${NC}"
    echo "请确保 config.json 文件存在于项目根目录"
    exit 1
fi

# 检查环境变量文件（可选）
if [ ! -f ".env" ]; then
    if [ -f "env.example" ]; then
        echo ""
        echo -e "${YELLOW}[提示] 未找到 .env 文件，但这是可选的${NC}"
        echo "如果需要，可以复制 env.example 为 .env 并填入您的凭据"
    fi
fi

echo ""
echo -e "${GREEN}[✓] 所有检查通过，准备启动程序...${NC}"
echo ""
echo "========================================"
echo ""
echo -e "${CYAN}[提示] 登录方式说明：${NC}"
echo ""
echo "  方式一：手动登录（推荐，默认方式）"
echo "  - 程序会打开浏览器并导航到 Twitter 登录页"
echo "  - 请在浏览器中手动输入您的账号密码"
echo "  - 登录成功后程序会自动继续"
echo "  - 登录状态会保存，下次运行无需重新登录"
echo ""
echo "  方式二：自动登录（可选）"
echo "  - 需要配置 .env 文件，填入账号密码"
echo "  - 如开启了两步验证，可能仍需手动输入"
echo "  - 查看 \"登录说明.md\" 了解详细配置方法"
echo ""
echo "========================================"
echo ""
echo -e "${YELLOW}按 Enter 键开始运行程序...${NC}"
read -r
echo ""

# 构建并启动生产模式
echo -e "${YELLOW}[提示] 正在构建生产版本...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[错误] 构建失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[✓] 构建完成，启动生产模式...${NC}"
echo ""
npm run start:prod

# 检查退出状态
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[错误] 程序执行出错${NC}"
    exit 1
fi
