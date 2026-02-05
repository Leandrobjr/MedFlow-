import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remover rewrites em produção (será feito via vercel.json)
  async rewrites() {
    // Só usar rewrites em desenvolvimento
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          // Evita problemas do Windows com localhost -> IPv6 (::1)
          destination: 'http://127.0.0.1:3001/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
