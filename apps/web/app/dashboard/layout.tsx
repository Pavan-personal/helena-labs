import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/drafts', label: 'Runbook drafts' },
  { href: '/dashboard/incidents', label: 'Incidents' },
  { href: '/dashboard/runbooks', label: 'Runbooks' },
  { href: '/dashboard/integrations', label: 'Integrations' },
  { href: '/dashboard/usage', label: 'Usage' }
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const workspace = await requireWorkspace();

  return (
    <div className="min-h-screen grid grid-cols-[240px_1fr]">
      <aside className="border-r border-neutral-800 p-4 flex flex-col">
        <Link href="/" className="block text-xl font-bold tracking-tight mb-1 text-white">
          helena
        </Link>
        <div className="text-xs text-neutral-500 mb-6 truncate" title={workspace.slack_team_name}>
          {workspace.slack_team_name}
        </div>

        <nav className="space-y-1 flex-1">
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

        <div className="border-t border-neutral-800 pt-4">
          {workspace.installer_email && (
            <div className="text-xs text-neutral-500 mb-2 truncate" title={workspace.installer_email}>
              {workspace.installer_email}
            </div>
          )}
          <Link
            href="/api/auth/signout"
            className="block px-3 py-2 rounded text-xs text-neutral-400 hover:bg-neutral-900"
          >
            Sign out
          </Link>
        </div>
      </aside>
      <main className="p-8">{children}</main>
    </div>
  );
}
