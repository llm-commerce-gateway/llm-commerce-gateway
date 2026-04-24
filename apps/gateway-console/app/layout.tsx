import './globals.css';
import type { ReactNode } from 'react';
import Image from 'next/image';
import logoDark from '../public/logo.png';

export const metadata = {
  title: 'Gateway Console',
  description:
    'Self-hosted, single-tenant operator UI for the open-source Commerce Gateway.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <a href="/" className="nav-brand" aria-label="BetterData">
            <Image src={logoDark} alt="BetterData Logo" className="h-8 w-auto" priority />
          </a>
          <a href="/">Overview</a>
          <a href="/status">Status</a>
          <a href="/providers">Providers</a>
          <a href="/connectors">Connectors</a>
          <a href="/registry">Registry</a>
          <a href="/federation">Federation</a>
          <a href="/keys">Keys</a>
          <a href="/telemetry">Telemetry</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
