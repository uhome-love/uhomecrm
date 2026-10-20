import PainelComAbas from "@/components/performance/PainelComAbas";
import { useCeoDashboardController } from "@/hooks/useCeoDashboardController";
import DesktopDashboardContent from "@/components/ceo/dashboard/DesktopDashboardContent";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkEmpreendimentoAssign from "@/components/ceo/BulkEmpreendimentoAssign";
import KpiDetailDialog from "@/components/ceo/KpiDetailDialog";

// Celular e computador usam a mesma tela (visual mobile novo revertido a pedido em 20/10/2026;
// componentes Mobile* seguem em src/components/ceo/dashboard para reativar se necessário).
export default function CeoDashboard() {
  const model = useCeoDashboardController();
  return <>
    <PainelComAbas>
      <DesktopDashboardContent model={model} />
    </PainelComAbas>
    <FilaCeoDispatchModal open={model.dispatchOpen} onOpenChange={model.setDispatchOpen} onDispatched={() => { model.reload(); model.loadFilaCeo(); }} />
    <BulkEmpreendimentoAssign open={model.bulkEmpOpen} onOpenChange={model.setBulkEmpOpen} onComplete={model.reload} />
    <KpiDetailDialog open={!!model.kpiDetail} onOpenChange={(open) => { if (!open) model.setKpiDetail(null); }} type={model.kpiDetail?.type || "total_leads"} label={model.kpiDetail?.label || ""} dateRange={{ start: model.range.start, end: model.range.end }} />
  </>;
}
