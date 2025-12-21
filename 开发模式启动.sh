#!/bin/bash

# ========================================
#   Twitter 清理工具 - 开发模式启动器
# ========================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}      开发模式启动 - Linux/Mac${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 检查 Node.js 是否安装
if ! command -v node &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 Node.js，请先安装 Node.js${NC}"
    echo "下载地址: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}[✓] Node.js 已安装${NC}"
node --version
echo ""

# 检查 npm 是否安装
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[错误] 未检测到 npm${NC}"
    exit 1
fi

# 检查是否有 node_modules
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}[提示] 检测到依赖未安装，正在安装依赖...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}[错误] 依赖安装失败${NC}"
        exit 1
    fi
    echo ""
fi

# 检查配置文件
if [ ! -f "config.json" ]; then
    echo -e "${RED}[警告] 未找到 config.json 配置文件${NC}"
    echo "请确保 config.json 文件存在于项目根目录"
    exit 1
fi

echo ""
echo -e "${GREEN}[✓] 所有检查通过，准备启动开发模式...${NC}"
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE} 开发模式说明（热加载）${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${GREEN}✅ 代码修改后自动重新编译和重启${NC}"
echo -e "${GREEN}✅ 无需手动运行 build 命令${NC}"
echo -e "${GREEN}✅ 实时查看代码更改效果${NC}"
echo -e "${GREEN}✅ 自动监听 src/ 目录下的所有文件${NC}"
echo ""
echo -e "${YELLOW}⚠️  注意：${NC}"
echo "  - 修改代码保存后会自动重启程序"
echo "  - 开发模式会占用更多资源"
echo "  - 按 Ctrl+C 可以随时停止"
echo ""
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${CYAN}[提示] 登录方式说明：${NC}"
echo ""
echo "  方式一：手动登录（推荐，默认方式）"
echo "  - 程序会打开浏览器并导航到 Twitter 登录页"
echo "  - 请在浏览器中手动输入您的账号密码"
echo "  - 登录成功后程序会自动继续"
echo ""
echo "  方式二：自动登录（可选）"
echo "  - 需要配置 .env 文件，填入账号密码"
echo "  - 查看 \"登录说明.md\" 了解详细配置方法"
echo ""
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}按 Enter 键启动开发模式（热加载）...${NC}"
read -r
echo ""

echo -e "${GREEN}[启动] 正在以开发模式启动程序...${NC}"
echo -e "${BLUE}[监听] 文件更改将自动触发重启${NC}"
echo ""
echo -e "${CYAN}========================================${NC}"
echo ""

# 启动开发模式（使用 ts-node-dev 实现热加载）
npm run dev

# 检查退出状态
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${RED}[错误] 程序执行出错${NC}"
    exit 1
fi

