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
      // best effort
    }
  }

  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1.5">{label}</div>
      <div className="flex gap-2">
        <code className="flex-1 bg-neutral-950 border border-neutral-900 rounded px-3 py-2 text-xs overflow-x-auto whitespace-nowrap">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="px-3 py-2 rounded border border-neutral-700 text-xs hover:border-neutral-500"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
