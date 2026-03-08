import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton placeholder for a standard card with title + 3 metric rows */
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <Skeleton className="h-5 w-2/3" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  );
}

/** Skeleton placeholder for a list of items */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/** Skeleton for the arena list selection cards */
export function SkeletonArenaCard() {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#1C2128", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Skeleton className="h-5 w-2/3 bg-white/10" />
      <div className="flex gap-4">
        <Skeleton className="h-8 w-16 bg-white/10" />
        <Skeleton className="h-8 w-16 bg-white/10" />
        <Skeleton className="h-8 w-16 bg-white/10" />
      </div>
      <Skeleton className="h-2 w-full rounded bg-white/10" />
      <Skeleton className="h-10 w-full rounded-lg bg-white/10" />
    </div>
  );
}

/** Skeleton for pipeline kanban columns */
export function SkeletonKanban() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="min-w-[280px] space-y-3">
          <Skeleton className="h-6 w-32" />
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
