import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/app/components/theme-toggle';

export const metadata: Metadata = {
  title: 'Helena Labs',
  description: 'Incident memory for on call teams.'
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('helena-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ThemeToggle className="fixed bottom-5 right-5 z-50 shadow-lg" />
      </body>
    </html>
  );
}
