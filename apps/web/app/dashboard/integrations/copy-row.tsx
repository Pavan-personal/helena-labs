'use client';

import { useState } from 'react';

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 mb-1.5">{label}</div>
      <div className="flex gap-2 items-stretch">
        <div className="flex-1 min-w-0 bg-neutral-950 border border-neutral-900 rounded-lg overflow-hidden">
          <code className="block px-3 py-2.5 text-xs text-neutral-300 truncate">{value}</code>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 px-3 py-2 rounded-lg border border-neutral-800 text-xs text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
