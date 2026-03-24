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
    <div className="rounded-[14px] bg-[#f7f7fb] dark:bg-[#1c1c20] border border-[#e8e8f0] dark:border-white/[0.07] p-5">
      <div className="flex items-center gap-4">
        <Shimmer className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-5 w-48" />
          <Shimmer className="h-3 w-64" />
        </div>
        <div className="space-y-2 text-right">
          <Shimmer className="h-3 w-32 ml-auto" />
          <Shimmer className="h-3 w-24 ml-auto" />
        </div>
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
