import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { isDemoWorkspace } from '@/lib/demo';
import { DemoConnectPanel } from '@/app/components/demo-block';
import {
  IntegrationWalkthrough,
  MockChrome,
  MockRow,
  MockField,
  MockButton,
  MockCheckbox,
  type WalkStep
} from '@/app/components/integration-walkthrough';

export const dynamic = 'force-dynamic';

export default async function ConnectSentryPage({
  searchParams
}: {
  searchParams: Promise<{ err?: string; hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
  const isDemo = isDemoWorkspace(workspace.id);
  const alreadyConnected = Boolean(workspace.sentry_org_slug && workspace.sentry_token);

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Connect · Sentry
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Connect your Sentry organization
        </h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Sentry Internal Integrations use a token instead of OAuth. Paste your org slug and the
          Integration token here. Any alert rule in your org that fires helena&rsquo;s webhook
          will land in your incident memory.
        </p>
      </div>

      {params.err && (
        <div className="border border-red-950 bg-red-950/30 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {decodeErr(params.err)}
        </div>
      )}
      {alreadyConnected && (
        <div className="border border-emerald-950 bg-emerald-950/20 text-emerald-300 rounded-lg p-3 mb-6 text-sm">
          Already connected to <code>{workspace.sentry_org_slug}</code> with{' '}
          {workspace.sentry_projects?.length ?? 0} project(s). Submitting will replace the
          existing configuration.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-start">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-5">
            Where to get the token
          </div>
          <IntegrationWalkthrough brand="#c9a6ff" steps={SENTRY_STEPS} />
        </div>

        <div className="lg:sticky lg:top-8">
          {isDemo ? (
            <DemoConnectPanel brand="#c9a6ff" />
          ) : (
          <form
            action="/api/auth/sentry/configure"
            method="POST"
            className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5"
          >
            <input type="hidden" name="hs" value={token} />

            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#c9a6ff' }} />
              Paste it here
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="orgSlug" className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                  Organization slug
                </label>
                <input
                  id="orgSlug"
                  name="orgSlug"
                  type="text"
                  required
                  defaultValue={workspace.sentry_org_slug ?? ''}
                  placeholder="your-org"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label htmlFor="token" className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                  Integration token
                </label>
                <input
                  id="token"
                  name="token"
                  type="password"
                  required
                  placeholder="64-character hex token"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-100"
                >
                  Verify and connect
                </button>
                <a
                  href={`/dashboard/integrations?hs=${encodeURIComponent(token)}`}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Cancel
                </a>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-900 text-[11px] text-neutral-500 leading-relaxed">
              We validate the token, fetch your org + project list, and auto-create alert rules
              on each project that route back to helena.
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
}

function decodeErr(err: string): string {
  switch (err) {
    case 'invalid_token':
      return 'The token was rejected. Check the token permissions include Project + Organization Read.';
    case 'invalid_org':
      return 'That org slug was not found. Check the URL format: sentry.io/organizations/<slug>/';
    case 'save_failed':
      return 'Could not save the configuration. Try again.';
    default:
      return `Something went wrong: ${err}`;
  }
}

const SENTRY_STEPS: WalkStep[] = [
  {
    n: '01',
    title: 'Open Sentry Settings',
    detail: (
      <>
        In Sentry, click your org avatar top-left, then{' '}
        <span className="text-neutral-200">Settings</span>. You need to be an org owner or
        manager to create integrations.
      </>
    ),
    visual: (
      <MockChrome vendor="Sentry" brand="#c9a6ff" path="/settings/organization">
        <div className="grid grid-cols-[170px_1fr] gap-3 min-h-[140px]">
          <div className="rounded-md border border-neutral-900 bg-neutral-950 p-2 space-y-1">
            <MockRow label="General" />
            <MockRow label="Projects" />
            <MockRow label="Teams" />
            <MockRow label="Developer" active />
            <MockRow label="Billing" />
          </div>
          <div className="rounded-md border border-neutral-900 bg-neutral-950/40 p-3 text-[11px] text-neutral-500">
            Custom Integrations · Client Keys · Auth Tokens · Webhooks
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '02',
    title: 'Developer Settings → Custom Integrations → New Internal Integration',
    detail: (
      <>
        Go to <span className="text-neutral-200">Developer Settings</span>, then{' '}
        <span className="text-neutral-200">Custom Integrations</span>, then click{' '}
        <span className="text-neutral-200">New Internal Integration</span>.
      </>
    ),
    visual: (
      <MockChrome vendor="Sentry" brand="#c9a6ff" path="/settings/developer-settings">
        <div className="space-y-2">
          <MockRow label="Public Integrations" meta="0" />
          <MockRow label="Internal Integrations" meta="0 → 1" active />
          <div className="pt-2">
            <MockButton primary>+ New Internal Integration</MockButton>
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '03',
    title: 'Name it helena and set scopes',
    detail: (
      <>
        Name it <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena</code>.
        Under <span className="text-neutral-200">Permissions</span>, grant{' '}
        <span className="text-neutral-200">Read</span> on Project, Organization, Issue &amp; Event,
        Alerts. That&rsquo;s the minimum for us to look up context on incoming alerts.
      </>
    ),
    visual: (
      <MockChrome vendor="Sentry" brand="#c9a6ff" path="/settings/developer-settings/new-internal">
        <div className="space-y-3">
          <MockField label="Name" value="helena" highlight />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
              Permissions
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <MockCheckbox label="Project: Read" checked />
              <MockCheckbox label="Organization: Read" checked />
              <MockCheckbox label="Issue & Event: Read" checked />
              <MockCheckbox label="Alerts: Read" checked />
              <MockCheckbox label="Team: No access" />
              <MockCheckbox label="Member: No access" />
            </div>
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '04',
    title: 'Enable webhook subscription for Alert Rule Action',
    detail: (
      <>
        Still on the same form, scroll to{' '}
        <span className="text-neutral-200">Webhooks</span> and toggle on{' '}
        <span className="text-neutral-200">Alert Rule Action</span>. This is what lets helena
        appear as a target when you create Sentry alert rules.
      </>
    ),
    visual: (
      <MockChrome vendor="Sentry" brand="#c9a6ff" path="/settings/developer-settings/new-internal">
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
            Webhooks
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <MockCheckbox label="Issue" />
            <MockCheckbox label="Error" />
            <MockCheckbox label="Comment" />
            <MockCheckbox label="Alert Rule Action" checked />
          </div>
          <div className="pt-2">
            <MockButton primary>Save Changes</MockButton>
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '05',
    title: 'Copy the token and org slug',
    detail: (
      <>
        After saving, Sentry reveals a <span className="text-neutral-200">Tokens</span> section
        at the top of the integration page. Copy the token. Your{' '}
        <span className="text-neutral-200">org slug</span> is the part after{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">/organizations/</code>{' '}
        in your Sentry URL.
      </>
    ),
    visual: (
      <MockChrome vendor="Sentry" brand="#c9a6ff" path="/settings/developer-settings/helena">
        <div className="space-y-3">
          <MockField label="Org slug" value="acme-eng" highlight />
          <MockField label="Token (Sentry Auth Token)" value="a1b2c3d4e5f6••••••••••" highlight />
          <div className="text-[10px] text-amber-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Treat like a password. Never commit to a repo.
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '06',
    title: 'Paste both in the form below',
    detail: (
      <>
        Drop the org slug and token in the fields below. We validate the token against Sentry
        and auto-create Issue Alert Rules on each of your projects pointing at our webhook.
      </>
    ),
    visual: (
      <MockChrome vendor="helena" brand="#38bdf8" path="/dashboard/integrations/connect/sentry">
        <div className="space-y-3">
          <MockField label="Sentry organization slug" value="acme-eng" />
          <MockField label="Integration token" value="a1b2c3d4••••••••••" />
          <MockButton primary>Verify and connect</MockButton>
        </div>
      </MockChrome>
    )
  }
];
