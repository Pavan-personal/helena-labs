import { Webhook } from 'lucide-react';
import { SiDiscord, SiGrafana, SiSentry } from '@icons-pack/react-simple-icons';
import { requireWorkspace } from '@/lib/session';
import { CopyRow } from './copy-row';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const workspace = await requireWorkspace();
  const origin = 'https://helenalabs.vercel.app';
  const secret = workspace.webhook_secret;

  const grafanaUrl = `${origin}/api/grafana/webhook/${secret}`;
  const sentryUrl = `${origin}/api/errors/sentry/${secret}`;
  const genericUrl = `${origin}/api/errors/generic/${secret}`;
  const slashCommandUrl = `${origin}/api/slack/command`;
  const discordInteractionsUrl = `${origin}/api/discord/interactions`;

  const isDiscord = workspace.chat_platform === 'discord';

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Configuration
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">Integrations</h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Each endpoint below is unique to your workspace. Paste them into the corresponding tool.
          Treat every URL like a secret &mdash; anyone with one can push data into your memory.
        </p>
      </div>

      <SectionHeader label="Chat platform" count="1 connected" />
      <IntegrationCard
        icon={isDiscord ? <DiscordLogo /> : <SlackLogo />}
        brand={isDiscord ? '#5865F2' : '#611f69'}
        title={isDiscord ? 'Discord' : 'Slack'}
        subtitle={isDiscord ? workspace.discord_guild_name ?? 'Server' : workspace.slack_team_name ?? 'Workspace'}
        connected
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

      <SectionHeader label="Observability" count="0 connected" hint="wire up when ready" />
      <IntegrationCard
        icon={<GrafanaLogo />}
        brand="#F46800"
        title="Grafana Cloud"
        subtitle="Alert webhook"
        connected={false}
        detail="Attach to any contact point"
        description="Grafana Alerting → Contact points → Add contact point → Webhook. Include the rendered panel image so vision can extract signal automatically."
      >
        <CopyRow label="Webhook URL" value={grafanaUrl} />
      </IntegrationCard>

      <IntegrationCard
        icon={<SentryLogo />}
        brand="#7553D6"
        title="Sentry"
        subtitle="Internal integration webhook"
        connected={false}
        detail="One integration per Sentry org"
        description="Sentry → Settings → Custom integrations → Create new integration. Turn on the Alerts checkbox and add the URL below."
      >
        <CopyRow label="Webhook URL" value={sentryUrl} />
      </IntegrationCard>

      <SectionHeader label="Custom" />
      <IntegrationCard
        icon={<WebhookLogo />}
        brand="#71717a"
        title="Generic webhook"
        subtitle="Any tool that can POST JSON"
        connected={false}
        detail="Datadog, cron jobs, custom scripts"
        description="POST a JSON body with title, message, source, and severity. Everything else is optional."
      >
        <CopyRow label="Webhook URL" value={genericUrl} />
        <div className="mt-4">
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-2">
            Example request
          </div>
          <div className="rounded-lg border border-neutral-900 bg-black/40 overflow-x-auto scrollbar-thin">
            <pre className="text-xs text-neutral-400 p-4 whitespace-pre-wrap break-all leading-relaxed">
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

function SectionHeader({
  label,
  count,
  hint
}: {
  label: string;
  count?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mt-8 mb-3">
      <div className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className="text-[11px] text-neutral-600">
        {count}
        {hint && <span className="text-neutral-700"> · {hint}</span>}
      </div>
    </div>
  );
}

function IntegrationCard({
  icon,
  brand,
  title,
  subtitle,
  connected,
  detail,
  description,
  children
}: {
  icon: React.ReactNode;
  brand: string;
  title: string;
  subtitle: string;
  connected: boolean;
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
            <StatusBadge connected={connected} />
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

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium ${
        connected
          ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-900/60'
          : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          connected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
        }`}
      />
      {connected ? 'Connected' : 'Ready to connect'}
    </span>
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
function WebhookLogo() {
  return <Webhook className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />;
}
