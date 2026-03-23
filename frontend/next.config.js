/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // 静态导出，兼容 Cloudflare Pages
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
