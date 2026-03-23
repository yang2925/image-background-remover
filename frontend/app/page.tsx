'use client';
import { useState, useCallback } from 'react';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://your-worker.workers.dev';

export default function Home() {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    // Validate format
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('请上传 JPG、PNG 或 WebP 格式的图片');
      return;
    }
    // Validate size
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过 10MB');
      return;
    }

    setError(null);
    setResult(null);
    setOriginal(URL.createObjectURL(file));
    setLoading(true);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(WORKER_URL, { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '处理失败，请重试');
      }
      const blob = await res.blob();
      setResult(URL.createObjectURL(blob));
    } catch (e: any) {
      setError(e.message || '网络异常，请检查后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const reset = () => {
    setOriginal(null);
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center py-16 px-4">
      {/* Header */}
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Background Remover</h1>
      <p className="text-gray-500 mb-10">上传图片，一键去除背景，免费使用</p>

      {/* Upload Area */}
      {!original && (
        <label
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-16 flex flex-col items-center cursor-pointer transition
            ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 bg-white'}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <span className="text-5xl mb-4">📁</span>
          <p className="text-gray-600 font-medium">点击或拖拽上传图片</p>
          <p className="text-gray-400 text-sm mt-1">支持 JPG、PNG、WebP，最大 10MB</p>
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="mt-8 flex flex-col items-center text-blue-500">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p>正在处理中，请稍候...</p>
        </div>
      )}

      {/* Preview */}
      {original && !loading && (
        <div className="mt-8 flex flex-col items-center gap-6 w-full max-w-3xl">
          <div className="flex flex-col md:flex-row gap-6 w-full justify-center">
            <div className="flex flex-col items-center">
              <p className="text-sm text-gray-500 mb-2 font-medium">原图</p>
              <img src={original} alt="原图" className="max-w-xs w-full rounded-xl shadow" />
            </div>
            {result && (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500 mb-2 font-medium">处理后</p>
                <img
                  src={result}
                  alt="处理后"
                  className="max-w-xs w-full rounded-xl shadow"
                  style={{ background: 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 20px 20px' }}
                />
                <a
                  href={result}
                  download="removed-bg.png"
                  className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition"
                >
                  ⬇️ 下载 PNG
                </a>
              </div>
            )}
          </div>
          <button onClick={reset} className="text-gray-400 hover:text-gray-600 text-sm underline">
            重新上传
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 text-gray-400 text-xs text-center">
        🔒 我们不存储您的图片，处理完成后立即释放
      </footer>
    </main>
  );
}
