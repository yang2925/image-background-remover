import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const WORKER_URL = process.env.WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // 转发到 Cloudflare Worker（服务器端调用，不受 GFW 影响）
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errorMsg = '处理失败，请重试';
      try {
        const data = await response.json();
        errorMsg = data.error || errorMsg;
      } catch {}
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const imageBuffer = await response.arrayBuffer();
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    console.error('Proxy error:', e);
    return NextResponse.json({ error: '服务器代理异常，请稍后重试' }, { status: 500 });
  }
}
