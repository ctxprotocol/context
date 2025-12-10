import type { NextConfig } from "next";

// Content Security Policy configuration
// Defines allowed sources for scripts, styles, connections, etc.
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: blob: https://avatar.vercel.sh https://*.public.blob.vercel-storage.com;
  font-src 'self' https://fonts.gstatic.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org;
  frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com;
  connect-src 
    'self' 
    https://auth.privy.io 
    https://*.rpc.privy.systems
    wss://relay.walletconnect.com 
    wss://relay.walletconnect.org 
    wss://www.walletlink.org 
    https://explorer-api.walletconnect.com 
    https://*.infura.io
    https://api.developer.coinbase.com
    https://*.public.blob.vercel-storage.com
    https://api.moonshot.ai
    https://generativelanguage.googleapis.com
    https://api.anthropic.com
    ${process.env.NODE_ENV === "development" ? "ws:" : ""};
  worker-src 'self';
  manifest-src 'self'
`;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        //https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Use Report-Only for MVP stage to monitor violations without blocking
            key: "Content-Security-Policy-Report-Only",
            // key: "Content-Security-Policy",
            // Clean up multi-line CSP into a single line for the header
            value: ContentSecurityPolicy.replace(/\s{2,}/g, " ").trim(),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
