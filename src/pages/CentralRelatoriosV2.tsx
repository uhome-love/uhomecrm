import { Navigate, useSearchParams } from "react-router-dom";
import { ReportBuilder } from "@/components/central-v2/report/ReportBuilder";

/**
 * Central de Relatórios — construtor de relatório por equipe/corretor.
 * Substitui a antiga Central v2 (seções) por uma visão prática: métricas por
 * corretor agrupadas por equipe, consolidado da diretoria, negócios em
 * andamento, com período livre, filtros e export em PDF/Excel. Somente leitura.
 */
export default function CentralRelatoriosV2() {
  const [params] = useSearchParams();

  // Redireciona o relatório 1:1 legado para sua rota dedicada.
  if (params.get("visao") === "um-a-um") {
    return <Navigate to="/relatorios-1-1" replace />;
  }

  return <ReportBuilder />;
}
