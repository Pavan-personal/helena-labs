import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { isDemoWorkspace } from '@/lib/demo';
import { DemoConnectPanel } from '@/app/components/demo-block';
import {
  IntegrationWalkthrough,
  MockChrome,
  MockRow,
  MockField,
  MockButton,
  type WalkStep
} from '@/app/components/integration-walkthrough';

export const dynamic = 'force-dynamic';

export default async function ConnectGrafanaPage({
  searchParams
}: {
  searchParams: Promise<{ err?: string; hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
  const isDemo = isDemoWorkspace(workspace.id);
  const alreadyConnected = Boolean(workspace.grafana_url && workspace.grafana_token);

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          Connect · Grafana Cloud
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
          Connect your Grafana instance
        </h1>
        <p className="text-sm text-neutral-500 max-w-2xl">
          Give helena a Grafana service account token and we&rsquo;ll create the webhook Contact
          Point on your side automatically. You still attach it to the alerts you want to route to
          us &mdash; that scope decision stays yours.
        </p>
      </div>

      {params.err && (
        <div className="border border-red-950 bg-red-950/30 text-red-300 rounded-lg p-3 mb-6 text-sm">
          {decodeErr(params.err)}
        </div>
      )}
      {alreadyConnected && (
        <div className="border border-emerald-950 bg-emerald-950/20 text-emerald-300 rounded-lg p-3 mb-6 text-sm">
          Already connected to <code>{workspace.grafana_url}</code>. Submitting will replace the
          existing configuration.
        </div>
      )}

      {/* Two-column: walkthrough on the left scrolls, form on the right sticks. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-start">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-5">
            Where to get the token
          </div>
          <IntegrationWalkthrough brand="#f5a623" steps={GRAFANA_STEPS} />
        </div>

        <div className="lg:sticky lg:top-8">
          {isDemo ? (
            <DemoConnectPanel brand="#f5a623" />
          ) : (
          <form
            action="/api/auth/grafana/configure"
            method="POST"
            className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-5"
          >
            <input type="hidden" name="hs" value={token} />

            <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#f5a623' }} />
              Paste it here
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                  Grafana URL
                </label>
                <input
                  id="url"
                  name="url"
                  type="url"
                  required
                  defaultValue={workspace.grafana_url ?? ''}
                  placeholder="https://your-stack.grafana.net"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-800 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="token" className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">
                  Service account token
                </label>
                <input
                  id="token"
                  name="token"
                  type="password"
                  required
                  placeholder="glsa_..."
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
              On submit we validate the token, create a webhook Contact Point named{' '}
              <code>helena-oncall</code>, then you pick which alerts route to it from Grafana&rsquo;s
              notification policies.
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
      return 'The token was rejected by Grafana. Make sure it starts with glsa_ and has Editor or higher permission.';
    case 'invalid_url':
      return 'That URL does not look like a valid Grafana instance URL.';
    case 'contact_point_failed':
      return 'We could not create the Contact Point. Check the token permissions.';
    default:
      return `Something went wrong: ${err}`;
  }
}

const GRAFANA_STEPS: WalkStep[] = [
  {
    n: '01',
    title: 'Open Administration',
    detail: (
      <>
        Click the cog icon in Grafana&rsquo;s left rail —{' '}
        <span className="text-neutral-200">Administration</span>.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="your-stack.grafana.net">
        <div className="grid grid-cols-[160px_1fr] gap-3 min-h-[140px]">
          <div className="rounded-md border border-neutral-900 bg-neutral-950 p-2 space-y-1">
            <MockRow label="Home" />
            <MockRow label="Dashboards" />
            <MockRow label="Alerting" />
            <MockRow label="Administration" active />
          </div>
          <div className="rounded-md border border-neutral-900 bg-neutral-950/40 p-3 text-[11px] text-neutral-500">
            Users and access · Plugins · Data sources · Cost management
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '02',
    title: 'Users and access → Service accounts',
    detail: (
      <>
        <span className="text-neutral-200">Service accounts</span>, not user accounts. Service
        accounts are non-human identities for tokens like this.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="/org/serviceaccounts">
        <div className="space-y-1">
          <MockRow label="Users" />
          <MockRow label="Teams" />
          <MockRow label="Service accounts" active meta="0 accounts" />
          <MockRow label="Role picker" />
          <MockRow label="External sync" />
        </div>
      </MockChrome>
    )
  },
  {
    n: '03',
    title: 'Add a service account named helena',
    detail: (
      <>
        Name it <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena</code>,
        role <span className="text-neutral-200">Editor</span> — enough to create Contact Points.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="/org/serviceaccounts/create">
        <div className="space-y-3">
          <MockField label="Display name" value="helena" highlight />
          <MockField label="Role" value="Editor" highlight />
          <div className="flex items-center gap-2">
            <MockButton primary>Create</MockButton>
            <MockButton>Cancel</MockButton>
          </div>
        </div>
      </MockChrome>
    )
  },
  {
    n: '04',
    title: 'Add token — copy it once',
    detail: (
      <>
        Click <span className="text-neutral-200">Add service account token</span>. Starts with{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">glsa_</code>. Shown
        once — copy before leaving.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="/org/serviceaccounts/helena">
        <div className="space-y-3">
          <div className="text-[11px] text-neutral-500">helena · Editor</div>
          <MockField label="Token" value="glsa_xxxxxxxxxxxxxxxx" highlight />
          <div className="text-[10px] text-amber-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Shown once. Copy before leaving this page.
          </div>
          <MockButton primary>Copy token</MockButton>
        </div>
      </MockChrome>
    )
  },
  {
    n: '05',
    title: 'Paste URL + token here',
    detail: (
      <>
        URL is in Grafana&rsquo;s top-right corner. Paste both into the form on the right — we
        auto-create <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena-oncall</code>{' '}
        Contact Point.
      </>
    ),
    visual: (
      <MockChrome vendor="helena" brand="#38bdf8" path="/dashboard/integrations/connect/grafana">
        <div className="space-y-3">
          <MockField label="Grafana URL" value="https://your-stack.grafana.net" />
          <MockField label="Service account token" value="glsa_••••••••••••" />
          <MockButton primary>Verify and create Contact Point</MockButton>
        </div>
      </MockChrome>
    )
  },
  {
    n: '06',
    title: 'Route the alerts you want',
    detail: (
      <>
        <span className="text-neutral-200">Alerting → Notification policies</span>. Add{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena-oncall</code>{' '}
        as receiver for alerts you want indexed. Only routed alerts reach us.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="/alerting/routes">
        <div className="space-y-2 text-[11px]">
          <div className="rounded border border-neutral-900 bg-neutral-950 p-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-200">Default policy</span>
              <span className="text-neutral-500">grafana-default-email</span>
            </div>
          </div>
          <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-2">
            <div className="flex items-center justify-between">
              <span className="text-emerald-200">Contact: helena-oncall</span>
              <span className="text-emerald-400 text-[10px]">newly created</span>
            </div>
          </div>
        </div>
      </MockChrome>
    )
  }
];
