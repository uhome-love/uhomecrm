import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted/60",
        className
      )}
    />
  );
}

/** Skeleton for the CEO greeting header */
export function SkeletonHeader() {
  return (
    <div className="rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 p-5">
      <div className="flex items-center gap-4">
        <Shimmer className="h-16 w-16 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-6 w-48 bg-white/10" />
          <Shimmer className="h-4 w-64 bg-white/5" />
          <Shimmer className="h-3 w-40 bg-white/5" />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        {[1, 2, 3, 4, 5].map(i => (
          <Shimmer key={i} className="h-8 w-16 rounded-full bg-white/10" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton for KPI grid rows */
export function SkeletonKpiGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      <Shimmer className="h-4 w-32" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Shimmer className="h-4 w-4 rounded" />
              <Shimmer className="h-3 w-20" />
            </div>
            <Shimmer className="h-8 w-16" />
            <Shimmer className="h-1.5 w-full rounded-full" />
            <Shimmer className="h-2.5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton for ranking cards */
export function SkeletonRankings() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Shimmer className="h-4 w-4 rounded" />
            <Shimmer className="h-4 w-28" />
          </div>
          {[1, 2, 3, 4, 5].map(j => (
            <div key={j} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                <Shimmer className="h-5 w-5 rounded" />
                <Shimmer className="h-3 w-24" />
              </div>
              <Shimmer className="h-3 w-16" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for chart bars */
export function SkeletonCharts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[1, 2].map(i => (
        <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <Shimmer className="h-4 w-32" />
          {[1, 2, 3, 4, 5].map(j => (
            <div key={j} className="space-y-1.5">
              <div className="flex justify-between">
                <Shimmer className="h-3 w-20" />
                <Shimmer className="h-3 w-8" />
              </div>
              <Shimmer className={cn("h-2 rounded-full", j === 1 ? "w-[90%]" : j === 2 ? "w-[75%]" : j === 3 ? "w-[60%]" : j === 4 ? "w-[45%]" : "w-[30%]")} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Full page skeleton for CEO dashboard */
export function CeoDashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-[1440px] mx-auto animate-in fade-in duration-300">
      <SkeletonHeader />
      {/* Roleta */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Shimmer className="h-4 w-4 rounded" />
          <Shimmer className="h-4 w-48" />
        </div>
        <Shimmer className="h-8 w-full max-w-sm" />
      </div>
      {/* KPIs */}
      <SkeletonKpiGrid count={5} />
      <SkeletonKpiGrid count={6} />
      <SkeletonKpiGrid count={4} />
      {/* Rankings */}
      <SkeletonRankings />
      {/* Charts */}
      <SkeletonCharts />
    </div>
  );
}
