'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Tool from './components/Tool';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

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
  interface Window { google: any; handleGoogleSignIn: (r: any) => void; }
}

export default function Home() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const syncUser = useCallback(async (raw: { id: string; email: string; name: string; picture: string }) => {
    try {
      const res = await fetch(`${WORKER_URL}/api/user/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(raw),
      });
      const data = await res.json() as { user: UserInfo };
      setUser(data.user);
      localStorage.setItem('google_user', JSON.stringify(data.user));
    } catch { setUser(raw as any); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('google_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setUser(u);
        fetch(`${WORKER_URL}/api/user/me`, { headers: { 'X-User-Id': u.id } })
          .then(r => r.json()).then((d: any) => {
            if (d.user) { setUser(d.user); localStorage.setItem('google_user', JSON.stringify(d.user)); }
          }).catch(() => {});
      } catch {}
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.handleGoogleSignIn = async (response: any) => {
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      await syncUser({ id: payload.sub, email: payload.email, name: payload.name, picture: payload.picture });
    };
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true; script.defer = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, [syncUser]);

  const handleSignOut = () => {
    setUser(null); setShowProfile(false);
    localStorage.removeItem('google_user');
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  };

  const openProfile = async () => {
    setShowProfile(true);
    if (!user) return;
    setJobsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/user/jobs`, { headers: { 'X-User-Id': user.id } });
      const data = await res.json() as { jobs: Job[] };
      setJobs(data.jobs || []);
    } catch {}
    setJobsLoading(false);
  };

  const handleUsed = () => {
    setUser(prev => prev ? { ...prev, used_this_month: prev.used_this_month + 1 } : prev);
  };

  const remaining = user ? Math.max(0, user.monthly_credits - user.used_this_month) : 0;
  const resetDate = user ? new Date(user.reset_at * 1000).toLocaleDateString('zh-CN') : '';

  const features = [
    { icon: '⚡', title: '秒级处理', desc: 'AI 驱动，上传即处理，5秒内完成去背，无需等待' },
    { icon: '🎯', title: '精准抠图', desc: '边缘识别精准，发丝、透明材质都能完美处理' },
    { icon: '🔒', title: '隐私安全', desc: '图片处理完成后立即释放，我们不存储您的任何图片' },
    { icon: '📱', title: '全平台支持', desc: '支持桌面和移动端，随时随地在线去背' },
    { icon: '🖼️', title: '多格式支持', desc: '支持 JPG、PNG、WebP，输出高质量透明 PNG' },
    { icon: '🆓', title: '免费开始', desc: '注册即享每月10次免费额度，无需信用卡' },
  ];

  const faqs = [
    { q: '去背后的图片质量如何？', a: '我们使用专业级 AI 模型（remove.bg），能精准识别边缘，包括发丝、玻璃、毛发等复杂边缘，输出高质量透明 PNG。' },
    { q: '免费版有什么限制？', a: '免费版每月可处理 10 张图片，图片大小限制 10MB。Pro 版每月 200 次，无其他限制。' },
    { q: '我的图片会被保存吗？', a: '不会。图片处理完成后立即从服务器释放，我们只记录处理次数，不存储任何图片内容。' },
    { q: '支持哪些图片格式？', a: '上传支持 JPG、PNG、WebP，输出统一为透明背景的 PNG 格式。' },
    { q: '额度什么时候重置？', a: '免费额度从你注册之日起每30天重置一次。Pro 版同理，按购买日期每月重置。' },
    { q: '如何升级到 Pro？', a: '目前 Pro 套餐即将上线，可点击下方"加入等待列表"提前锁定优惠价格。' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Google GSI */}
      {!authLoading && !user && GOOGLE_CLIENT_ID && (
        <div id="g_id_onload" data-client_id={GOOGLE_CLIENT_ID}
          data-callback="handleGoogleSignIn" data-auto_prompt="false" />
      )}

      {/* 导航栏 */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="font-bold text-gray-900 text-lg flex items-center gap-2">
            🖼️ <span>BG Remover</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition">功能</a>
            <a href="#pricing" className="hover:text-gray-900 transition">定价</a>
            <a href="#faq" className="hover:text-gray-900 transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <button onClick={openProfile} className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-xl transition">
                {user.picture && (
                  <Image src={user.picture} alt={user.name} width={32} height={32}
                    className="rounded-full border border-gray-200" unoptimized />
                )}
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-800 leading-tight">{user.name}</div>
                  <div className="text-xs text-blue-500 leading-tight">剩余 {remaining} 次</div>
                </div>
              </button>
            ) : (
              <div className="g_id_signin" data-type="standard" data-shape="rectangular"
                data-theme="outline" data-text="signin_with" data-size="medium" data-locale="zh_CN" />
            )}
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50/60 to-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            ✨ AI 驱动 · 5秒去背 · 免费开始
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            一键去除图片背景<br />
            <span className="text-blue-500">专业效果，秒级完成</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            上传图片，AI 自动识别主体，精准去除背景，下载透明 PNG。
            电商、设计、证件照，一键搞定。
          </p>

          {/* 工具区 */}
          <div className="flex flex-col items-center gap-6">
            {!authLoading && !user && (
              <div className="w-full max-w-xl border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center bg-white/80">
                <div className="text-5xl mb-4">🔐</div>
                <p className="text-gray-700 font-semibold text-lg mb-2">登录后免费使用</p>
                <p className="text-gray-400 text-sm mb-6">每月 10 ��免费额度，无需信用卡</p>
                <div className="g_id_signin" data-type="standard" data-shape="rectangular"
                  data-theme="filled_blue" data-text="signin_with" data-size="large" data-locale="zh_CN" />
              </div>
            )}
            {user && <Tool user={user} onUsed={handleUsed} />}
          </div>

          {/* 信任标签 */}
          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-gray-400">
            <span>✓ 无需安装</span>
            <span>✓ 图片不存储</span>
            <span>✓ 支持中文</span>
            <span>✓ 免费开始</span>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">为什么选择我们</h2>
            <p className="text-gray-500">专业工具，简单易用，让去背不再是难题</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-md transition bg-white">
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-semibold text-gray-800 mb-2">{f.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 使用场景 */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">适用场景</h2>
          <p className="text-gray-500 mb-12">无论你是电商卖家、设计师还是个人用户，都能轻松搞定</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🛍️', title: '电商主图', desc: '商品白底图，一键生成' },
              { icon: '🎨', title: '设计创作', desc: '素材抠图，快速合成' },
              { icon: '🪪', title: '证件照', desc: '换底色，蓝白红随意换' },
              { icon: '📸', title: '人像写真', desc: '人像抠图，背景替换' },
            ].map((s) => (
              <div key={s.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="font-semibold text-gray-800 mb-1 text-sm">{s.title}</div>
                <div className="text-xs text-gray-500">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 定价 */}
      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">简单透明的定价</h2>
          <p className="text-gray-500 mb-12">免费开始，按需升级，无隐藏费用</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* 免费版 */}
            <div className="border-2 border-gray-200 rounded-2xl p-8 text-left">
              <div className="text-sm font-medium text-gray-500 mb-2">免费版</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$0<span className="text-lg font-normal text-gray-400">/月</span></div>
              <div className="text-sm text-gray-400 mb-6">永久免费</div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                {['10 次/月', '最大 10MB/张', '标准处理速度', '基础历史记录'].map(i => (
                  <li key={i} className="flex items-center gap-2"><span className="text-green-500">✓</span>{i}</li>
                ))}
              </ul>
              {!user ? (
                <div className="g_id_signin w-full" data-type="standard" data-shape="rectangular"
                  data-theme="outline" data-text="signup_with" data-size="large" data-locale="zh_CN" />
              ) : (
                <div className="text-center text-sm text-green-600 font-medium py-2">✓ 当前套餐</div>
              )}
            </div>
            {/* Pro 版 */}
            <div className="border-2 border-blue-500 rounded-2xl p-8 text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium">即将上线</div>
              <div className="text-sm font-medium text-blue-600 mb-2">Pro 版</div>
              <div className="text-4xl font-bold text-gray-900 mb-1">$9<span className="text-lg font-normal text-gray-400">/月</span></div>
              <div className="text-sm text-gray-400 mb-6">年付 $79，省 $29</div>
              <ul className="space-y-3 mb-8 text-sm text-gray-600">
                {['200 次/月', '最大 25MB/张', '优先处理队列', '无限历史记录', '批量上传', '优先客服支持'].map(i => (
                  <li key={i} className="flex items-center gap-2"><span className="text-blue-500">✓</span>{i}</li>
                ))}
              </ul>
              <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition">
                加入等待列表 →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">常见问题</h2>
            <p className="text-gray-500">有疑问？这里可能有你的答案</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-gray-800 hover:bg-gray-50 transition"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span className={`text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                    <div className="pt-3">{faq.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 底部 */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">立即开始免费使用</h2>
          <p className="text-blue-100 mb-8 text-lg">每月 10 次免费额度，无需信用卡，30 秒注册完成</p>
          {!user ? (
            <div className="flex justify-center">
              <div className="g_id_signin" data-type="standard" data-shape="rectangular"
                data-theme="filled_white" data-text="signup_with" data-size="large" data-locale="zh_CN" />
            </div>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-block bg-white text-blue-600 font-bold px-10 py-4 rounded-xl hover:bg-blue-50 transition shadow-lg">
              开始去背 →
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-semibold text-white">🖼️ BG Remover</div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-white transition">功能</a>
            <a href="#pricing" className="hover:text-white transition">定价</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <div>© 2026 BG Remover · Powered by remove.bg</div>
        </div>
      </footer>

      {/* 个人中心弹窗 */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
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
                      {user.plan === 'free' ? '免费版' : 'Pro 版'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">本月用量</span>
                <span className="text-sm text-gray-500">{user.used_this_month} / {user.monthly_credits} 次</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                <div className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (user.used_this_month / user.monthly_credits) * 100)}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                剩余 <span className="text-blue-500 font-medium">{remaining} 次</span>，{resetDate} 重置
              </div>
            </div>
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
    </div>
  );
}
