import { useState, useEffect, useRef } from "react";
import { Calendar, ChevronDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type DateFilter =
  | "hoje"
  | "ontem"
  | "semana"
  | "mes"
  | "personalizado";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

interface GreetingBarProps {
  /** Nome do usuário logado */
  name: string;
  /** Subtítulo — data por padrão, pode ser frase motivacional para corretor */
  subtitle?: string;
  /** URL ou null para usar iniciais */
  avatarUrl?: string | null;
  /** Filtro ativo controlado externamente */
  filter?: DateFilter;
  /** Período personalizado controlado externamente */
  dateRange?: DateRange;
  /** Callback ao mudar filtro */
  onFilterChange?: (filter: DateFilter, range?: DateRange) => void;
  /** Callback ao clicar em atualizar */
  onRefresh?: () => void;
  /** Hora exibida no botão de refresh — se omitido usa hora atual */
  refreshTime?: string;
  /** Hide the date filter dropdown (default: true) */
  showFilter?: boolean;
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FILTER_LABELS: Record<DateFilter, string> = {
  hoje:          "Hoje",
  ontem:         "Ontem",
  semana:        "Esta semana",
  mes:           "Este mês",
  personalizado: "Personalizado",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function getEmoji(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "☀️";
  if (h >= 12 && h < 18) return "👋";
  return "🌙";
}

function getDefaultSubtitle(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" });
  const day = now.toLocaleDateString("pt-BR", { day: "numeric", month: "long", timeZone: "America/Sao_Paulo" });
  const brtDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const week = getWeekNumber(brtDate);
  return `${weekday}, ${day} · Semana ${week}`;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function getCurrentTime(): string {
  return new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTodayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function getFirstDayOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function GreetingBar({
  name,
  subtitle,
  avatarUrl = null,
  filter: controlledFilter,
  dateRange: controlledRange,
  onFilterChange,
  onRefresh,
  refreshTime,
  showFilter = true,
  className,
}: GreetingBarProps) {
  const [internalFilter, setInternalFilter] = useState<DateFilter>("hoje");
  const [internalRange, setInternalRange] = useState<DateRange>({
    from: getFirstDayOfMonthISO(),
    to: getTodayISO(),
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(getCurrentTime());
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filter = controlledFilter ?? internalFilter;
  const dateRange = controlledRange ?? internalRange;

  // Atualiza relógio a cada minuto
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getCurrentTime()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleFilterPick(f: DateFilter) {
    if (f !== "personalizado") {
      setDropdownOpen(false);
    }
    if (!controlledFilter) setInternalFilter(f);
    onFilterChange?.(f, f === "personalizado" ? dateRange : undefined);
  }

  function handleRangeApply() {
    setDropdownOpen(false);
    onFilterChange?.("personalizado", dateRange);
  }

  function handleRangeChange(field: "from" | "to", value: string) {
    const next = { ...dateRange, [field]: value };
    if (!controlledRange) setInternalRange(next);
  }

  const initials = getInitials(name);
  const displaySubtitle = subtitle ?? getDefaultSubtitle();
  const displayTime = refreshTime ?? currentTime;

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 rounded-[14px] bg-[#4F46E5] px-6 py-[18px] overflow-hidden",
        className
      )}
    >
      {/* Decoração */}
      <span
        className="pointer-events-none absolute -right-16 -top-24 h-[280px] w-[280px] rounded-full border border-white/[0.07]"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-[-60px] right-[60px] h-[140px] w-[140px] rounded-full border border-white/[0.06]"
        aria-hidden
      />

      {/* Avatar */}
      <div className="relative z-10 h-[46px] w-[46px] flex-shrink-0 rounded-full border-2 border-white/30 bg-white/[0.18] overflow-hidden flex items-center justify-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-[15px] font-extrabold text-white">{initials}</span>
        )}
      </div>

      {/* Texto */}
      <div className="relative z-10 min-w-0 flex-1">
        <p className="text-[16px] font-extrabold tracking-[-0.3px] text-white leading-snug">
          {getGreeting()}, {(() => { const f = name.split(" ")[0]; return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase(); })()}! {getEmoji()}
        </p>
        <p className="mt-0.5 text-[11.5px] font-medium text-white/55">
          {displaySubtitle}
        </p>
      </div>

      {/* Filtro dropdown */}
      {showFilter && (
      <div className="relative z-10 flex-shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className={cn(
            "flex h-[34px] items-center gap-[7px] rounded-[8px] border border-white/25 bg-white/15 px-3",
            "text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.22]",
            dropdownOpen && "bg-white/25"
          )}
        >
          <Calendar className="h-[13px] w-[13px] text-white/70" strokeWidth={2} />
          <span>{FILTER_LABELS[filter]}</span>
          <ChevronDown
            className={cn(
              "h-[13px] w-[13px] text-white/70 transition-transform duration-150",
              dropdownOpen && "rotate-180"
            )}
            strokeWidth={2}
          />
        </button>

        {/* Menu */}
        {dropdownOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[168px] rounded-[10px] border border-[#e8e8f0] bg-white p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.06)]">
            {(
              [
                { key: "hoje",   label: "Hoje",         icon: "clock" },
                { key: "ontem",  label: "Ontem",        icon: "chevron-left" },
                { key: "semana", label: "Esta semana",  icon: "calendar" },
                { key: "mes",    label: "Este mês",     icon: "calendar-days" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleFilterPick(key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[7px] px-[10px] py-2",
                  "text-[13px] font-medium text-[#3f3f46] transition-colors hover:bg-[#f4f4f8]",
                  filter === key && "bg-[#f0f0ff] font-semibold text-[#4F46E5]"
                )}
              >
                {label}
              </button>
            ))}

            <div className="my-1 h-px bg-[#f0f0f5]" />

            <button
              onClick={() => handleFilterPick("personalizado")}
              className={cn(
                "flex w-full items-center gap-2 rounded-[7px] px-[10px] py-2",
                "text-[13px] font-medium text-[#3f3f46] transition-colors hover:bg-[#f4f4f8]",
                filter === "personalizado" && "bg-[#f0f0ff] font-semibold text-[#4F46E5]"
              )}
            >
              Personalizado
            </button>

            {/* Date range picker */}
            {filter === "personalizado" && (
              <div className="border-t border-[#f0f0f5] mt-1 pt-2 px-1 pb-1">
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={(e) => handleRangeChange("from", e.target.value)}
                    className="h-[30px] flex-1 rounded-[6px] border border-[#e8e8f0] bg-[#f7f7fb] px-2 text-[11px] text-[#0a0a0f] outline-none focus:border-[#4F46E5] focus:bg-white"
                  />
                  <span className="text-[11px] text-[#a1a1aa] font-medium">—</span>
                  <input
                    type="date"
                    value={dateRange.to}
                    onChange={(e) => handleRangeChange("to", e.target.value)}
                    className="h-[30px] flex-1 rounded-[6px] border border-[#e8e8f0] bg-[#f7f7fb] px-2 text-[11px] text-[#0a0a0f] outline-none focus:border-[#4F46E5] focus:bg-white"
                  />
                  <button
                    onClick={handleRangeApply}
                    className="h-[30px] rounded-[6px] bg-[#4F46E5] px-2.5 text-[11px] font-semibold text-white hover:bg-[#4338CA] transition-colors whitespace-nowrap"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      {/* Refresh */}
      <button
        onClick={onRefresh}
        className="relative z-10 flex flex-shrink-0 items-center gap-1 text-[11px] text-white/40 transition-colors hover:text-white/70"
        title="Atualizar dados"
      >
        <RefreshCw className="h-3 w-3" strokeWidth={2} />
        {displayTime}
      </button>
    </div>
  );
}

export default GreetingBar;
