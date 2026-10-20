import PainelComAbas from "@/components/performance/PainelComAbas";
import { useCeoDashboardController } from "@/hooks/useCeoDashboardController";
import { useIsMobile } from "@/hooks/use-mobile";
import DesktopDashboardContent from "@/components/ceo/dashboard/DesktopDashboardContent";
import MobileDashboardContent from "@/components/ceo/dashboard/MobileDashboardContent";
import MobileHeader from "@/components/ceo/dashboard/MobileHeader";
import FilaCeoDispatchModal from "@/components/pipeline/FilaCeoDispatchModal";
import BulkEmpreendimentoAssign from "@/components/ceo/BulkEmpreendimentoAssign";
import KpiDetailDialog from "@/components/ceo/KpiDetailDialog";

export default function CeoDashboard() {
  const model = useCeoDashboardController();
  const mobile = useIsMobile();
  return <>
    <PainelComAbas mobileHeader={<MobileHeader model={model} />}>
      {mobile ? <MobileDashboardContent model={model} /> : <DesktopDashboardContent model={model} />}
    </PainelComAbas>
    <FilaCeoDispatchModal open={model.dispatchOpen} onOpenChange={model.setDispatchOpen} onDispatched={() => { model.reload(); model.loadFilaCeo(); }} />
    <BulkEmpreendimentoAssign open={model.bulkEmpOpen} onOpenChange={model.setBulkEmpOpen} onComplete={model.reload} />
    <KpiDetailDialog open={!!model.kpiDetail} onOpenChange={(open) => { if (!open) model.setKpiDetail(null); }} type={model.kpiDetail?.type || "total_leads"} label={model.kpiDetail?.label || ""} dateRange={{ start: model.range.start, end: model.range.end }} />
  </>;
}
