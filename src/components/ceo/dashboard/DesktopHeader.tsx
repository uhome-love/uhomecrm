import { format } from "date-fns";
import { useEffect } from "react";
import { useDateFilter } from "@/contexts/DateFilterContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { GreetingBar } from "@/components/ui/GreetingBar";
import { MissaoNatalEmpresa } from "@/natal/MissaoNatalEmpresa";
import GlobalDateFilterBar from "@/components/GlobalDateFilterBar";
import MobilePeriodSelector from "./MobilePeriodSelector";

export default function DesktopHeader({model}: {model:CeoDashboardController}) {
const { setPeriod } = useDateFilter();
// Painel CEO sempre abre em "Hoje"
useEffect(() => { setPeriod("hoje"); }, [setPeriod]);
const { user, period, range, frase, setDispatchOpen, filaCeoCount, lastUpdate, profile, reload, hoje } = model;
return <>      {/* ═══ GREETING ═══ */}
      <GreetingBar
        name={profile?.nome || user?.email?.split("@")[0] || "CEO"}
        avatarUrl={profile?.avatar_gamificado_url || profile?.avatar_url}
        subtitle={`"${frase}"`}
        showFilter={false}
        onRefresh={reload}
        refreshTime={format(lastUpdate, "HH:mm")}
      />

      <MissaoNatalEmpresa recolhivel />

      {/* ═══ DATE FILTER + ACTION BUTTONS ═══ */}
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0 md:hidden"><MobilePeriodSelector /></div>
        <div className="hidden md:block flex-1 min-w-0 max-w-full"><GlobalDateFilterBar variant="header" /></div>
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
