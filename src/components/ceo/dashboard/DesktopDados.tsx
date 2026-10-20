import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, XCircle, Phone, CalendarCheck, DollarSign, Users, BarChart3, Building2, Target, Megaphone, UserCheck, Activity, Eye } from "lucide-react";
import { StateWrapper } from "@/components/ui/StateWrapper";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import type { KpiDetailType } from "@/components/ceo/KpiDetailDialog";
import { MiniKpi, SectionLabel, HBar, formatBRLCompact, ORIGIN_COLORS, FALLBACK_COLORS } from "./DesktopPrimitives";

export default function DesktopDados({ model }: { model: CeoDashboardController }) {
  const { navigate, isAdmin, alertas, vgvEmRisco, teams, corretoresRank, origens, totalLeadsPeriodo, presentesHoje, reload, errors } = model;
  return (<>
<section>
        <SectionLabel icon={Activity}>Dados Gerais</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Marketing */}
          <Card className="bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Megaphone className="h-3.5 w-3.5 text-primary" /> Marketing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Total Leads Gerados</span>
                <span className="text-sm font-bold text-primary">{totalLeadsPeriodo}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Origens Ativas</span>
                <span className="text-sm font-bold">{origens.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Top Origem</span>
                <span className="text-sm font-bold">{origens[0]?.origem || "—"}</span>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="w-full text-xs text-primary border-primary/20" onClick={() => navigate("/marketing")}>
                  Ver Marketing
                </Button>
              )}
            </CardContent>
          </Card>

          {/* RH */}
          <Card className="bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <UserCheck className="h-3.5 w-3.5 text-primary" /> RH & Equipe
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Presentes Hoje</span>
                <span className="text-sm font-bold text-success">{presentesHoje}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Equipes Ativas</span>
                <span className="text-sm font-bold">{teams.length}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-muted/50 border border-[#e8e8f0] dark:border-border">
                <span className="text-[11px] text-muted-foreground">Total Corretores</span>
                <span className="text-sm font-bold">{corretoresRank.length}</span>
              </div>
              {isAdmin && (
                <Button variant="outline" size="sm" className="w-full text-xs text-primary border-primary/20" onClick={() => navigate("/rh")}>
                  Ver RH
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Alertas & Info */}
          <Card className="bg-[#f7f7fb] dark:bg-card border-border shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 text-primary" /> Alertas & Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Erro tem precedência: "Operação saudável" nunca pode mascarar falha de consulta */}
              <StateWrapper
                error={errors.pipeline}
                onRetry={reload}
                errorTitle="Não foi possível carregar os alertas"
                errorDescription="Não é possível afirmar que a operação está saudável."
                className="space-y-2"
              >
              {alertas.length > 0 ? alertas.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg text-[11px] ${
                  a.tipo === "red" ? "bg-danger/5 text-danger" :
                  a.tipo === "yellow" ? "bg-warning/5 text-warning" :
                  "bg-success/5 text-success"
                }`}>
                  <div className={`h-2 w-2 rounded-full mt-1 shrink-0 ${
                    a.tipo === "red" ? "bg-danger" : a.tipo === "yellow" ? "bg-warning" : "bg-success"
                  }`} />
                  <span>{a.mensagem}</span>
                </div>
              )) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/5 text-success text-[11px]">
                  <CheckCircle2 className="h-4 w-4" /> Operação saudável
                </div>
              )}
              {vgvEmRisco > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 text-warning text-[11px]">
                  <div className="h-2 w-2 rounded-full mt-1 shrink-0 bg-warning" />
                  <span>VGV em risco (parados &gt;15d): {formatBRLCompact(vgvEmRisco)}</span>
                </div>
              )}
  </>);
}
