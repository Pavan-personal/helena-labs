import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <h1 className="text-5xl font-bold mb-4 tracking-tight">helena</h1>
        <p className="text-lg text-neutral-400 mb-8 leading-relaxed">
          Incident memory for on call teams. Ingests from Slack, Grafana, Sentry, and any generic
          webhook. Surfaces past resolutions when a new alert fires. Auto drafts runbooks from
          resolved threads.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs uppercase text-neutral-500 mb-2">Ingest sources</div>
            <ul className="text-sm space-y-1">
              <li>Slack messages + screenshots</li>
              <li>Grafana Cloud alerts</li>
              <li>Sentry issues</li>
              <li>Generic JSON webhook</li>
            </ul>
          </div>
          <div className="border border-neutral-800 rounded-lg p-4">
            <div className="text-xs uppercase text-neutral-500 mb-2">Pipeline</div>
            <ul className="text-sm space-y-1">
              <li>Vision on screenshots</li>
              <li>Postgres FTS retrieval</li>
              <li>DeepSeek rerank + synth</li>
              <li>Nightly runbook drafts</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded bg-white text-black font-medium hover:bg-neutral-200"
          >
            Open dashboard
          </Link>
          <a
            href="https://github.com/Pavan-personal/helena-labs"
            className="px-4 py-2 rounded border border-neutral-700 hover:border-neutral-500"
          >
            View source
          </a>
        </div>
      </div>
    </main>
  );
}
