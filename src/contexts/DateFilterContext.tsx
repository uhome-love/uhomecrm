import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";
import { todayBRT, dateToBRT } from "@/lib/utils";

export type GlobalPeriod = "hoje" | "ontem" | "semana" | "mes" | "ultimos_30d" | "custom";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export interface DateFilterState {
  period: GlobalPeriod;
  range: DateRange;
  label: string;
  setPeriod: (p: GlobalPeriod) => void;
  setCustomRange: (range: DateRange) => void;
}

function computeRange(period: GlobalPeriod, custom?: DateRange): DateRange {
  const now = new Date();
  switch (period) {
    case "hoje": {
      const t = todayBRT();
      return { start: t, end: t };
    }
    case "ontem": {
      const y = dateToBRT(subDays(now, 1));
      return { start: y, end: y };
    }
    case "semana":
      return {
        start: dateToBRT(startOfWeek(now, { weekStartsOn: 1 })),
        end: dateToBRT(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case "mes":
      return {
        start: dateToBRT(startOfMonth(now)),
        end: dateToBRT(endOfMonth(now)),
      };
    case "ultimos_30d":
      return {
        start: dateToBRT(subDays(now, 29)),
        end: todayBRT(),
      };
    case "custom":
      return custom || { start: todayBRT(), end: todayBRT() };
    default:
      return { start: todayBRT(), end: todayBRT() };
  }
}

function periodLabel(period: GlobalPeriod, range: DateRange): string {
  switch (period) {
    case "hoje": return "Hoje";
    case "ontem": return "Ontem";
    case "semana": return "Semana";
    case "mes": return "Mês";
    case "ultimos_30d": return "Últimos 30 dias";
    case "custom": {
      try {
        const from = format(new Date(range.start + "T12:00:00"), "dd/MM");
        const to = format(new Date(range.end + "T12:00:00"), "dd/MM");
        return `${from} — ${to}`;
      } catch {
        return "Personalizado";
      }
    }
    default: return "Hoje";
  }
}

const DateFilterContext = createContext<DateFilterState | null>(null);

export function DateFilterProvider({ children, defaultPeriod = "hoje" }: { children: ReactNode; defaultPeriod?: GlobalPeriod }) {
  const [period, setPeriodState] = useState<GlobalPeriod>(defaultPeriod);
  const [customRange, setCustomRangeState] = useState<DateRange | undefined>();

  const range = useMemo(() => computeRange(period, customRange), [period, customRange]);
  const label = useMemo(() => periodLabel(period, range), [period, range]);

  const setPeriod = useCallback((p: GlobalPeriod) => {
    if (p !== "custom") setCustomRangeState(undefined);
    setPeriodState(p);
  }, []);

  const setCustomRange = useCallback((r: DateRange) => {
    setCustomRangeState(r);
    setPeriodState("custom");
  }, []);

  const value = useMemo(() => ({
    period, range, label, setPeriod, setCustomRange,
  }), [period, range, label, setPeriod, setCustomRange]);

  return (
    <DateFilterContext.Provider value={value}>
      {children}
    </DateFilterContext.Provider>
  );
}

export function useDateFilter(): DateFilterState {
  const ctx = useContext(DateFilterContext);
  if (!ctx) throw new Error("useDateFilter must be used within DateFilterProvider");
  return ctx;
}

/**
 * Convert the global range to Supabase-friendly timestamps with BRT offset.
 */
export function rangeToTimestamps(range: DateRange) {
  return {
    startTs: `${range.start}T00:00:00-03:00`,
    endTs: `${range.end}T23:59:59.999-03:00`,
  };
}
