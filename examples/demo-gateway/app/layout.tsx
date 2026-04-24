import type { ReactNode } from 'react';

export const metadata = {
  title: 'demo-gateway',
  description:
    'Reference Commerce Gateway implementation over a static demo catalog. Part of the llm-commerce-gateway OSS examples.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui', padding: 24 }}>{children}</body>
    </html>
  );
}
