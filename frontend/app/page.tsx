'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import Image from 'next/image';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

type State = 'idle' | 'loading' | 'done' | 'error';

interface UserInfo {
  id: string;
  name: string;
  email: string;
  picture: string;
  plan: string;
  monthly_credits: number;
  used_this_month: number;
  reset_at: number;
}

interface Job {
  id: string;
  status: string;
  created_at: number;
}

declare global {
  interface Window {
    google: any;
    handleGoogleSignIn: (response: any) => void;
  }
}

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [state, setState] = useState<State>('idle');
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步用户信息到 D1
  const syncUser = useCallback(async (rawUser: { id: string; email: string; name: string; picture: string }) => {
    try {
      const res = await fetch(`${WORKER_URL}/api/user/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawUser),
      });
      const data = await res.json() as { user: UserInfo };
      setUser(data.user);
      localStorage.setItem('google_user', JSON.stringify(data.user));
    } catch {
      // 降级：用本地数据
      setUser(rawUser as any);
    }
  }, []);

  // 从 localStorage 恢复登录状态
  useEffect(() => {
    const saved = localStorage.getItem('google_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        // 后台刷新用量数据
        fetch(`${WORKER_URL}/api/user/me`, {
          headers: { 'X-User-Id': u.id },
        }).then(r => r.json()).then((data: any) => {
          if (data.user) {
            setUser(data.user);
            localStorage.setItem('google_user', JSON.stringify(data.user));
          }
        }).catch(() => {});
      } catch {}
    }
    setAuthLoading(false);
  }, []);

  // 加载 Google Identity Services
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.handleGoogleSignIn = async (response: any) => {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      await syncUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
    };
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [syncUser]);

  const handleSignOut = () => {
    setUser(null);
    setShowProfile(false);
    localStorage.removeItem('google_user');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  };

  // 打开个人中心时加载历史
  const openProfile = async () => {
    setShowProfile(true);
    if (!user) return;
    setJobsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/user/jobs`, {
        headers: { 'X-User-Id': user.id },
      });
      const data = await res.json() as { jobs: Job[] };
      setJobs(data.jobs || []);
    } catch {}
    setJobsLoading(false);
  };

  const handleFile = useCallback(async (file: File) => {
    if (!user) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('请上传 JPG、PNG 或 WebP 格式的图片');
      setState('error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('图片大小不能超过 10MB');
      setState('error');
      return;
    }
    setOriginal(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg('');
    setState('loading');

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'X-User-Id': user.id },
        body: formData,
      });
      if (!res.ok) {
        let msg = '处理失败，请重试';
        try { const d = await res.json() as any; msg = d.error || msg; } catch {}
        if (res.status === 429) msg = '本月免费次数已用完，请升级套餐';
        if (res.status === 413) msg = '图片大小不能超过 10MB';
        throw new Error(msg);
      }
      const blob = await res.blob();
      setResult(URL.createObjectURL(blob));
      setState('done');
      // 更新本地用量
      setUser(prev => prev ? { ...prev, used_this_month: prev.used_this_month + 1 } : prev);
    } catch (e: any) {
      setErrorMsg(e.message || '网络异常，请检查后重试');
      setState('error');
    }
  }, [user]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const reset = () => {
    setState('idle'); setOriginal(null); setResult(null); setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const remaining = user ? Math.max(0, user.monthly_credits - user.used_this_month) : 0;
  const resetDate = user ? new Date(user.reset_at * 1000).toLocaleDateString('zh-CN') : '';

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center pt-16 pb-20 px-4">

      {/* Google GSI 初始化 */}
      {!authLoading && !user && GOOGLE_CLIENT_ID && (
        <div id="g_id_onload" data-client_id={GOOGLE_CLIENT_ID}
          data-callback="handleGoogleSignIn" data-auto_prompt="false" />
      )}

      {/* 顶部导航栏 */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-800 text-sm">🖼️ Background Remover</span>
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <button onClick={openProfile} className="flex items-center gap-2 hover:bg-gray-50 px-2 py-1 rounded-lg transition">
                {user.picture && (
                  <Image src={user.picture} alt={user.name} width={32} height={32}
                    className="rounded-full border border-gray-200" unoptimized />
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-800">{user.name}</div>
                  <div className="text-xs text-gray-400">剩余 {remaining} 次</div>
                </div>
              </button>
            ) : (
              <div className="g_id_signin" data-type="standard" data-shape="rectangular"
                data-theme="outline" data-text="signin_with" data-size="medium" data-locale="zh_CN" />
            )}
          </div>
        </div>
      </div>

      {/* 个人中心弹窗 */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 头部 */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="flex items-center gap-4">
                {user.picture && (
                  <Image src={user.picture} alt={user.name} width={56} height={56}
                    className="rounded-full border-2 border-white/50" unoptimized />
                )}
                <div>
                  <div className="font-bold text-lg">{user.name}</div>
                  <div className="text-blue-100 text-sm">{user.email}</div>
                  <div className="mt-1">
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                      {user.plan === 'free' ? '免费版' : '专业版'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 用量 */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">本月用量</span>
                <span className="text-sm text-gray-500">{user.used_this_month} / {user.monthly_credits} 次</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (user.used_this_month / user.monthly_credits) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                剩余 <span className="text-blue-500 font-medium">{remaining} 次</span>，{resetDate} 重置
              </div>
            </div>

            {/* 历史记录 */}
            <div className="p-5 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-3">处理历史</div>
              {jobsLoading ? (
                <div className="text-center py-4 text-gray-400 text-sm">加载中...</div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">暂无处理记录</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${job.status === 'done' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-gray-600">去背处理</span>
                      </div>
                      <span className="text-gray-400 text-xs">
                        {new Date(job.created_at * 1000).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="p-5 flex gap-3">
              <button onClick={handleSignOut}
                className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">
                退出登录
              </button>
              <button onClick={() => setShowProfile(false)}
                className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 顶部标题 */}
      <div className="text-center mb-10 mt-6">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          🖼️ Background Remover
        </h1>
        <p className="text-lg text-gray-500">上传图片，一键去除背景，下载透明 PNG — 免费使用</p>
      </div>

      {/* 未登录提示 */}
      {!authLoading && !user && (
        <div className="w-full max-w-xl">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center bg-gray-50/50">
            <div className="text-5xl mb-4">🔐</div>
            <p className="text-gray-700 font-semibold text-lg mb-2">请先登录以使用去背功能</p>
            <p className="text-gray-400 text-sm mb-6">使用 Google 账号登录，每月免费 10 次</p>
            <div className="g_id_signin" data-type="standard" data-shape="rectangular"
              data-theme="outline" data-text="signin_with" data-size="large" data-locale="zh_CN" />
          </div>
        </div>
      )}

      {/* 已登录：上传区域 */}
      {user && state === 'idle' && (
        <div
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-16 flex flex-col items-center cursor-pointer transition-all duration-200
            ${remaining === 0 ? 'border-red-200 bg-red-50/30' : dragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}`}
          onDragOver={remaining > 0 ? onDragOver : undefined}
          onDragLeave={onDragLeave} onDrop={remaining > 0 ? onDrop : undefined}
          onClick={() => remaining > 0 && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {remaining === 0 ? (
            <>
              <div className="text-5xl mb-4">😢</div>
              <p className="text-red-500 font-semibold text-lg mb-1">本月次数已用完</p>
              <p className="text-gray-400 text-sm">{resetDate} 自动重置</p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-5">📁</div>
              <p className="text-gray-700 font-semibold text-lg mb-1">点击或拖拽上传图片</p>
              <p className="text-gray-400 text-sm">支持 JPG · PNG · WebP，最大 10MB</p>
              <p className="text-blue-400 text-xs mt-3">本月剩余 {remaining} 次</p>
            </>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {user && state === 'error' && (
        <div className="w-full max-w-xl">
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-4 text-sm mb-4 flex items-center gap-2">
            <span>⚠️</span><span>{errorMsg}</span>
          </div>
          <button onClick={reset}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition">
            重新上传
          </button>
        </div>
      )}

      {/* Loading */}
      {user && state === 'loading' && (
        <div className="flex flex-col items-center gap-4 mt-4">
          {original && <img src={original} alt="原图" className="max-w-xs w-full rounded-xl shadow-md opacity-60" />}
          <div className="flex flex-col items-center gap-3 mt-2">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-500 font-medium">正在去除背景，请稍候...</p>
          </div>
        </div>
      )}

      {/* 结果 */}
      {user && state === 'done' && original && result && (
        <div className="w-full max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">原图</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full">
                <img src={original} alt="原图" className="w-full object-contain max-h-72" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">处理后</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full bg-checkered">
                <img src={result} alt="处理后" className="w-full object-contain max-h-72" />
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={result} download="removed-bg.png"
              className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition shadow-sm">
              ⬇️ 下载 PNG
            </a>
            <button onClick={reset}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-600 font-medium px-8 py-3 rounded-xl transition">
              🔄 重新上传
            </button>
          </div>
        </div>
      )}

      {/* 特性说明 */}
      {!user && !authLoading && (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-center">
          {[
            { icon: '⚡', title: '秒级处理', desc: '上传即处理，无需等待' },
            { icon: '🔒', title: '隐私安全', desc: '图片不存储，处理后即释放' },
            { icon: '🆓', title: '每月10次', desc: '注册即享免费额度' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold text-gray-800 mb-1">{f.title}</div>
              <div className="text-sm text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-16 text-gray-400 text-xs text-center">
        🔒 我们不存储您的图片，处理完成后立即释放内存 · Powered by remove.bg
      </footer>
    </main>
  );
}
