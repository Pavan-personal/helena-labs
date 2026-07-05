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

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Integrations</h1>
      <p className="text-sm text-neutral-500 mb-8 max-w-2xl">
        These endpoints are unique to your workspace. Paste each URL into the corresponding tool.
        Anyone with a URL can push incidents to your memory, so treat them like secrets.
      </p>

      <IntegrationCard
        icon={
          workspace.chat_platform === 'discord' ? (
            <DiscordLogo />
          ) : (
            <SlackLogo />
          )
        }
        title={workspace.chat_platform === 'discord' ? 'Discord' : 'Slack'}
        subtitle={
          workspace.chat_platform === 'discord'
            ? workspace.discord_guild_name ?? 'Server'
            : workspace.slack_team_name ?? 'Workspace'
        }
        connected={true}
        detail={
          workspace.incident_channel_name
            ? `Ingesting from #${workspace.incident_channel_name}`
            : 'Awaiting channel selection'
        }
        description={
          workspace.chat_platform === 'discord'
            ? 'Slash commands and message right-click actions are live in your server. Set the Interactions Endpoint URL below in the Discord Developer Portal.'
            : 'Messages, screenshots, and threads posted in your incident channel are indexed automatically.'
        }
      >
        {workspace.chat_platform === 'discord' ? (
          <CopyRow label="Interactions Endpoint URL" value={discordInteractionsUrl} />
        ) : (
          <CopyRow label="Slash command URL" value={slashCommandUrl} />
        )}
      </IntegrationCard>

      <IntegrationCard
        icon={<GrafanaLogo />}
        title="Grafana Cloud"
        subtitle="Alert webhook"
        connected={false}
        detail="Not yet configured"
        description="Grafana Alerting → Contact points → Add contact point → Webhook. Include the rendered panel image so vision can extract signal."
      >
        <CopyRow label="Webhook URL" value={grafanaUrl} />
      </IntegrationCard>

      <IntegrationCard
        icon={<SentryLogo />}
        title="Sentry"
        subtitle="Internal integration webhook"
        connected={false}
        detail="Not yet configured"
        description="Sentry → Settings → Integrations → Internal Integrations → Create. Alerts checkbox on."
      >
        <CopyRow label="Webhook URL" value={sentryUrl} />
      </IntegrationCard>

      <IntegrationCard
        icon={<WebhookLogo />}
        title="Generic webhook"
        subtitle="Any tool that can POST JSON"
        connected={false}
        detail="For Datadog, custom scripts, and one-off automations"
        description="POST {title, message, stack?, source, severity?} to this URL."
      >
        <CopyRow label="Webhook URL" value={genericUrl} />
        <div className="mt-4">
          <div className="text-xs uppercase tracking-widest text-neutral-500 mb-2">Example</div>
          <div className="rounded-lg border border-neutral-900 bg-neutral-950 overflow-x-auto scrollbar-thin">
            <pre className="text-xs text-neutral-400 p-4 whitespace-pre-wrap break-all">
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

function IntegrationCard({
  icon,
  title,
  subtitle,
  connected,
  detail,
  description,
  children
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  connected: boolean;
  detail: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-800 rounded-xl p-5 mb-4 bg-neutral-950/40">
      <div className="flex items-start gap-4 mb-3">
        <div className="h-11 w-11 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <div className="text-base font-semibold text-neutral-100">{title}</div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest ${
                connected
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-900'
                  : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  connected ? 'bg-emerald-400' : 'bg-neutral-600'
                }`}
              />
              {connected ? 'Connected' : 'Ready to connect'}
            </span>
          </div>
          <div className="text-xs text-neutral-500 truncate" title={subtitle}>
            {subtitle}
          </div>
          <div className="text-xs text-neutral-600 mt-0.5">{detail}</div>
        </div>
      </div>
      <p className="text-sm text-neutral-400 leading-relaxed mb-4">{description}</p>
      {children}
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
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="#5865F2" aria-hidden="true">
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a13.9 13.9 0 0 0-.653 1.335 18.27 18.27 0 0 0-5.487 0A13 13 0 0 0 9.765 3a19.74 19.74 0 0 0-3.762 1.369c-2.4 3.573-3.05 7.056-2.725 10.492a19.87 19.87 0 0 0 6.06 3.06 14.3 14.3 0 0 0 1.298-2.104 12.85 12.85 0 0 1-2.041-.98c.171-.126.339-.257.5-.39a14.16 14.16 0 0 0 12.11 0c.163.134.331.265.5.39a12.9 12.9 0 0 1-2.043.98 14.31 14.31 0 0 0 1.298 2.103 19.85 19.85 0 0 0 6.061-3.059c.381-3.988-.652-7.44-2.723-10.494zM8.68 14.4c-1.183 0-2.157-1.096-2.157-2.442 0-1.347.955-2.443 2.157-2.443 1.203 0 2.176 1.096 2.157 2.443 0 1.346-.954 2.442-2.157 2.442zm6.638 0c-1.184 0-2.157-1.096-2.157-2.442 0-1.347.955-2.443 2.157-2.443 1.203 0 2.176 1.096 2.157 2.443 0 1.346-.954 2.442-2.157 2.442z" />
    </svg>
  );
}
function GrafanaLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#F46800" />
      <path d="M8 15c1 2 3 3 5 2s3-3 2-5" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="15" cy="9" r="1.4" fill="white" />
    </svg>
  );
}
function SentryLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path fill="#362D59" d="M12 3l9 15h-4l-5-8-2 4h2l1 2h-6l4-7c.4-.8 1.6-.8 2 0z" />
      <path fill="#362D59" d="M4.4 20l1.6-2.8h2l-1.6 2.8z" />
    </svg>
  );
}
function WebhookLogo() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="1.75" aria-hidden="true">
      <circle cx="7" cy="14" r="3" />
      <circle cx="17" cy="14" r="3" />
      <circle cx="12" cy="7" r="3" />
      <path d="M12 10v3l-4 3M15 12l4 2" />
    </svg>
  );
}
