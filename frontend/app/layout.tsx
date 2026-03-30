import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://imagebackgroudremover.shop';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BG Remover - Free AI Background Remover Online | 免费在线去除图片背景',
    template: '%s | BG Remover',
  },
  description: 'Remove image backgrounds instantly with AI. Free 10 uses/month, no design skills needed. Supports JPG, PNG, WebP. Perfect for ecommerce, design, and ID photos.',
  keywords: ['background remover', 'remove background', '去除背景', '抠图', 'AI抠图', 'transparent background', 'free background removal', '在线去背景', 'image background'],
  authors: [{ name: 'BG Remover' }],
  creator: 'BG Remover',
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    alternateLocale: 'en_US',
    url: siteUrl,
    siteName: 'BG Remover',
    title: 'BG Remover - Free AI Background Remover Online',
    description: 'Remove image backgrounds instantly with AI. Free 10 uses/month. Perfect for ecommerce, design, and ID photos.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BG Remover - AI Background Removal Tool',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BG Remover - Free AI Background Remover',
    description: 'Remove image backgrounds instantly with AI. Free 10 uses/month.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href={siteUrl} />
        {/* Structured Data - WebApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'BG Remover',
              url: siteUrl,
              description: 'AI-powered background removal tool. Free 10 uses per month.',
              applicationCategory: 'DesignApplication',
              operatingSystem: 'All',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Free plan with 10 uses per month',
              },
            }),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
