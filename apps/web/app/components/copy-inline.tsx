'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function CopyInline({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {}
      }}
      className="group w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-neutral-700 text-left"
    >
      <code className="flex-1 text-[11px] text-neutral-200 font-mono truncate">{value}</code>
      <span
        className={`shrink-0 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest ${
          copied ? 'text-emerald-300' : 'text-neutral-500 group-hover:text-neutral-300'
        }`}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" strokeWidth={2.25} />
            copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" strokeWidth={1.75} />
            copy
          </>
        )}
      </span>
    </button>
  );
}
