import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { GreetingBar } from "@/components/ui/GreetingBar";
import GlobalDateFilterBar from "@/components/GlobalDateFilterBar";

export default function DesktopHeader({model}: {model:CeoDashboardController}) {
const { user, period, range, frase, setDispatchOpen, filaCeoCount, lastUpdate, profile, reload, hoje } = model;
return <>      {/* ═══ GREETING ═══ */}
      <GreetingBar
        name={profile?.nome || user?.email?.split("@")[0] || "CEO"}
        avatarUrl={profile?.avatar_gamificado_url || profile?.avatar_url}
        subtitle={`"${frase}"`}
        filter={period === "hoje" ? "hoje" : period === "ontem" ? "ontem" : period === "semana" ? "semana" : period === "mes" || period === "ultimos_30d" ? "mes" : "personalizado"}
        dateRange={{ from: range.start, to: range.end }}
        onFilterChange={(f, r) => {
          const periodMap: Record<string, string> = { hoje: "hoje", ontem: "ontem", semana: "semana", mes: "mes" };
          window.dispatchEvent(new CustomEvent("date-filter-change", { detail: { period: periodMap[f] || "personalizado", range: r } }));
        }}
        onRefresh={reload}
        refreshTime={format(lastUpdate, "HH:mm")}
      />

      {/* ═══ DATE FILTER + ACTION BUTTONS ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1"><GlobalDateFilterBar variant="header" /></div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDispatchOpen(true)}
            disabled={filaCeoCount === 0}
            className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
          >
            <Inbox className="h-3.5 w-3.5" />
            Fila CEO
            {filaCeoCount > 0 && <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 ml-1">{filaCeoCount}</Badge>}
          </Button>
        </div>
      </div>

</>;
}
