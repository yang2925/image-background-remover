'use client';
import { useState, useCallback, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://your-worker.workers.dev';

type State = 'idle' | 'loading' | 'done' | 'error';

export default function Home() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';

  const [state, setState] = useState<State>('idle');
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!session) return;

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
      const res = await fetch(WORKER_URL, { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = '处理失败，请重试';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {}
        if (res.status === 429) msg = '服务繁忙，请稍后再试';
        if (res.status === 413) msg = '图片大小不能超过 10MB';
        throw new Error(msg);
      }
      const blob = await res.blob();
      setResult(URL.createObjectURL(blob));
      setState('done');
    } catch (e: any) {
      setErrorMsg(e.message || '网络异常，请检查后重试');
      setState('error');
    }
  }, [session]);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setState('idle');
    setOriginal(null);
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center pt-16 pb-20 px-4">

      {/* 顶部导航栏 */}
      <div className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-bold text-gray-800 text-sm">🖼️ Background Remover</span>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : session ? (
              <>
                {session.user?.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || '用户头像'}
                    width={32}
                    height={32}
                    className="rounded-full border border-gray-200"
                  />
                )}
                <span className="text-sm text-gray-700 hidden sm:block">{session.user?.name}</span>
                <button
                  onClick={() => signOut()}
                  className="text-sm text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                  退出
                </button>
              </>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="flex items-center gap-2 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-medium text-sm px-4 py-2 rounded-lg shadow-sm hover:shadow transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                使用 Google 登录
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 顶部标题 */}
      <div className="text-center mb-10 mt-6">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          🖼️ Background Remover
        </h1>
        <p className="text-lg text-gray-500">
          上传图片，一键去除背景，下载透明 PNG — 免费使用
        </p>
      </div>

      {/* 未登录提示 */}
      {!isLoading && !session && (
        <div className="w-full max-w-xl">
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-16 flex flex-col items-center bg-gray-50/50">
            <div className="text-5xl mb-4">🔐</div>
            <p className="text-gray-700 font-semibold text-lg mb-2">请先登录以使用去背功能</p>
            <p className="text-gray-400 text-sm mb-6">使用 Google 账号登录，完全免费</p>
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 bg-white border border-gray-300 hover:border-blue-400 text-gray-700 font-medium px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              使用 Google 登录
            </button>
          </div>
        </div>
      )}

      {/* 已登录：上传区域 */}
      {session && state === 'idle' && (
        <div
          className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-16 flex flex-col items-center cursor-pointer transition-all duration-200
            ${dragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="text-6xl mb-5">📁</div>
          <p className="text-gray-700 font-semibold text-lg mb-1">点击或拖拽上传图片</p>
          <p className="text-gray-400 text-sm">支持 JPG · PNG · WebP，最大 10MB</p>
        </div>
      )}

      {/* 错误提示 */}
      {session && state === 'error' && (
        <div className="w-full max-w-xl">
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-4 text-sm mb-4 flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={reset}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition"
          >
            重新上传
          </button>
        </div>
      )}

      {/* Loading 状态 */}
      {session && state === 'loading' && (
        <div className="flex flex-col items-center gap-4 mt-4">
          {original && (
            <img src={original} alt="原图" className="max-w-xs w-full rounded-xl shadow-md opacity-60" />
          )}
          <div className="flex flex-col items-center gap-3 mt-2">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-500 font-medium">正在去除背景，请稍候...</p>
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {session && state === 'done' && original && result && (
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
            <a
              href={result}
              download="removed-bg.png"
              className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition shadow-sm"
            >
              ⬇️ 下载 PNG
            </a>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-600 font-medium px-8 py-3 rounded-xl transition"
            >
              🔄 重新上传
            </button>
          </div>
        </div>
      )}

      {/* 特性说明 */}
      {!session && !isLoading && (
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl text-center">
          {[
            { icon: '⚡', title: '秒级处理', desc: '上传即处理，无需等待' },
            { icon: '🔒', title: '隐私安全', desc: '图片不存储，处理后即释放' },
            { icon: '🆓', title: '完全免费', desc: '基础功能永久免费使用' },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="text-3xl mb-2">{f.icon}</div>
              <div className="font-semibold text-gray-800 mb-1">{f.title}</div>
              <div className="text-sm text-gray-500">{f.desc}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 text-gray-400 text-xs text-center">
        🔒 我们不存���您的图片，处理完成后立即释放内存 · Powered by remove.bg
      </footer>
    </main>
  );
}
