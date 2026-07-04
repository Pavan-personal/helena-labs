import { requireWorkspace } from '@/lib/session';
import { CopyRow } from './copy-row';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage() {
  const workspace = await requireWorkspace();
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://helenalabs.vercel.app';

  const grafanaUrl = `${origin}/api/grafana/webhook/${workspace.webhook_secret}`;
  const sentryUrl = `${origin}/api/errors/sentry/${workspace.webhook_secret}`;
  const genericUrl = `${origin}/api/errors/generic/${workspace.webhook_secret}`;
  const slashCommandUrl = `${origin}/api/slack/command`;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Integrations</h1>
      <p className="text-sm text-neutral-500 mb-8">
        These URLs are unique to your workspace. Paste them into each tool. Anyone with a URL
        can push incidents to your memory, so treat them like secrets.
      </p>

      <Section
        title="Slack"
        status={workspace.incident_channel_name ? `Ingesting from #${workspace.incident_channel_name}` : 'No channel selected'}
        description="Messages, screenshots, and threads posted here are indexed automatically. Bot joined during onboarding."
      />

      <Section
        title="Grafana Cloud"
        status="Alert webhook"
        description="Grafana Alerting → Contact points → Add contact point → Webhook. Include the rendered panel image so vision can extract signal."
      >
        <CopyRow label="Webhook URL" value={grafanaUrl} />
      </Section>

      <Section
        title="Sentry"
        status="Internal integration webhook"
        description="Sentry → Settings → Integrations → Internal Integrations → Create. Alerts checkbox on."
      >
        <CopyRow label="Webhook URL" value={sentryUrl} />
      </Section>

      <Section
        title="Generic webhook"
        status="Any tool that can POST JSON"
        description="POST {title, message, stack?, source, severity?} to this URL. Use for Datadog, custom scripts, or apps that do not have a first class integration yet."
      >
        <CopyRow label="Webhook URL" value={genericUrl} />
        <div className="mt-3 text-xs text-neutral-500">
          <div className="font-medium text-neutral-400 mb-1">Example</div>
          <pre className="bg-neutral-950 border border-neutral-900 rounded p-3 overflow-x-auto text-xs">
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
      </Section>

      <Section
        title="Slack slash command"
        status="Configured at Slack app level"
        description={`Point your Slack app's /askoncall command at this URL if you have not already.`}
      >
        <CopyRow label="Slash command URL" value={slashCommandUrl} />
      </Section>
    </div>
  );
}

function Section({
  title,
  status,
  description,
  children
}: {
  title: string;
  status: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-800 rounded-lg p-5 mb-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="text-lg font-medium">{title}</div>
          <div className="text-xs text-neutral-500 mt-0.5">{status}</div>
        </div>
      </div>
      <p className="text-sm text-neutral-400 leading-relaxed mb-4">{description}</p>
      {children}
    </div>
  );
}
