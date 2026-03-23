#!/bin/bash
set -e

echo "======================================"
echo "  Image Background Remover - 部署脚本"
echo "======================================"

# 1. 部署 Cloudflare Worker
echo ""
echo "📦 [1/2] 部署 Cloudflare Worker..."
cd "$(dirname "$0")/../worker"
npm install
npx wrangler deploy
echo "✅ Worker 部署完成！"

# 2. 构建前端
echo ""
echo "🏗️  [2/2] 构建前端..."
cd "../frontend"
npm install
npm run build
echo "✅ 前端构建完成！产物在 frontend/out 目录"

echo ""
echo "======================================"
echo "  部署完成！"
echo "  下一步：将 frontend/out 上传到 Cloudflare Pages"
echo "  或在 Cloudflare Pages 控制台连接 GitHub 自动部署"
echo "======================================"
