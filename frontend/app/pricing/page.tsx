'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

// 动态加载 PayPal SDK，支持按 intent 切换
function loadPayPalSDK(clientId: string, intent: 'capture' | 'subscription'): Promise<void> {
  return new Promise((resolve, reject) => {
    // 移除已有的 PayPal script（切换 intent 时需要重新加载）
    const existing = document.getElementById('paypal-sdk');
    if (existing) {
      const currentIntent = existing.getAttribute('data-intent');
      if (currentIntent === intent) { resolve(); return; }
      existing.remove();
      // 清除 PayPal 全局对象缓存
      delete (window as any).paypal;
    }
    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&intent=${intent}&vault=${intent === 'subscription' ? 'true' : 'false'}&components=buttons`;
    script.setAttribute('data-intent', intent);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load PayPal SDK'));
    document.head.appendChild(script);
  });
}

type Tab = 'credits' | 'subscription';

const creditPlans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 4.99,
    priceStr: '4.99',
    credits: 10,
    unitPrice: '0.50',
    features: ['10 HD background removals', 'JPG / PNG / WebP support', 'Commercial use allowed', 'Never expires'],
  },
  {
    id: 'popular',
    name: 'Popular',
    price: 12.99,
    priceStr: '12.99',
    credits: 30,
    unitPrice: '0.43',
    popular: true,
    features: ['30 HD background removals', 'JPG / PNG / WebP support', 'Commercial use allowed', 'Never expires', 'Save 14% vs Starter'],
  },
  {
    id: 'pro-pack',
    name: 'Pro Pack',
    price: 29.99,
    priceStr: '29.99',
    credits: 80,
    unitPrice: '0.37',
    features: ['80 HD background removals', 'JPG / PNG / WebP support', 'Commercial use allowed', 'Never expires', 'Save 26% vs Starter'],
  },
];

const subscriptionPlans = [
  {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    priceStr: '9.99',
    credits: 25,
    unitPrice: '0.40',
    features: ['25 HD removals / month', 'JPG / PNG / WebP support', 'Commercial use allowed', 'Monthly reset'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    priceStr: '19.99',
    credits: 60,
    unitPrice: '0.33',
    popular: true,
    features: ['60 HD removals / month', 'JPG / PNG / WebP support', 'Commercial use allowed', 'Monthly reset', 'Priority processing', 'Save 17% vs Basic'],
  },
];

// PayPal 按钮组件
function PayPalCheckout({
  plan,
  billingType,
  userId,
  onSuccess,
  onCancel,
}: {
  plan: any;
  billingType: Tab;
  userId: string | null;
  onSuccess: (result: any) => void;
  onCancel: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState('');
  const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
  const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;

  // 加载对应 intent 的 SDK
  useEffect(() => {
    rendered.current = false;
    setSdkReady(false);
    setSdkError('');
    const intent = billingType === 'credits' ? 'capture' : 'subscription';
    loadPayPalSDK(CLIENT_ID, intent)
      .then(() => setSdkReady(true))
      .catch(() => setSdkError('PayPal SDK 加载失败，请刷新重试'));
  }, [billingType, CLIENT_ID]);

  // SDK 就绪后渲染按钮
  useEffect(() => {
    if (!sdkReady || rendered.current || !containerRef.current) return;
    const paypal = (window as any).paypal;
    if (!paypal) return;

    rendered.current = true;

    if (billingType === 'credits') {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay' },
        createOrder: async () => {
          const res = await fetch(`${WORKER_URL}/api/paypal/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(userId ? { 'X-User-Id': userId } : {}),
            },
            body: JSON.stringify({ planId: plan.id }),
          });
          const data = await res.json();
          if (!data.orderID) throw new Error(data.error || 'Failed to create order');
          return data.orderID;
        },
        onApprove: async (data: any) => {
          const res = await fetch(`${WORKER_URL}/api/paypal/capture-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(userId ? { 'X-User-Id': userId } : {}),
            },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          const result = await res.json();
          if (result.success) onSuccess(result);
          else throw new Error(result.error || 'Capture failed');
        },
        onCancel: () => onCancel(),
        onError: (err: any) => console.error('PayPal error:', err),
      }).render(containerRef.current);
    } else {
      // 订阅模式
      paypal.Buttons({
        style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe' },
        createSubscription: async (_data: any, actions: any) => {
          const res = await fetch(`${WORKER_URL}/api/paypal/create-subscription`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(userId ? { 'X-User-Id': userId } : {}),
            },
            body: JSON.stringify({ planId: plan.id }),
          });
          const result = await res.json();
          if (!result.subscriptionID) throw new Error(result.error || 'Failed to create subscription');
          return result.subscriptionID;
        },
        onApprove: (data: any) => {
          onSuccess({ subscriptionID: data.subscriptionID });
        },
        onCancel: () => onCancel(),
        onError: (err: any) => console.error('PayPal subscription error:', err),
      }).render(containerRef.current);
    }
  }, [sdkReady]);

  if (sdkError) return <p className="text-red-500 text-sm text-center py-4">{sdkError}</p>;
  if (!sdkReady) return <p className="text-gray-400 text-sm text-center py-4">正在加载支付组件...</p>;

  return <div ref={containerRef} className="mt-2" />;
}

function PlanCard({ plan, billingType }: { plan: any; billingType: Tab }) {
  const [showModal, setShowModal] = useState(false);
  const [payStatus, setPayStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [payMessage, setPayMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('google_user');
      if (saved) {
        const u = JSON.parse(saved);
        setUserId(u?.id ?? null);
      }
    } catch {}
  }, []);

  const handleSuccess = (result: any) => {
    setPayStatus('success');
    if (billingType === 'credits') {
      setPayMessage(`✅ 支付成功！已添加 ${result.creditsAdded} 次额度`);
    } else {
      setPayMessage('✅ 订阅成功！额度将在几秒内更新');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <>
      <div className={`relative flex flex-col rounded-2xl p-8 border-2 transition-all
        ${plan.popular
          ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'}`}>

        {plan.popular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full">
            🔥 Popular
          </div>
        )}

        <div className={`text-sm font-semibold mb-2 ${plan.popular ? 'text-blue-600' : 'text-gray-500'}`}>
          {plan.name}
        </div>

        <div className="mb-1">
          <span className="text-5xl font-extrabold text-gray-900">${plan.price}</span>
          {billingType === 'subscription' && (
            <span className="text-gray-400 text-sm ml-1">/月</span>
          )}
        </div>

        <div className="text-sm text-gray-400 mb-6">
          {billingType === 'credits'
            ? `${plan.credits} 次 · $${plan.unitPrice}/次 · 永不过期`
            : `${plan.credits} 次/月 · $${plan.unitPrice}/次`}
        </div>

        <ul className="space-y-3 mb-8 flex-1">
          {plan.features.map((f: string) => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => { setPayStatus('idle'); setShowModal(true); }}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition
            ${plan.popular
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
              : 'bg-gray-900 hover:bg-gray-700 text-white'}`}
        >
          {billingType === 'credits' ? `Buy ${plan.name}` : `Get ${plan.name}`}
        </button>
      </div>

      {/* 支付弹窗 */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
            {payStatus === 'success' ? (
              <div className="text-center">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h3>
                <p className="text-gray-500 text-sm mb-6">{payMessage}</p>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-xl transition"
                >
                  开始使用 →
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                  <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  ${plan.price}{billingType === 'subscription' ? '/月' : ''} ·{' '}
                  {billingType === 'credits' ? `${plan.credits} 次额度（永不过期）` : `${plan.credits} 次/月`}
                </p>

                {!userId ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm mb-4">请先登录后再购买</p>
                    <Link
                      href="/"
                      className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-xl transition text-sm"
                    >
                      去登录
                    </Link>
                  </div>
                ) : (
                  <PayPalCheckout
                    plan={plan}
                    billingType={billingType}
                    userId={userId}
                    onSuccess={handleSuccess}
                    onCancel={handleCancel}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function PricingPage() {
  const [tab, setTab] = useState<Tab>('credits');

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-gray-900 text-lg flex items-center gap-2">
            🖼️ <span>BG Remover</span>
          </Link>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/#features" className="text-gray-500 hover:text-gray-900 transition">功能</Link>
            <Link href="/pricing" className="text-blue-600 font-medium">定价</Link>
            <Link href="/#faq" className="text-gray-500 hover:text-gray-900 transition">FAQ</Link>
            <Link href="/" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              免费开始
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-20 px-4">
        {/* 标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-gray-500 text-lg mb-2">Start free · No design skills needed</p>
          <p className="text-sm text-green-600 font-medium">✓ Secure payment via PayPal · Cancel anytime · No hidden fees · 7-day refund guarantee</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-100 rounded-xl p-1 flex gap-1">
            <button
              onClick={() => setTab('credits')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'credits' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              积分包
            </button>
            <button
              onClick={() => setTab('subscription')}
              className={`px-6 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === 'subscription' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              月订阅
              <span className="ml-2 bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full">省更多</span>
            </button>
          </div>
        </div>

        {/* 定价卡片 */}
        {tab === 'credits' && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {creditPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} billingType="credits" />
            ))}
          </div>
        )}

        {tab === 'subscription' && (
          <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {subscriptionPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} billingType="subscription" />
            ))}
          </div>
        )}

        {/* 说明文字 */}
        <div className="text-center mt-10 text-sm text-gray-400 space-y-1">
          {tab === 'credits' && <p>积分包永不过期，按需购买，适合低频用户</p>}
          {tab === 'subscription' && <p>月订阅每月自动重置额度，适合高频用户，性价比更高</p>}
          <p>所有套餐均支持 JPG / PNG / WebP，输出高质量透明 PNG</p>
        </div>

        {/* Try for Free CTA */}
        <div className="mt-16 text-center bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-10 max-w-2xl mx-auto">
          <div className="text-3xl mb-3">🎁</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Try for Free First</h3>
          <p className="text-gray-500 text-sm mb-6">
            注册即享每月 10 次免费额度，无需信用卡，满意再升级
          </p>
          <Link href="/"
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition shadow-md">
            免费开始使用 →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-10 px-4 bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="font-semibold text-white">🖼️ BG Remover</div>
          <div className="flex gap-6">
            <Link href="/#features" className="hover:text-white transition">功能</Link>
            <Link href="/pricing" className="hover:text-white transition">定价</Link>
            <Link href="/#faq" className="hover:text-white transition">FAQ</Link>
          </div>
          <div>© 2026 BG Remover · Powered by remove.bg</div>
        </div>
      </footer>
    </div>
  );
}
