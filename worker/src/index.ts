export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // 只允许 POST
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonError('Invalid form data', 400);
    }

    const file = formData.get('image') as File | null;

    // 校验是否有文件
    if (!file || typeof file === 'string') {
      return jsonError('No image provided', 400);
    }

    // 校验文件大小 ≤ 10MB
    if (file.size > 10 * 1024 * 1024) {
      return jsonError('File too large. Maximum size is 10MB.', 413);
    }

    // 校验文件格式
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return jsonError('Unsupported file type. Please upload JPG, PNG, or WebP.', 400);
    }

    // 转发给 remove.bg API
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

    // remove.bg 返回错误
    if (!response.ok) {
      if (response.status === 402 || response.status === 429) {
        return jsonError('API quota exceeded. Please try again later.', 429);
      }
      const errText = await response.text().catch(() => 'Unknown error');
      return jsonError(`remove.bg error: ${errText}`, response.status);
    }

    // 成功，直接将图片流返回给客户端
    const imageBuffer = await response.arrayBuffer();
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="removed-bg.png"',
        ...corsHeaders(),
      },
    });
  },
};

/** 返回带 CORS 头的 JSON 错误响应 */
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

/** CORS 响应头 */
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

interface Env {
  REMOVE_BG_API_KEY: string;
}
