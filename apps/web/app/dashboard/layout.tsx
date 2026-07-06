import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import {
  LayoutGrid,
  AlertTriangle,
  FileEdit,
  BookOpen,
  Plug,
  Activity,
  User,
  Sparkles
} from 'lucide-react';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { SessionSync, SignOutButton } from '@/app/components/session-sync';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/dashboard', label: 'Overview', Icon: LayoutGrid },
  { href: '/dashboard/copilot', label: 'Copilot', Icon: Sparkles },
  { href: '/dashboard/incidents', label: 'Incidents', Icon: AlertTriangle },
  { href: '/dashboard/drafts', label: 'Runbook drafts', Icon: FileEdit },
  { href: '/dashboard/runbooks', label: 'Runbooks', Icon: BookOpen },
  { href: '/dashboard/integrations', label: 'Integrations', Icon: Plug },
  { href: '/dashboard/usage', label: 'Usage & cost', Icon: Activity },
  { href: '/dashboard/profile', label: 'Profile', Icon: User }
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const workspace = await requireWorkspace();
  // Cookie is set by /api/auth/demo, /api/auth/slack/callback, or
  // /api/auth/discord/callback — so nav links don't need to carry the
  // token in the URL. Middleware still accepts ?hs= as fallback if the
  // cookie is missing (e.g., third-party contexts).
  const withToken = (href: string) => href;
  // Retained for edge cases where a hard link off-app needs the token.
  const _token = encodeSessionToken(workspace.id);
  void _token;

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
            <Link href={withToken('/dashboard')} className="flex items-center gap-2 mb-4">
              <Image
                src="/logo.png"
                alt="helena"
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
              <span className="text-lg font-semibold tracking-tight text-white">helena</span>
            </Link>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-neutral-800 bg-neutral-900/60">
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
            {NAV.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={withToken(href)}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white transition-colors"
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-neutral-900 p-3">
            {workspace.installer_email && (
              <div className="text-xs text-neutral-400 mb-1.5 truncate" title={workspace.installer_email}>
                {workspace.installer_email}
              </div>
            )}
            <SignOutButton className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
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
