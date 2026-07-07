'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' ? 'light' : 'dark';
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('helena-theme', next);
    } catch {}
    setTheme(next);
  }

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:bg-neutral-900 hover:text-neutral-100 ${className}`}
    >
      {mounted && (isLight ? (
        <Moon className="h-3.5 w-3.5" strokeWidth={1.75} />
      ) : (
        <Sun className="h-3.5 w-3.5" strokeWidth={1.75} />
      ))}
    </button>
  );
}
