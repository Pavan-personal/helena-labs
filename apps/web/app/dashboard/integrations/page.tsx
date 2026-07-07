import Link from 'next/link';
import { Webhook, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { SiDiscord, SiGrafana, SiSentry, SiGithub } from '@icons-pack/react-simple-icons';
import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { isDemoWorkspace } from '@/lib/demo';
import { CopyRow } from './copy-row';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams
}: {
  searchParams: Promise<{ hs?: string; connected?: string; err?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const origin = 'https://helenalabs.vercel.app';
  const token = encodeSessionToken(workspace.id);
  const secret = workspace.webhook_secret;
  const linkTo = (href: string) => href;

  const grafanaUrl = `${origin}/api/grafana/webhook/${secret}`;
  const sentryUrl = `${origin}/api/errors/sentry/${secret}`;
  const genericUrl = `${origin}/api/errors/generic/${secret}`;
  const slashCommandUrl = `${origin}/api/slack/command`;
  const discordInteractionsUrl = `${origin}/api/discord/interactions`;

  const isDiscord = workspace.chat_platform === 'discord';
  const isDemo = isDemoWorkspace(workspace.id);
  const githubConnected = Boolean(workspace.github_installation_id);
  const grafanaConnected = Boolean(workspace.grafana_url && workspace.grafana_token);
  const sentryConnected = Boolean(workspace.sentry_org_slug && workspace.sentry_token);

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Configuration
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-app mb-2">Integrations</h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Wire helena into your team&rsquo;s tools. One-click install where the vendor supports
          it, token-based connect where they don&rsquo;t.
        </p>
      </div>

      {isDemo && (
        <div className="border border-neutral-800 bg-neutral-950/40 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900/60 flex items-center justify-center shrink-0">
            <Lock className="h-4 w-4 text-neutral-400" strokeWidth={1.75} />
          </div>
          <div className="text-sm text-neutral-400 leading-relaxed">
            <div className="text-neutral-200 font-medium mb-0.5">You&rsquo;re in the demo workspace.</div>
            Integration connects are disabled here so visitors can&rsquo;t share tokens with each
            other. Install helena on your own <Link href="/" className="text-neutral-100 underline underline-offset-2">Slack or Discord</Link> to wire real integrations.
          </div>
        </div>
      )}
      {params.err === 'demo_blocked' && (
        <div className="border border-yellow-950/60 bg-yellow-950/20 text-yellow-300 rounded-lg p-3 mb-6 text-sm">
          That action is disabled in the demo workspace. Install helena to wire it against your own data.
        </div>
      )}
      {params.connected && (
        <div className="helena-alert-success rounded-lg p-3 mb-6 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            {params.connected === 'github' && 'GitHub App installed. We can now see PRs and deployments in your selected repos.'}
            {params.connected === 'grafana' && 'Grafana Contact Point created. Now attach it in Alerting → Notification Policies.'}
            {params.connected === 'sentry' && 'Sentry token accepted and projects listed. Any alert rule will now push to helena.'}
          </span>
        </div>
      )}

      {/* Chat platform */}
      <SectionHeader label="Chat platform" count="1 connected" />
      <IntegrationCard
        icon={isDiscord ? <DiscordLogo /> : <SlackLogo />}
        brand={isDiscord ? '#5865F2' : '#611f69'}
        title={isDiscord ? 'Discord' : 'Slack'}
        subtitle={
          isDiscord
            ? workspace.discord_guild_name ?? 'Server'
            : workspace.slack_team_name ?? 'Workspace'
        }
        status="connected"
        detail={
          workspace.incident_channel_name
            ? `Indexing #${workspace.incident_channel_name}`
            : 'Awaiting channel selection'
        }
        description={
          isDiscord
            ? 'Slash commands and message right-click actions are live in your server. Paste the URL below as the Interactions Endpoint in the Discord Developer Portal.'
            : 'Every message, screenshot, and thread posted in your incident channel is indexed automatically. The slash command URL below powers /askoncall.'
        }
      >
        <CopyRow
          label={isDiscord ? 'Interactions endpoint URL' : 'Slash command URL'}
          value={isDiscord ? discordInteractionsUrl : slashCommandUrl}
        />
      </IntegrationCard>

      {/* Code */}
      <SectionHeader label="Code" count={githubConnected ? '1 connected' : '0 connected'} />
      <IntegrationCard
        icon={<GithubLogo />}
        brand="#8b949e"
        title="GitHub"
        subtitle={
          githubConnected
            ? `${workspace.github_repos?.length ?? 0} repos visible`
            : 'PR + deployment correlation'
        }
        status={githubConnected ? 'connected' : 'ready'}
        detail={
          githubConnected
            ? workspace.github_repos && workspace.github_repos.length > 0
              ? workspace.github_repos.slice(0, 3).join(', ') +
                (workspace.github_repos.length > 3 ? `, +${workspace.github_repos.length - 3} more` : '')
              : 'No repositories in scope yet'
            : 'One-click install, pick repos on GitHub'
        }
        description="When a PR merges to any watched repo, helena ingests it. When a deployment fails, we surface it in your incident channel. Correlates recent changes with alerts."
      >
        {githubConnected ? (
          <div className="flex items-center gap-2">
            <a
              href={`/api/auth/github/install?hs=${encodeURIComponent(token)}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Adjust repositories
            </a>
            <span className="text-[11px] text-neutral-600">
              Connected {new Date(workspace.github_connected_at ?? '').toLocaleDateString()}
            </span>
          </div>
        ) : (
          <a
            href={`/api/auth/github/install?hs=${encodeURIComponent(token)}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
          >
            <GithubLogo />
            Install GitHub App
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </a>
        )}
      </IntegrationCard>

      {/* Observability */}
      <SectionHeader
        label="Observability"
        count={`${[grafanaConnected, sentryConnected].filter(Boolean).length} connected`}
      />
      <IntegrationCard
        icon={<GrafanaLogo />}
        brand="#F46800"
        title="Grafana Cloud"
        subtitle={grafanaConnected ? new URL(workspace.grafana_url ?? '').hostname : 'Alert webhook'}
        status={grafanaConnected ? 'connected' : 'ready'}
        detail={
          grafanaConnected
            ? `Contact Point uid ${(workspace.grafana_contact_point_uid ?? '').slice(0, 12)}...`
            : 'One-click via service account token'
        }
        description="We create a Contact Point named helena-oncall on your Grafana. You then attach it to any alert rules or notification policies you want to route to us."
      >
        {grafanaConnected ? (
          <div className="flex items-center gap-2">
            <Link
              href={linkTo('/dashboard/integrations/connect/grafana')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Update token
            </Link>
            <CopyRowInline label="Webhook URL (for manual routing)" value={grafanaUrl} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href={linkTo('/dashboard/integrations/connect/grafana')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
            >
              <GrafanaLogo />
              Connect Grafana
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <span className="text-[11px] text-neutral-600">or paste webhook URL manually</span>
          </div>
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<SentryLogo />}
        brand="#7553D6"
        title="Sentry"
        subtitle={
          sentryConnected
            ? `${workspace.sentry_org_slug} · ${workspace.sentry_projects?.length ?? 0} projects`
            : 'Internal Integration webhook'
        }
        status={sentryConnected ? 'connected' : 'ready'}
        detail={
          sentryConnected
            ? (workspace.sentry_projects ?? []).slice(0, 3).join(', ') +
              ((workspace.sentry_projects ?? []).length > 3
                ? `, +${(workspace.sentry_projects ?? []).length - 3} more`
                : '')
            : 'Paste token → we auto-configure'
        }
        description="Sentry does not offer public OAuth for third-party integrations. Paste your Internal Integration token, we verify it and auto-list your projects. Existing alert rules that route to your webhook keep working."
      >
        {sentryConnected ? (
          <div className="flex items-center gap-2">
            <Link
              href={linkTo('/dashboard/integrations/connect/sentry')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-600"
            >
              Update token
            </Link>
            <CopyRowInline label="Webhook URL (for alert rules)" value={sentryUrl} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              href={linkTo('/dashboard/integrations/connect/sentry')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 hover:border-neutral-600 hover:bg-neutral-800/50 transition-colors"
            >
              <SentryLogo />
              Connect Sentry
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <span className="text-[11px] text-neutral-600">or paste webhook URL manually</span>
          </div>
        )}
      </IntegrationCard>

      {/* Custom */}
      <SectionHeader label="Custom" />
      <IntegrationCard
        icon={<WebhookLogo />}
        brand="#71717a"
        title="Generic webhook"
        subtitle="Any tool that can POST JSON"
        status="ready"
        detail="Datadog, cron jobs, custom scripts"
        description="POST a JSON body with title, message, source, and severity. Everything else is optional."
      >
        <CopyRow label="Webhook URL" value={genericUrl} />
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
            Example request
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-x-auto scrollbar-thin">
            <pre className="text-xs text-neutral-300 p-4 whitespace-pre-wrap break-all leading-relaxed">
{`curl -X POST "${genericUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Payment webhook timeout",
    "message": "Stripe webhook took 8.2s to acknowledge",
    "source": "cron",
    "severity": "high"
  }'`}
            </pre>
          </div>
        </div>
      </IntegrationCard>
    </div>
  );
}

function SectionHeader({ label, count }: { label: string; count?: string }) {
  return (
    <div className="flex items-baseline justify-between mt-8 mb-3">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      {count && <div className="text-[11px] text-neutral-600">{count}</div>}
    </div>
  );
}

function IntegrationCard({
  icon,
  brand,
  title,
  subtitle,
  status,
  detail,
  description,
  children
}: {
  icon: React.ReactNode;
  brand: string;
  title: string;
  subtitle: string;
  status: 'connected' | 'ready';
  detail: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-5 mb-3 hover:border-neutral-700 transition-colors">
      <div className="flex items-start gap-4 mb-3">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border border-neutral-800"
          style={{ background: `linear-gradient(180deg, ${brand}18 0%, transparent 100%)` }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="text-base font-semibold text-neutral-50">{title}</div>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span className="truncate" title={subtitle}>
              {subtitle}
            </span>
            <span className="text-neutral-700">·</span>
            <span className="text-neutral-600 truncate">{detail}</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-neutral-400 leading-relaxed mb-4">{description}</p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: 'connected' | 'ready' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium ${
        status === 'connected'
          ? 'helena-alert-success'
          : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
        }`}
      />
      {status === 'connected' ? 'Connected' : 'Ready to connect'}
    </span>
  );
}

function CopyRowInline({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-0.5">{label}</div>
      <code className="block text-[10px] text-neutral-500 truncate">{value}</code>
    </div>
  );
}

function SlackLogo() {
  return (
    <svg viewBox="0 0 122.8 122.8" width="22" height="22" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" />
      <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" />
      <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" />
    </svg>
  );
}
function DiscordLogo() {
  return <SiDiscord size={22} color="#5865F2" />;
}
function GrafanaLogo() {
  return <SiGrafana size={22} color="#F46800" />;
}
function SentryLogo() {
  return <SiSentry size={22} color="#7553D6" />;
}
function GithubLogo() {
  return <span className="inline-flex [&_svg]:fill-neutral-200"><SiGithub size={22} /></span>;
}
function WebhookLogo() {
  return <Webhook className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />;
}
