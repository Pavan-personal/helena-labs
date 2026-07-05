import { requireWorkspace, encodeSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ConnectGrafanaPage({
  searchParams
}: {
  searchParams: Promise<{ err?: string; hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
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
