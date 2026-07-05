export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-neutral-900 rounded" />
      <div className="grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-neutral-800 bg-neutral-900/40" />
        ))}
      </div>
      <div className="h-6 w-40 bg-neutral-900 rounded" />
      <div className="rounded-lg border border-neutral-800 divide-y divide-neutral-800">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-4 h-16" />
        ))}
      </div>
    </div>
  );
}
