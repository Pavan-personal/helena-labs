import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/drafts', label: 'Runbook drafts' },
  { href: '/dashboard/incidents', label: 'Incidents' },
  { href: '/dashboard/runbooks', label: 'Runbooks' },
  { href: '/dashboard/usage', label: 'Usage' }
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid grid-cols-[220px_1fr]">
      <aside className="border-r border-neutral-800 p-4">
        <Link href="/" className="block text-xl font-bold tracking-tight mb-8 text-white">
          helena
        </Link>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded text-sm text-neutral-300 hover:bg-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}
