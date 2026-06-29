import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export interface ChartPoint {
  label: string;
  value: number;
}

interface BaseProps {
  title?: string;
  data: ChartPoint[];
  loading?: boolean;
  height?: number;
  valueFormatter?: (v: number) => string;
  emptyLabel?: string;
}

function ChartShell({
  title,
  loading,
  empty,
  emptyLabel = "Sem dados no período.",
  height = 180,
  children,
}: {
  title?: string;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="central-card overflow-hidden">
      {title ? (
        <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          {title}
        </div>
      ) : null}
      <div className="p-3" style={{ minHeight: height }}>
        {loading ? (
          <Skeleton className="h-[160px] w-full" />
        ) : empty ? (
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const axisStyle = {
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))",
};

function TooltipContent({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="font-medium text-popover-foreground">{label}</div>
      <div className="text-muted-foreground">
        {valueFormatter ? valueFormatter(v) : v.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

export function TrendAreaChart({
  title,
  data,
  loading,
  height = 200,
  valueFormatter,
  emptyLabel,
}: BaseProps) {
  const empty = !loading && (!data || data.length === 0);
  return (
    <ChartShell title={title} loading={loading} empty={empty} emptyLabel={emptyLabel} height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="centralAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipContent valueFormatter={valueFormatter} />} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#centralAreaFill)"
        />
      </AreaChart>
    </ChartShell>
  );
}

export function SimpleBarChart({
  title,
  data,
  loading,
  height = 200,
  valueFormatter,
  emptyLabel,
  highlightIndex,
}: BaseProps & { highlightIndex?: number }) {
  const empty = !loading && (!data || data.length === 0);
  return (
    <ChartShell title={title} loading={loading} empty={empty} emptyLabel={emptyLabel} height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          content={<TooltipContent valueFormatter={valueFormatter} />}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={
                highlightIndex === i
                  ? "hsl(var(--primary))"
                  : "hsl(var(--primary) / 0.55)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartShell>
  );
}
