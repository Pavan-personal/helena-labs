'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Client wrapper around the dashboard sidebar. On md+ screens the sidebar
 * lives permanently in a two-column grid; on mobile it slides in from the
 * left over the content, backed by a translucent scrim. Auto-closes when
 * the route changes so tapping a nav link on mobile doesn't leave the
 * drawer stuck open.
 */
export function DashboardShell({
  sidebar,
  children
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="h-screen md:grid md:grid-cols-[248px_1fr] md:overflow-hidden">
      {/* Mobile top bar — hamburger + logo. Hidden on md+ */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900 text-neutral-200"
        >
          <Menu className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <span className="text-sm font-semibold tracking-tight text-app">Helena Labs</span>
        <span className="h-9 w-9" aria-hidden />
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — permanent on md+, off-canvas drawer on mobile */}
      <aside
        className={`
          md:border-r md:border-neutral-800 md:bg-neutral-950 md:flex md:flex-col md:h-screen md:overflow-hidden md:static
          fixed inset-y-0 left-0 z-50 w-[280px] bg-neutral-950 border-r border-neutral-800 flex flex-col overflow-hidden
          transform transition-transform duration-200 ease-out
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Close button — mobile only, top-right of drawer */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="md:hidden absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-md border border-neutral-800 hover:bg-neutral-900 text-neutral-200"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {sidebar}
      </aside>

      <main className="md:h-screen md:overflow-y-auto scrollbar-none">
        <div className="max-w-5xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
