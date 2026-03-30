export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ─── 原有路由 ───────────────────────────────
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

    // ─── PayPal 路由 ────────────────────────────
    if (path === '/api/paypal/create-order' && request.method === 'POST') {
      return handleCreateOrder(request, env);
    }
    if (path === '/api/paypal/capture-order' && request.method === 'POST') {
      return handleCaptureOrder(request, env);
    }
    if (path === '/api/paypal/create-subscription' && request.method === 'POST') {
      return handleCreateSubscription(request, env);
    }
    if (path === '/api/paypal/subscription-webhook' && request.method === 'POST') {
      return handleSubscriptionWebhook(request, env);
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

  const existing = await env.DB.prepare(
    'SELECT id, reset_at, used_this_month FROM users WHERE id = ?'
  ).bind(body.id).first<{ id: string; reset_at: number; used_this_month: number }>();

  if (!existing) {
    const resetAt = now + 30 * 24 * 3600;
    await env.DB.prepare(`
      INSERT INTO users (id, email, name, picture, plan, monthly_credits, used_this_month, reset_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'free', 10, 0, ?, ?, ?)
    `).bind(body.id, body.email, body.name ?? '', body.picture ?? '', resetAt, now, now).run();
  } else {
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

  const jobs = await env.DB.prepare(
    'SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).bind(userId).all();

  return jsonOk({ jobs: jobs.results });
}

// ─────────────────────────────────────────────
// 抠图主逻辑
// ─────────────────────────────────────────────
async function handleRemoveBg(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');

  if (userId) {
    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<any>();
    if (!user) return jsonError('User not found', 404);

    // 总可用额度 = 月度额度 + 购买积分
    const totalCredits = (user.monthly_credits as number) + (user.purchased_credits as number ?? 0);
    if ((user.used_this_month as number) >= totalCredits) {
      return jsonError('Credit limit reached. Please purchase more credits or upgrade your plan.', 429);
    }
  }

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

// ═══════════════════════════════════════════════
// PayPal 积分包 - 创建一次性订单
// POST /api/paypal/create-order
// Header: X-User-Id
// Body: { planId: "starter" | "popular" | "pro-pack" }
// ═══════════════════════════════════════════════
const CREDIT_PLANS: Record<string, { price: string; credits: number; name: string }> = {
  'starter':  { price: '4.99',  credits: 10, name: 'Starter' },
  'popular':  { price: '12.99', credits: 30, name: 'Popular' },
  'pro-pack': { price: '29.99', credits: 80, name: 'Pro Pack' },
};

async function getPayPalAccessToken(env: Env): Promise<string> {
  const credentials = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res = await fetch(`${env.PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json() as any;
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

async function handleCreateOrder(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return jsonError('Unauthorized', 401);

  let body: { planId: string };
  try {
    body = await request.json() as any;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const plan = CREDIT_PLANS[body.planId];
  if (!plan) return jsonError('Invalid plan', 400);

  let accessToken: string;
  try {
    accessToken = await getPayPalAccessToken(env);
  } catch {
    return jsonError('PayPal auth failed', 502);
  }

  const res = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: { currency_code: 'USD', value: plan.price },
        description: `BG Remover - ${plan.name} Credits Pack`,
        custom_id: `${userId}:${body.planId}`,
      }],
    }),
  });

  const order = await res.json() as any;
  if (!order.id) return jsonError('Failed to create PayPal order', 502);

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO orders (id, user_id, plan_id, billing_type, amount, status, created_at, updated_at)
     VALUES (?, ?, ?, 'one_time', ?, 'pending', ?, ?)`
  ).bind(order.id, userId, body.planId, plan.price, now, now).run();

  return jsonOk({ orderID: order.id });
}

// ═══════════════════════════════════════════════
// PayPal 积分包 - 确认收款并加积分
// POST /api/paypal/capture-order
// Header: X-User-Id
// Body: { orderID: string }
// ═══════════════════════════════════════════════
async function handleCaptureOrder(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return jsonError('Unauthorized', 401);

  let body: { orderID: string };
  try {
    body = await request.json() as any;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  let accessToken: string;
  try {
    accessToken = await getPayPalAccessToken(env);
  } catch {
    return jsonError('PayPal auth failed', 502);
  }

  const res = await fetch(`${env.PAYPAL_BASE_URL}/v2/checkout/orders/${body.orderID}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const capture = await res.json() as any;
  if (capture.status !== 'COMPLETED') {
    return jsonError('Payment not completed', 400);
  }

  // 从 custom_id 解析 planId
  const customId: string = capture.purchase_units?.[0]?.payments?.captures?.[0]?.custom_id ?? '';
  const [, planId] = customId.split(':');
  const plan = CREDIT_PLANS[planId];
  if (!plan) return jsonError('Plan not found in capture', 400);

  const now = Math.floor(Date.now() / 1000);
  await Promise.all([
    env.DB.prepare(
      `UPDATE users SET purchased_credits = purchased_credits + ?, updated_at = ? WHERE id = ?`
    ).bind(plan.credits, now, userId).run(),
    env.DB.prepare(
      `UPDATE orders SET status = 'completed', updated_at = ? WHERE id = ?`
    ).bind(now, body.orderID).run(),
  ]);

  return jsonOk({ success: true, creditsAdded: plan.credits });
}

// ═══════════════════════════════════════════════
// PayPal 月订阅 - 创建订阅
// POST /api/paypal/create-subscription
// Header: X-User-Id
// Body: { planId: "basic" | "pro" }
// ═══════════════════════════════════════════════
async function handleCreateSubscription(request: Request, env: Env): Promise<Response> {
  const userId = request.headers.get('X-User-Id');
  if (!userId) return jsonError('Unauthorized', 401);

  let body: { planId: string };
  try {
    body = await request.json() as any;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const planIdMap: Record<string, string> = {
    'basic': env.PAYPAL_PLAN_ID_BASIC,
    'pro':   env.PAYPAL_PLAN_ID_PRO,
  };
  const creditsMap: Record<string, number> = {
    'basic': 25,
    'pro':   60,
  };

  const paypalPlanId = planIdMap[body.planId];
  if (!paypalPlanId) return jsonError('Invalid subscription plan', 400);

  let accessToken: string;
  try {
    accessToken = await getPayPalAccessToken(env);
  } catch {
    return jsonError('PayPal auth failed', 502);
  }

  const res = await fetch(`${env.PAYPAL_BASE_URL}/v1/billing/subscriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plan_id: paypalPlanId,
      custom_id: `${userId}:${body.planId}`,
      application_context: {
        brand_name: 'BG Remover',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: 'https://imagebackgroudremover.shop/pricing?sub=success',
        cancel_url: 'https://imagebackgroudremover.shop/pricing?sub=cancel',
      },
    }),
  });

  const subscription = await res.json() as any;
  if (!subscription.id) return jsonError('Failed to create subscription', 502);

  const approvalUrl = subscription.links?.find((l: any) => l.rel === 'approve')?.href;

  return jsonOk({
    subscriptionID: subscription.id,
    approvalUrl,
  });
}

// ═══════════════════════════════════════════════
// PayPal Webhook - 订阅状态回调
// POST /api/paypal/subscription-webhook
// ═══════════════════════════════════════════════
async function handleSubscriptionWebhook(request: Request, env: Env): Promise<Response> {
  let event: any;
  try {
    event = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const eventType: string = event.event_type ?? '';
  const now = Math.floor(Date.now() / 1000);

  // 订阅激活：给用户升级 plan
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const customId: string = event.resource?.custom_id ?? '';
    const [userId, planId] = customId.split(':');
    const creditsMap: Record<string, number> = { basic: 25, pro: 60 };
    const credits = creditsMap[planId];

    if (userId && credits) {
      const expiresAt = now + 32 * 24 * 3600; // 32天缓冲
      await env.DB.prepare(
        `UPDATE users
         SET subscription_plan = ?, subscription_expires_at = ?,
             monthly_credits = ?, used_this_month = 0, updated_at = ?
         WHERE id = ?`
      ).bind(planId, expiresAt, credits, now, userId).run();

      // 记录订单
      const subId: string = event.resource?.id ?? crypto.randomUUID();
      await env.DB.prepare(
        `INSERT OR REPLACE INTO orders (id, user_id, plan_id, billing_type, amount, status, paypal_subscription_id, created_at, updated_at)
         VALUES (?, ?, ?, 'subscription', '0', 'completed', ?, ?, ?)`
      ).bind(subId, userId, planId, subId, now, now).run();
    }
  }

  // 订阅取消或过期：降回免费计划
  if (
    eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
    eventType === 'BILLING.SUBSCRIPTION.EXPIRED' ||
    eventType === 'BILLING.SUBSCRIPTION.SUSPENDED'
  ) {
    const customId: string = event.resource?.custom_id ?? '';
    const [userId] = customId.split(':');
    if (userId) {
      await env.DB.prepare(
        `UPDATE users
         SET subscription_plan = NULL, subscription_expires_at = NULL,
             monthly_credits = 10, updated_at = ?
         WHERE id = ?`
      ).bind(now, userId).run();
    }
  }

  return jsonOk({ received: true });
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
  // PayPal
  PAYPAL_BASE_URL: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_PLAN_ID_BASIC: string;
  PAYPAL_PLAN_ID_PRO: string;
}
