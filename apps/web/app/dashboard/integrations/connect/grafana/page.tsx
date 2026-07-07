import { requireWorkspace, encodeSessionToken } from '@/lib/session';
import { isDemoWorkspace } from '@/lib/demo';
import { DemoBlockNotice } from '@/app/components/demo-block';
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
  if (isDemoWorkspace(workspace.id)) {
    return (
      <DemoBlockNotice
        title="Grafana connect is disabled here"
        detail="Wiring a service account token would let every demo visitor share the same Grafana Cloud instance. Install helena on your own Slack or Discord workspace to connect Grafana against your own data."
      />
    );
  }
  const token = encodeSessionToken(workspace.id);
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

      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-4">
          Where to get the token
        </div>
        <IntegrationWalkthrough brand="#f5a623" steps={GRAFANA_STEPS} />
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

      <form
        action="/api/auth/grafana/configure"
        method="POST"
        className="max-w-xl space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-6"
      >
        <input type="hidden" name="hs" value={token} />

        <div>
          <label htmlFor="url" className="block text-xs uppercase tracking-widest text-neutral-500 mb-1.5">
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
          <div className="text-[11px] text-neutral-500 mt-1.5">
            The full URL of your Grafana instance. Grafana Cloud shows this in the top-right
            corner.
          </div>
        </div>

        <div>
          <label htmlFor="token" className="block text-xs uppercase tracking-widest text-neutral-500 mb-1.5">
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
          <div className="text-[11px] text-neutral-500 mt-1.5">
            Administration &rarr; Users and access &rarr; Service accounts &rarr; Add token.
            Editor role or higher.
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-100"
          >
            Verify and create Contact Point
          </button>
          <a
            href={`/dashboard/integrations?hs=${encodeURIComponent(token)}`}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            Cancel
          </a>
        </div>

        <div className="pt-4 border-t border-neutral-900 text-[11px] text-neutral-500 leading-relaxed">
          What happens when you submit:
          <ol className="mt-1.5 space-y-1 list-decimal list-inside">
            <li>We validate your token by calling Grafana&rsquo;s user endpoint.</li>
            <li>We create a webhook Contact Point named <code>helena-oncall</code>.</li>
            <li>You go to Alerting &rarr; Notification Policies and route the alerts you want to that contact point.</li>
          </ol>
        </div>
      </form>
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
        In your Grafana Cloud UI, click the cog icon in the left rail. That&rsquo;s the top-level{' '}
        <span className="text-neutral-200">Administration</span> menu.
      </>
    ),
    visual: (
      <MockChrome vendor="Grafana Cloud" brand="#f5a623" path="your-stack.grafana.net">
        <div className="grid grid-cols-[100px_1fr] gap-3 min-h-[120px]">
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
        Choose <span className="text-neutral-200">Users and access</span>, then{' '}
        <span className="text-neutral-200">Service accounts</span>. Not user accounts — service
        accounts are non-human identities meant for tokens like this one.
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
        Click <span className="text-neutral-200">Add service account</span>. Name it{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena</code>, role{' '}
        <span className="text-neutral-200">Editor</span> or higher (Editor is enough to create
        a Contact Point).
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
    title: 'Add service account token, copy it once',
    detail: (
      <>
        On the new service account page, click{' '}
        <span className="text-neutral-200">Add service account token</span>. Grafana shows the
        token once — copy it now, you can&rsquo;t retrieve it later. It starts with{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">glsa_</code>.
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
    title: 'Paste URL + token in the form below',
    detail: (
      <>
        Your Grafana URL is in the top-right corner of any Grafana page (e.g.{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">your-stack.grafana.net</code>).
        Paste it and the token below — we validate the token and create a Contact Point named{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena-oncall</code>.
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
        Back in Grafana, go to{' '}
        <span className="text-neutral-200">Alerting → Notification policies</span> and add{' '}
        <code className="px-1 py-0.5 rounded bg-neutral-900 text-[11px]">helena-oncall</code>{' '}
        as the receiver for any alert group you want indexed. Only what you route reaches us.
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
