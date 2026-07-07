import type { ReactNode } from 'react';

/**
 * Numbered step + labeled mockup layout for integration connect pages.
 * Mockups are inline SVG/HTML approximations of the vendor UI so we
 * don't ship third-party screenshots or hotlink external assets.
 */

export interface WalkStep {
  n: string;
  title: string;
  detail: ReactNode;
  visual: ReactNode;
}

export function IntegrationWalkthrough({
  brand,
  steps
}: {
  brand: string;
  steps: WalkStep[];
}) {
  return (
    <div className="space-y-6">
      {steps.map((s, i) => (
        <div
          key={s.n}
          className="grid grid-cols-1 md:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] gap-6 md:gap-8 relative"
        >
          <div className="relative">
            <div className="flex items-start gap-3">
              <div
                className="shrink-0 h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-center text-[11px] font-mono font-semibold"
                style={{ color: brand }}
              >
                {s.n}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white leading-tight mb-1.5">
                  {s.title}
                </div>
                <div className="text-[12px] text-neutral-400 leading-relaxed">{s.detail}</div>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="hidden md:block absolute left-[15px] top-9 bottom-[-24px] w-px bg-neutral-900" />
            )}
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden">
            {s.visual}
          </div>
        </div>
      ))}
    </div>
  );
}

/* SHARED ATOMS FOR MOCKUPS */

export function MockChrome({
  vendor,
  brand,
  path,
  children
}: {
  vendor: string;
  brand: string;
  path: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-2 border-b border-neutral-900 flex items-center gap-2 text-[11px]">
        <div className="flex gap-1">
          <div className="h-2 w-2 rounded-full bg-neutral-800" />
          <div className="h-2 w-2 rounded-full bg-neutral-800" />
          <div className="h-2 w-2 rounded-full bg-neutral-800" />
        </div>
        <div className="flex items-center gap-1.5 ml-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: brand }} />
          <span className="text-neutral-300 font-medium">{vendor}</span>
        </div>
        <span className="text-neutral-700">·</span>
        <span className="text-neutral-500 font-mono text-[10px]">{path}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function MockRow({
  label,
  meta,
  active
}: {
  label: string;
  meta?: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-md text-xs ${
        active ? 'bg-neutral-800/70 text-neutral-100 border border-neutral-700' : 'text-neutral-400'
      }`}
    >
      <span>{label}</span>
      {meta && <span className="text-[10px] text-neutral-500 font-mono">{meta}</span>}
    </div>
  );
}

export function MockField({
  label,
  value,
  highlight
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">
        {label}
      </div>
      <div
        className={`px-3 py-2 rounded-md border text-[12px] font-mono ${
          highlight
            ? 'border-neutral-600 bg-neutral-900 text-neutral-100'
            : 'border-neutral-900 bg-neutral-950 text-neutral-400'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function MockButton({
  children,
  primary
}: {
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] ${
        primary
          ? 'bg-white text-neutral-900 font-medium'
          : 'border border-neutral-800 text-neutral-300'
      }`}
    >
      {children}
    </span>
  );
}

export function MockCheckbox({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-300">
      <span
        className={`h-3 w-3 rounded border flex items-center justify-center ${
          checked
            ? 'border-emerald-700 bg-emerald-900/40 text-emerald-300'
            : 'border-neutral-700 bg-neutral-950'
        }`}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-2 w-2" aria-hidden="true">
            <path
              d="M2 6l3 3 5-6"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className={checked ? 'text-neutral-200' : ''}>{label}</span>
    </div>
  );
}
