#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}     Twitter 自动清理工具安装器${NC}"
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
npm --version

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}步骤 1/3: 安装项目依赖${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

npm install
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] 依赖安装失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[✓] 依赖安装成功${NC}"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}步骤 2/3: 安装 Playwright 浏览器${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "${YELLOW}这将下载约 240 MB 的浏览器文件，请稍候...${NC}"
echo ""

npx playwright install chromium
if [ $? -ne 0 ]; then
    echo -e "${RED}[错误] Playwright 浏览器安装失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}[✓] Playwright 浏览器安装成功${NC}"
echo ""

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}步骤 3/3: 编译 TypeScript 代码${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

npm run build
if [ $? -ne 0 ]; then
    echo -e "${YELLOW}[警告] 编译失败，但可以使用 ts-node 运行${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}[✓] 安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "后续步骤："
echo "1. 检查并配置 config.json 文件"
echo "2. （可选）复制 env.example 为 .env 并配置登录信息"
echo "3. 运行 ./start.sh 启动程序"
echo ""




