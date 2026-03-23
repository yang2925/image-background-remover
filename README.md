# Image Background Remover

一款在线图片背景去除工具，基于 Cloudflare Workers + remove.bg API 构建。

🔗 **Demo**: https://your-domain.pages.dev

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + TailwindCSS |
| 后端 | Cloudflare Workers |
| AI 引擎 | remove.bg API |
| 部署 | Cloudflare Pages + Workers |

## 特点

- ✅ 无需注册，上传即用
- ✅ 图片不落盘，全程内存处理
- ✅ 支持 JPG、PNG、WebP，最大 10MB
- ✅ 响应式，支持手机端

---

## 本地开发

### 1. Worker（后端）

```bash
cd worker
npm install
# 配置 API Key
wrangler secret put REMOVE_BG_API_KEY
# 本地开发
npm run dev
```

### 2. Frontend（前端）

```bash
cd frontend
npm install
# 修改 .env.local 中的 NEXT_PUBLIC_WORKER_URL
npm run dev
```

前端访问：http://localhost:3000

---

## 部署

### Worker 部署

```bash
cd worker
npm run deploy
```

部署后获得 Worker URL，填入前端环境变量。

### 前端部署（Cloudflare Pages）

1. 将代码推送到 GitHub
2. Cloudflare Pages → 新建项目 → 连接 GitHub
3. 构建配置：
   - **根目录**：`frontend`
   - **构建命令**：`npm run build`
   - **输出目录**：`.next`
4. 环境变量：`NEXT_PUBLIC_WORKER_URL=https://your-worker.workers.dev`

---

## 环境变量

| 变量 | 位置 | 说明 |
|------|------|------|
| `REMOVE_BG_API_KEY` | Worker Secret | remove.bg API Key |
| `NEXT_PUBLIC_WORKER_URL` | Pages 环境变量 | Worker 地址 |

---

## 获取 remove.bg API Key

1. 注册：https://www.remove.bg/
2. 进入 API 页面：https://www.remove.bg/api
3. 免费额度：50 次/月

---

## License

MIT
