'use client';
import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';

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

interface Props {
  user: UserInfo;
  onUsed: () => void;
}

export default function Tool({ user, onUsed }: Props) {
  const [state, setState] = useState<State>('idle');
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remaining = Math.max(0, user.monthly_credits - user.used_this_month);
  const resetDate = new Date(user.reset_at * 1000).toLocaleDateString('zh-CN');

  const handleFile = useCallback(async (file: File) => {
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
      onUsed();
    } catch (e: any) {
      setErrorMsg(e.message || '网络异常，请检查后重试');
      setState('error');
    }
  }, [user, onUsed]);

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

  if (remaining === 0) {
    return (
      <div className="w-full max-w-xl border-2 border-dashed border-red-200 rounded-2xl p-12 flex flex-col items-center bg-red-50/30 text-center">
        <div className="text-5xl mb-4">😢</div>
        <p className="text-red-500 font-semibold text-lg mb-1">本月次数已用完</p>
        <p className="text-gray-400 text-sm mb-5">{resetDate} 自动重置，或升级套餐立即继续使用</p>
        <a href="#pricing" className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition">
          🚀 升级 Pro
        </a>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl">
      {state === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center cursor-pointer transition-all duration-200
            ${dragging ? 'border-blue-500 bg-blue-50 scale-105' : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'}`}
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div className="text-6xl mb-5">📁</div>
          <p className="text-gray-700 font-semibold text-lg mb-1">点击或拖拽上传图片</p>
          <p className="text-gray-400 text-sm">支持 JPG · PNG · WebP，最大 10MB</p>
          <p className="text-blue-400 text-xs mt-3">本月剩余 {remaining} 次</p>
        </div>
      )}

      {state === 'error' && (
        <div>
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-5 py-4 text-sm mb-4 flex items-center gap-2">
            <span>⚠️</span><span>{errorMsg}</span>
          </div>
          <button onClick={reset} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-2xl text-gray-500 hover:border-blue-400 hover:text-blue-500 transition">
            重新上传
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4">
          {original && <img src={original} alt="原图" className="max-w-xs w-full rounded-xl shadow-md opacity-60" />}
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-500 font-medium">正在去除背景，请稍候...</p>
        </div>
      )}

      {state === 'done' && original && result && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">原图</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full">
                <img src={original} alt="原图" className="w-full object-contain max-h-72" />
              </div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 font-medium mb-2 uppercase tracking-wide">处理后</p>
              <div className="rounded-2xl overflow-hidden shadow-md w-full" style={{backgroundImage:'repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)', backgroundSize:'16px 16px'}}>
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
    </div>
  );
}
