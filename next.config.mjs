// 檔案路徑: next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb', 
    },
  },
};

export default nextConfig;