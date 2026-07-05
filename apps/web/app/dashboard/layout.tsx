import Link from 'next/link';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { SessionSync, SignOutButton } from '@/app/components/session-sync';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: OverviewIcon },
  { href: '/dashboard/incidents', label: 'Incidents', icon: IncidentsIcon },
  { href: '/dashboard/drafts', label: 'Runbook drafts', icon: DraftsIcon },
  { href: '/dashboard/runbooks', label: 'Runbooks', icon: RunbooksIcon },
  { href: '/dashboard/integrations', label: 'Integrations', icon: IntegrationsIcon },
  { href: '/dashboard/usage', label: 'Usage & cost', icon: UsageIcon },
  { href: '/dashboard/profile', label: 'Profile', icon: ProfileIcon }
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const workspace = await requireWorkspace();
  const token = encodeSessionToken(workspace.id);
  const withToken = (href: string) => `${href}?hs=${encodeURIComponent(token)}`;

  const displayName =
    workspace.chat_platform === 'discord'
      ? workspace.discord_guild_name ?? 'Discord server'
      : workspace.slack_team_name ?? 'Slack workspace';
  const platformInitials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <Suspense fallback={null}>
        <SessionSync />
      </Suspense>
      <div className="h-screen grid grid-cols-[248px_1fr] overflow-hidden">
        <aside className="border-r border-neutral-800 bg-neutral-950 flex flex-col h-screen overflow-hidden">
          <div className="p-4 border-b border-neutral-900">
            <Link href={withToken('/dashboard')} className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded bg-white text-black text-sm font-bold flex items-center justify-center">
                h
              </div>
              <span className="text-lg font-semibold tracking-tight text-white">helena</span>
            </Link>
            <div className="flex items-center gap-2 p-2 rounded border border-neutral-800 bg-neutral-900/60">
              <div
                className={`h-8 w-8 rounded flex items-center justify-center text-xs font-semibold ${
                  workspace.chat_platform === 'discord'
                    ? 'bg-[#5865F2] text-white'
                    : 'bg-neutral-800 text-neutral-300'
                }`}
              >
                {platformInitials || 'W'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-200 truncate" title={displayName}>
                  {displayName}
                </div>
                <div className="text-[10px] uppercase tracking-widest text-neutral-500">
                  {workspace.chat_platform}
                  {workspace.incident_channel_name && (
                    <span className="text-neutral-600"> · #{workspace.incident_channel_name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-0.5">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={withToken(item.href)}
                className="flex items-center gap-3 px-3 py-2 rounded text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white transition-colors"
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-neutral-900 p-3">
            {workspace.installer_email && (
              <div className="text-xs text-neutral-400 mb-1 truncate" title={workspace.installer_email}>
                {workspace.installer_email}
              </div>
            )}
            <SignOutButton className="text-xs text-neutral-500 hover:text-neutral-300">
              Sign out
            </SignOutButton>
          </div>
        </aside>
        <main className="h-screen overflow-y-auto scrollbar-none">
          <div className="max-w-5xl mx-auto p-8">{children}</div>
        </main>
      </div>
    </>
  );
}

function OverviewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IncidentsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <path d="M12 3l9 16H3l9-16z" />
      <path d="M12 10v4" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  );
}
function DraftsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <path d="M4 4h13l3 3v13H4z" />
      <path d="M8 12h8M8 16h5" />
    </svg>
  );
}
function RunbooksIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <path d="M5 4h11a3 3 0 013 3v14H8a3 3 0 01-3-3V4z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
function IntegrationsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <path d="M10 3v6a2 2 0 002 2h6" />
      <path d="M21 14v-4h-6a2 2 0 00-2 2v4a2 2 0 002 2h4l2 2v-6z" />
      <path d="M3 10a2 2 0 012-2h5v7a2 2 0 01-2 2H3z" />
    </svg>
  );
}
function UsageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-6 3 4 5-7" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="text-neutral-500">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}
