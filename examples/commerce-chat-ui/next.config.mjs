/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

if (process.env.NODE_ENV === 'development') {
  const missing = [];
  const provider = (process.env.LLM_PROVIDER ?? 'anthropic').trim().toLowerCase();
  const providerKey =
    provider === 'openai'
      ? 'OPENAI_API_KEY'
      : provider === 'xai'
        ? 'XAI_API_KEY'
        : 'ANTHROPIC_API_KEY';
  if (!process.env[providerKey]) missing.push(providerKey);
  if (!process.env.GATEWAY_BASE_URL) missing.push('GATEWAY_BASE_URL');
  if (!process.env.GATEWAY_API_TOKEN) missing.push('GATEWAY_API_TOKEN');
  if (missing.length > 0) {
    console.warn(
      `[commerce-chat-ui] Missing env vars for LLM_PROVIDER=${provider}: ${missing.join(
        ', ',
      )}. Copy .env.example → .env.local.`,
    );
  }
}

export default nextConfig;
