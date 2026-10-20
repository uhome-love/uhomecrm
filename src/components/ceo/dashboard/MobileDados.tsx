import { CheckCircle2 } from "lucide-react";
import type { CeoDashboardController } from "@/hooks/useCeoDashboardController";
import { fmtMoney } from "@/lib/fmtMoney";
import { Button } from "@/components/ui/button";
import { StateWrapper } from "@/components/ui/StateWrapper";
import { cn } from "@/lib/utils";
import { MobileSection, MobileDisclosure, MobileDataRow } from "./MobilePrimitives";

export default function MobileDados({ model: m }: { model: CeoDashboardController }) {
  return <MobileSection title="Dados gerais">
    <MobileDisclosure title="Marketing">
      <MobileDataRow label="Total Leads Gerados" value={m.totalLeadsPeriodo} /><MobileDataRow label="Origens Ativas" value={m.origens.length} /><MobileDataRow label="Top Origem" value={m.origens[0]?.origem || "—"} />
      {m.isAdmin && <Button variant="outline" className="mt-3 h-11 w-full text-primary" onClick={() => m.navigate("/marketing")}>Ver Marketing</Button>}
    </MobileDisclosure>
    <MobileDisclosure title="RH & Equipe">
      <MobileDataRow label="Presentes Hoje" value={m.presentesHoje} /><MobileDataRow label="Equipes Ativas" value={m.teams.length} /><MobileDataRow label="Total Corretores" value={m.corretoresRank.length} />
      {m.isAdmin && <Button variant="outline" className="mt-3 h-11 w-full text-primary" onClick={() => m.navigate("/rh")}>Ver RH</Button>}
    </MobileDisclosure>
    <MobileDisclosure title="Alertas & Atenção" defaultOpen>
      <StateWrapper error={m.errors.pipeline} onRetry={m.reload} errorTitle="Não foi possível carregar os alertas" errorDescription="Não é possível afirmar que a operação está saudável.">
        {m.alertas.length > 0 ? m.alertas.map((alerta, index) => <p key={index} className={cn("border-t border-border py-3 text-[13px] leading-relaxed", alerta.tipo === "red" ? "text-danger" : alerta.tipo === "yellow" ? "text-warning" : "text-success")}>{alerta.mensagem}</p>) : <p className="flex items-center gap-2 py-3 text-sm text-success"><CheckCircle2 className="h-4 w-4" />Operação saudável</p>}
        {m.vgvEmRisco > 0 && <p className="border-t border-border py-3 text-[13px] leading-relaxed text-warning">VGV em risco (parados &gt;15d): {fmtMoney(m.vgvEmRisco, "short")}</p>}
      </StateWrapper>
      <Button variant="outline" className="mt-3 h-11 w-full text-primary" onClick={() => m.navigate("/central-relatorios?visao=executivo")}>Ver Relatório Geral</Button>
    </MobileDisclosure>
  </MobileSection>;
}