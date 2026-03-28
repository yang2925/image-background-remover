export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // 路由分发
    if (path === '/api/user/sync' && request.method === 'POST') {
      return handleUserSync(request, env);
    }
    if (path === '/api/user/me' && request.method === 'GET') {
      return handleUserMe(request, env);
    }
    if (path === '/api/user/jobs' && request.method === 'GET') {
      return handleUserJobs(request, env);
    }
    if ((path === '/' || path === '/api/remove') && request.method === 'POST') {
      return handleRemoveBg(request, env);
    }

    return jsonError('Not found', 404);
  },
};

// ─────────────────────────────────────────────
// 用户登录时同步信息到 D1
// Body: { id, email, name, picture }
// ─────────────────────────────────────────────
async function handleUserSync(request: Request, env: Env): Promise<Response> {
  let body: { id: string; email: string; name?: string; picture?: string };
  try {
    body = await request.json() as any;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!body.id || !body.email) {
    return jsonError('Missing id or email', 400);
  }

  const now = Math.floor(Date.now() / 1000);

  // 检查用户是否需要重置月度额度
  const existing = await env.DB.prepare(
    'SELECT id, reset_at, used_this_month FROM users WHERE id = ?'
  ).bind(body.id).first<{ id: string; reset_at: number; used_this_month: number }>();

  if (!existing) {
    // 新用户：创建记录，reset_at 设为 30 天后
    const resetAt = now + 30 * 24 * 3600;
    await env.DB.prepare(`
      INSERT INTO users (id, email, name, picture, plan, monthly_credits, used_this_month, reset_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'free', 10, 0, ?, ?, ?)
    `).bind(body.id, body.email, body.name ?? '', body.picture ?? '', resetAt, now, now).run();
  } else {
    // 老用户：检查是否到了重置时间
    let usedThisMonth = existing.used_this_month;
    let resetAt = existing.reset_at;

    if (now >= existing.reset_at) {
      usedThisMonth = 0;
      resetAt = now + 30 * 24 * 3600;
    }

    await env.DB.prepare(`
      UPDATE users SET name = ?, picture = ?, used_this_month = ?, reset_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(body.name ?? '', body.picture ?? '', usedThisMonth, resetAt, now, body.id).run();
  }

  // 返回最新用户信息
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(body.id).first();
  return jsonOk({ user });
}

// ─────────────────────────────────────────────
// 获取当前用户信息
// Header: X-User-Id: <google sub>
// ─────────────────────────────────────────────
async function handleUserMe(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return jsonError('Unauthorized', 401);

  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
  if (!user) return jsonError('User not found', 404);

  return jsonOk({ user });
}

// ─────────────────────────────────────────────
// 获取历史记录（最近 20 条）
// Header: X-User-Id: <google sub>
// ─────────────────────────────────────────────
async function handleUserJobs(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return jsonError('Unauthorized', 401);

  const { results } = await env.DB.prepare(
    'SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(userId).all();

  return jsonOk({ jobs: results });
}

// ─────────────────────────────────────────────
// 去背主接口（带用量控制）
// Header: X-User-Id: <google sub>（可选，未登录也能用但不记录）
// ─────────────────────────────────────────────
async function handleRemoveBg(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');

  // 如果传了 userId，检查额度
  if (userId) {
    const now = Math.floor(Date.now() / 1000);
    const user = await env.DB.prepare(
      'SELECT id, monthly_credits, used_this_month, reset_at FROM users WHERE id = ?'
    ).bind(userId).first<{ id: string; monthly_credits: number; used_this_month: number; reset_at: number }>();

    if (user) {
      // 检查是否需要重置
      let usedThisMonth = user.used_this_month;
      if (now >= user.reset_at) {
        usedThisMonth = 0;
        const newResetAt = now + 30 * 24 * 3600;
        await env.DB.prepare(
          'UPDATE users SET used_this_month = 0, reset_at = ? WHERE id = ?'
        ).bind(newResetAt, userId).run();
      }

      // 检查额度
      if (usedThisMonth >= user.monthly_credits) {
        return jsonError('Monthly credit limit reached. Please upgrade your plan.', 429);
      }
    }
  }

  // 解析表单
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid form data', 400);
  }

  const file = formData.get('image') as File | null;
  if (!file || typeof file === 'string') return jsonError('No image provided', 400);
  if (file.size > 10 * 1024 * 1024) return jsonError('File too large. Maximum size is 10MB.', 413);

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return jsonError('Unsupported file type. Please upload JPG, PNG, or WebP.', 400);
  }

  // 调用 remove.bg
  const bgFormData = new FormData();
  bgFormData.append('image_file', file);
  bgFormData.append('size', 'auto');

  let response: Response;
  try {
    response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.REMOVE_BG_API_KEY },
      body: bgFormData,
    });
  } catch {
    return jsonError('Failed to connect to remove.bg API', 502);
  }

  if (!response.ok) {
    if (response.status === 402 || response.status === 429) {
      return jsonError('API quota exceeded. Please try again later.', 429);
    }
    const errText = await response.text().catch(() => 'Unknown error');
    return jsonError(`remove.bg error: ${errText}`, response.status);
  }

  // 成功：扣除额度 + 写入历史
  if (userId) {
    const jobId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await Promise.all([
      env.DB.prepare(
        'UPDATE users SET used_this_month = used_this_month + 1, updated_at = ? WHERE id = ?'
      ).bind(now, userId).run(),
      env.DB.prepare(
        'INSERT INTO jobs (id, user_id, status, created_at) VALUES (?, ?, ?, ?)'
      ).bind(jobId, userId, 'done', now).run(),
    ]);
  }

  const imageBuffer = await response.arrayBuffer();
  return new Response(imageBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="removed-bg.png"',
      ...corsHeaders(),
    },
  });
}

// ─── 工具函数 ───────────────────────────────
function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
  };
}

interface Env {
  REMOVE_BG_API_KEY: string;
  DB: D1Database;
}
