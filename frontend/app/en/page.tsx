'use client';
import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Tool from '../components/Tool';

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'https://bg-remover-worker.yisuoyanyu1104.workers.dev';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

interface UserInfo {
  id: string; name: string; email: string; picture: string;
  plan: string; monthly_credits: number; used_this_month: number; reset_at: number;
}
interface Job { id: string; status: string; created_at: number; }

declare global {
  interface Window { google: any; handleGoogleSignIn: (r: any) => void; }
}

export default function HomeEn() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const syncUser = useCallback(async (raw: { id: string; email: string; name: string; picture: string }) => {
    try {
      const res = await fetch(`${WORKER_URL}/api/user/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(raw),
      });
      const data = await res.json() as { user: UserInfo };
      setUser(data.user); localStorage.setItem('google_user', JSON.stringify(data.user));
    } catch { setUser(raw as any); }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('google_user');
    if (saved) {
      try {
        const u = JSON.parse(saved); setUser(u);
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
    setUser(null); setShowProfile(false); localStorage.removeItem('google_user');
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
  };

  const openProfile = async () => {
    setShowProfile(true); if (!user) return; setJobsLoading(true);
    try {
      const res = await fetch(`${WORKER_URL}/api/user/jobs`, { headers: { 'X-User-Id': user.id } });
      const data = await res.json() as { jobs: Job[] }; setJobs(data.jobs || []);
    } catch {} setJobsLoading(false);
  };

  const handleUsed = () => setUser(prev => prev ? { ...prev, used_this_month: prev.used_this_month + 1 } : prev);
  const remaining = user ? Math.max(0, user.monthly_credits - user.used_this_month) : 0;
  const resetDate = user ? new Date(user.reset_at * 1000).toLocaleDateString('en-US') : '';

  const features = [
    { icon: '⚡', title: 'Instant Results', desc: 'AI-powered processing. Upload and get results in under 5 seconds.' },
    { icon: '🎯', title: 'Precise Cutouts', desc: 'Sharp edges, hair, glass — our AI handles complex objects perfectly.' },
    { icon: '🔒', title: 'Privacy First', desc: 'Images are never stored. Processed and released immediately.' },
    { icon: '📱', title: 'Works Everywhere', desc: 'Desktop and mobile friendly. Remove backgrounds from any device.' },
    { icon: '🖼️', title: 'Multi-Format', desc: 'Upload JPG, PNG, or WebP. Download high-quality transparent PNG.' },
    { icon: '🆓', title: 'Free to Start', desc: '10 free removals per month. No credit card required.' },
  ];

  const faqs = [
    { q: 'How good is the background removal quality?', a: 'We use professional-grade AI (remove.bg) that precisely handles edges including hair, glass, and complex objects, delivering high-quality transparent PNGs.' },
    { q: 'What are the free plan limitations?', a: 'Free plan includes 10 background removals per month with a 10MB file size limit. Pro plans offer more removals and priority processing.' },
    { q: 'Are my images stored?', a: 'No. Images are processed and immediately released from our servers. We only record usage counts, never image content.' },
    { q: 'What file formats are supported?', a: 'Upload JPG, PNG, or WebP. All outputs are delivered as transparent PNG files.' },
    { q: 'When do credits reset?', a: 'Free credits reset every 30 days from your registration date. Paid plans follow the same cycle from purchase date.' },
    { q: 'How do I upgrade to Pro?', a: 'Pro plans are launching soon. Click "View Pricing" to see available plans and join the waitlist for early access.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {!authLoading && !user && GOOGLE_CLIENT_ID && (
        <div id="g_id_onload" data-client_id={GOOGLE_CLIENT_ID} data-callback="handleGoogleSignIn" data-auto_prompt="false" />
      )}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/en" className="font-bold text-gray-900 text-lg flex items-center gap-2">🖼️ BG Remover</Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition">Features</a>
            <Link href="/en/pricing" className="hover:text-gray-900 transition">Pricing</Link>
            <a href="#faq" className="hover:text-gray-900 transition">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <Link href="/" className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-500 hover:border-gray-400 transition flex items-center gap-1">
              🌐 中文
            </Link>
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            ) : user ? (
              <button onClick={openProfile} className="flex items-center gap-2 hover:bg-gray-50 px-3 py-1.5 rounded-xl transition">
                {user.picture && <Image src={user.picture} alt={user.name} width={32} height={32} className="rounded-full border border-gray-200" unoptimized />}
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-medium text-gray-800 leading-tight">{user.name}</div>
                  <div className="text-xs text-blue-500 leading-tight">{remaining} left</div>
                </div>
              </button>
            ) : (
              <div className="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="outline" data-text="signin_with" data-size="medium" data-locale="en" />
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-blue-50/60 to-white text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            ✨ AI-Powered · Results in 5s · Free to Start
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
            Remove Image Backgrounds<br />
            <span className="text-blue-500">Instantly, for Free</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
            Upload any image. AI automatically detects the subject and removes the background.
            Download a clean transparent PNG in seconds.
          </p>
          <div className="flex flex-col items-center gap-6">
            {!authLoading && !user && (
              <div className="w-full max-w-xl border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center bg-white/80">
                <div className="text-5xl mb-4">🔐</div>
                <p className="text-gray-700 font-semibold text-lg mb-2">Sign in to get started for free</p>
                <p className="text-gray-400 text-sm mb-6">10 free removals/month · No credit card required</p>
                <div className="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="filled_blue" data-text="signin_with" data-size="large" data-locale="en" />
              </div>
            )}
            {user && <Tool user={user} onUsed={handleUsed} />}
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-gray-400">
            <span>✓ No installation</span><span>✓ Images never stored</span>
            <span>✓ Commercial use OK</span><span>✓ Free to start</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Why Choose BG Remover</h2>
            <p className="text-gray-500">Professional-grade tools, simple enough for anyone</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-md transition bg-white">
                <div className="text-3xl mb-3">{f.icon}</div>
                <div className="font-semibold text-gray-800 mb-2">{f.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Perfect For</h2>
          <p className="text-gray-500 mb-12">Whether you're a seller, designer, or everyday user — we've got you covered</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🛍️', title: 'E-Commerce', desc: 'White background product photos' },
              { icon: '🎨', title: 'Design', desc: 'Quick cutouts for compositing' },
              { icon: '🪪', title: 'ID Photos', desc: 'Swap backgrounds instantly' },
              { icon: '📸', title: 'Portraits', desc: 'Professional photo editing' },
            ].map(s => (
              <div key={s.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="font-semibold text-gray-800 mb-1 text-sm">{s.title}</div>
                <div className="text-xs text-gray-500">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, Transparent Pricing</h2>
          <p className="text-gray-500 mb-10">Start free. Pay only when you need more. No subscriptions required.</p>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { name: 'Starter', price: '$4.99', credits: '10 credits', note: 'Never expires' },
              { name: 'Popular', price: '$12.99', credits: '30 credits', note: 'Best value', highlight: true },
              { name: 'Pro Pack', price: '$29.99', credits: '80 credits', note: 'Most savings' },
            ].map(p => (
              <div key={p.name} className={`rounded-2xl p-5 border-2 ${p.highlight ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                <div className={`text-xs font-medium mb-1 ${p.highlight ? 'text-blue-600' : 'text-gray-400'}`}>{p.name}</div>
                <div className="text-2xl font-bold text-gray-900">{p.price}</div>
                <div className="text-sm text-gray-500">{p.credits}</div>
                <div className={`text-xs mt-1 ${p.highlight ? 'text-blue-500' : 'text-gray-400'}`}>{p.note}</div>
              </div>
            ))}
          </div>
          <Link href="/en/pricing" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-10 py-4 rounded-xl transition shadow-md text-lg">
            View Full Pricing →
          </Link>
          <p className="text-sm text-gray-400 mt-4">✓ Monthly subscriptions also available · 7-day refund guarantee</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
            <p className="text-gray-500">Still have questions? We've got answers.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button className="w-full text-left px-6 py-4 flex items-center justify-between font-medium text-gray-800 hover:bg-gray-50 transition"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}>
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

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Start Removing Backgrounds for Free</h2>
          <p className="text-blue-100 mb-8 text-lg">10 free removals/month · No credit card · Ready in 30 seconds</p>
          {!user ? (
            <div className="flex justify-center">
              <div className="g_id_signin" data-type="standard" data-shape="rectangular" data-theme="filled_white" data-text="signup_with" data-size="large" data-locale="en" />
            </div>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-block bg-white text-blue-600 font-bold px-10 py-4 rounded-xl hover:bg-blue-50 transition shadow-lg">
              Remove Background Now →
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-semibold text-white">🖼️ BG Remover</div>
          <div className="flex gap-6">
            <a href="#features" className="hover:text-white transition">Features</a>
            <Link href="/en/pricing" className="hover:text-white transition">Pricing</Link>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </div>
          <div>© 2026 BG Remover · Powered by remove.bg</div>
        </div>
      </footer>

      {/* Profile Modal */}
      {showProfile && user && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowProfile(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-white">
              <div className="flex items-center gap-4">
                {user.picture && <Image src={user.picture} alt={user.name} width={56} height={56} className="rounded-full border-2 border-white/50" unoptimized />}
                <div>
                  <div className="font-bold text-lg">{user.name}</div>
                  <div className="text-blue-100 text-sm">{user.email}</div>
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full mt-1 inline-block">
                    {user.plan === 'free' ? 'Free Plan' : 'Pro Plan'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-5 border-b border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Monthly Usage</span>
                <span className="text-sm text-gray-500">{user.used_this_month} / {user.monthly_credits}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (user.used_this_month / user.monthly_credits) * 100)}%` }} />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                <span className="text-blue-500 font-medium">{remaining} remaining</span> · Resets {resetDate}
              </div>
            </div>
            <div className="p-5 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-3">Processing History</div>
              {jobsLoading ? (
                <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm">No history yet</div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {jobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${job.status === 'done' ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="text-gray-600">Background removal</span>
                      </div>
                      <span className="text-gray-400 text-xs">{new Date(job.created_at * 1000).toLocaleDateString('en-US')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 flex gap-3">
              <button onClick={handleSignOut} className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition">Sign Out</button>
              <button onClick={() => setShowProfile(false)} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-sm hover:bg-blue-600 transition">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
