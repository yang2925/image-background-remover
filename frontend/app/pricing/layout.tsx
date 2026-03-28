import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - BG Remover',
  description: 'Simple, transparent pricing for BG Remover. Credit packs from $4.99 or monthly subscriptions from $9.99. Start free with 10 uses/month.',
  openGraph: {
    title: 'Pricing | BG Remover - AI Background Removal',
    description: 'Credit packs from $4.99 (never expires) or monthly subscriptions. Start free with 10 uses/month.',
    url: 'https://imagebackgroudremover.shop/pricing',
  },
  alternates: {
    canonical: 'https://imagebackgroudremover.shop/pricing',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
