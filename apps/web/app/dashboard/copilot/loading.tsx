export default function CopilotLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-56 bg-neutral-900 rounded mb-1" />
      <div className="h-4 w-96 bg-neutral-900 rounded mb-6" />
      <div className="grid grid-cols-[240px_1fr] gap-4 h-[calc(100vh-14rem)]">
        <div className="border border-neutral-800 rounded-xl bg-neutral-950/40" />
        <div className="border border-neutral-800 rounded-xl bg-neutral-950/40" />
      </div>
    </div>
  );
}
