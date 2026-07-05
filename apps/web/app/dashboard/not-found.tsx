import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-12 text-center">
      <Compass className="h-8 w-8 text-neutral-700 mx-auto mb-3" strokeWidth={1.5} />
      <div className="text-sm text-neutral-300 mb-1">Page not found</div>
      <div className="text-xs text-neutral-500 mb-6">
        The link may be stale or the record may have been removed.
      </div>
      <Link
        href="/dashboard"
        className="inline-block px-4 py-2 rounded-lg bg-white text-neutral-900 text-sm font-medium hover:bg-neutral-100"
      >
        Back to overview
      </Link>
    </div>
  );
}
