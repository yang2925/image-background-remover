'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState('正在登录...');

  useEffect(() => {
    // Google redirect 回调：URL fragment 里有 id_token
    // 格式: /auth/callback#id_token=xxx&...
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');

    if (!idToken) {
      setStatus('登录失败，未获取到凭证');
      setTimeout(() => router.push('/'), 2000);
      return;
    }

    try {
      // 解析 JWT payload（不验证签名，仅取用户信息）
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      const userData = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      };

      // 同步到 Worker
      fetch(`${WORKER_URL}/api/user/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })
        .then(r => r.json())
        .then((data: any) => {
          const user = data.user || userData;
          localStorage.setItem('google_user', JSON.stringify(user));
          setStatus('登录成功，正在跳转...');
          // 跳回来源页面，默认首页
          const returnTo = sessionStorage.getItem('auth_return_to') || '/';
          sessionStorage.removeItem('auth_return_to');
          router.push(returnTo);
        })
        .catch(() => {
          // 即使同步失败也保存本地并跳转
          localStorage.setItem('google_user', JSON.stringify(userData));
          router.push('/');
        });
    } catch {
      setStatus('登录失败，请重试');
      setTimeout(() => router.push('/'), 2000);
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="text-4xl mb-4">🔐</div>
        <p className="text-gray-600 text-lg">{status}</p>
      </div>
    </div>
  );
}
