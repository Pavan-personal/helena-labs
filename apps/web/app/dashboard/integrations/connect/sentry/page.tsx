import { requireWorkspace, encodeSessionToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function ConnectSentryPage({
  searchParams
}: {
  searchParams: Promise<{ err?: string; hs?: string }>;
}) {
  const params = await searchParams;
  const workspace = await requireWorkspace(params.hs);
  const token = encodeSessionToken(workspace.id);
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

      <form
        action="/api/auth/sentry/configure"
        method="POST"
        className="max-w-xl space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/40 p-6"
      >
        <input type="hidden" name="hs" value={token} />

        <div>
          <label htmlFor="orgSlug" className="block text-xs uppercase tracking-widest text-neutral-500 mb-1.5">
            Sentry organization slug
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
          <div className="text-[11px] text-neutral-500 mt-1.5">
            From your Sentry URL: <code>sentry.io/organizations/&lt;slug&gt;/</code>
          </div>
        </div>

        <div>
          <label htmlFor="token" className="block text-xs uppercase tracking-widest text-neutral-500 mb-1.5">
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
          <div className="text-[11px] text-neutral-500 mt-1.5">
            Settings &rarr; Custom Integrations &rarr; helena &rarr; Tokens section. Needs
            Project, Organization, Alerts, Issue &amp; Event Read permissions.
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-100"
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

        <div className="pt-4 border-t border-neutral-900 text-[11px] text-neutral-500 leading-relaxed">
          What happens when you submit:
          <ol className="mt-1.5 space-y-1 list-decimal list-inside">
            <li>We validate your token by fetching your org and project list.</li>
            <li>We store the token so we can look up context when alerts fire.</li>
            <li>Any Sentry alert rule that already routes to your webhook URL keeps working.</li>
          </ol>
        </div>
      </form>
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
