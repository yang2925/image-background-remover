'use client';
import { useState, useCallback, useRef } from 'react';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://your-worker.workers.dev';

type State = 'idle' | 'loading' | 'done' | 'error';

export default function Home() {
  const [state, setState] = useState<State>('idle');
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    // 格式校验
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('请上传 JPG、PNG 或 WebP 格式的图片');
      setState('error');
      return;
    }
    // 大小校验 10MB
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
  }, []);

  // 拖拽处理
  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // 重置
  const reset = () => {
    setState('idle');
    setOriginal(null);
    setResult(null);
    setErrorMsg('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center pt-16 pb-20 px-4">

      {/* 顶部标题 */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
          🖼️ Background Remover
        </h1>
        <p className="text-lg text-gray-500">
          上传图片，一键去除背景，下载透明 PNG — 免费使用
        </p>
      </div>

      {/* 上传区域 */}
      {state === 'idle' && (
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
      {state === 'error' && (
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
      {state === 'loading' && (
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
      {state === 'done' && original && result && (
        <div className="w-full max-w-3xl">
          {/* 对比图 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 原图 */}
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">原图</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full">
                <img src={original} alt="原图" className="w-full object-contain max-h-72" />
              </div>
            </div>
            {/* 处理后 */}
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">处理后</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full bg-checkered">
                <img src={result} alt="处理后" className="w-full object-contain max-h-72" />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
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
      {state === 'idle' && (
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
        🔒 我们不存储您的图片，处理完成后立即释放内存 · Powered by remove.bg
      </footer>
    </main>
  );
}
