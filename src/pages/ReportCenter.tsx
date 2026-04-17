import { useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import ReportTabs from "@/components/relatorios/ReportTabs";
import ReportFilters from "@/components/relatorios/ReportFilters";
import ReportPlaceholder from "@/components/relatorios/ReportPlaceholder";
import RelatorioVendas from "@/components/relatorios/RelatorioVendas";
import RelatorioLeads from "@/components/relatorios/RelatorioLeads";
import RelatorioConversao from "@/components/relatorios/RelatorioConversao";
import RelatorioEmpreendimentos from "@/components/relatorios/RelatorioEmpreendimentos";
import RelatorioOrigem from "@/components/relatorios/RelatorioOrigem";
import RelatorioInteracao from "@/components/relatorios/RelatorioInteracao";
import RelatorioVisitas from "@/components/relatorios/RelatorioVisitas";
import RelatorioTarefas from "@/components/relatorios/RelatorioTarefas";
import RelatorioNegocios from "@/components/relatorios/RelatorioNegocios";
import MegaRelatorio from "@/components/relatorios/MegaRelatorio";

const TAB_LABELS: Record<string, string> = {
  vendas: "Vendas",
  leads: "Leads",
  negocios: "Negócios",
  "oferta-ativa": "Oferta Ativa",
  conversao: "Conversão",
  empreendimentos: "Empreendimentos",
  origem: "Origem",
  interacao: "Interação",
  visitas: "Visitas",
  tarefas: "Tarefas",
  mega: "✦ Mega",
};

export default function ReportCenter() {
  const { isAdmin, isGestor, isCorretor, loading } = useUserRole();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const activeTab = params.get("tab") || "vendas";
  const filters = {
    periodo: params.get("periodo") || "mes",
    dataInicio: params.get("de") || undefined,
    dataFim: params.get("ate") || undefined,
    equipe: params.get("equipe") || "",
    corretor: params.get("corretor") || "",
    segmento: params.get("segmento") || "",
  };

  const userRole = isAdmin ? "admin" : isGestor ? "gestor" : "corretor";

  const update = useCallback(
    (patch: Record<string, string>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => {
          if (v) next.set(k, v);
          else next.delete(k);
        });
        return next;
      });
    },
    [setParams]
  );

  const exportToPDF = useCallback(async () => {
    const isMega = activeTab === "mega";
    const targetId = isMega ? "mega-report-content" : "report-tab-content";

    if (isMega) {
      document.dispatchEvent(new CustomEvent("mega-expand-all"));
      await new Promise((r) => setTimeout(r, 300));
    }

    const element = document.getElementById(targetId);
    if (!element) {
      toast({ title: "Não foi possível capturar o relatório", variant: "destructive" });
      return;
    }

    toast({ title: "Gerando PDF..." });

    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#f0f0f5",
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const tabLabel = TAB_LABELS[activeTab] ?? activeTab;
      const periodo =
        filters.periodo === "mes"
          ? "Este mês"
          : filters.periodo === "semana"
          ? "Esta semana"
          : filters.periodo === "hoje"
          ? "Hoje"
          : `${filters.dataInicio ?? ""} a ${filters.dataFim ?? ""}`;

      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`UhomeSales · Relatório: ${tabLabel} · ${periodo}`, 10, 8);
      pdf.setDrawColor(220);
      pdf.line(10, 10, 287, 10);

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      const usableH = pageH - 20;

      let yOffset = 0;
      let firstPage = true;
      // Render image, paginating by clipping with negative y on a per-page canvas
      while (yOffset < imgH) {
        if (!firstPage) pdf.addPage();
        const sliceHeightMm = Math.min(usableH - (firstPage ? 15 : 5), imgH - yOffset);
        const sliceHeightPx = (sliceHeightMm / imgH) * canvas.height;
        const startPx = (yOffset / imgH) * canvas.height;

        // Build a per-slice canvas
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHeightPx);
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#f0f0f5";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            startPx,
            canvas.width,
            sliceHeightPx,
            0,
            0,
            canvas.width,
            sliceHeightPx
          );
        }
        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(
          sliceData,
          "JPEG",
          10,
          firstPage ? 15 : 5,
          imgW,
          sliceHeightMm,
          "",
          "FAST"
        );

        yOffset += sliceHeightMm;
        firstPage = false;
      }

      const slug = activeTab.replace(/[^a-z0-9]/g, "-");
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`uhomesales-${slug}-${dateStr}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  }, [activeTab, filters, toast]);

  if (loading) return null;
  if (isCorretor && !isGestor && !isAdmin) return <Navigate to="/pipeline-leads" replace />;

  function renderTab() {
    switch (activeTab) {
      case "vendas":
        return <RelatorioVendas filters={filters} userRole={userRole} />;
      case "leads":
        return <RelatorioLeads filters={filters} userRole={userRole} />;
      case "conversao":
        return <RelatorioConversao filters={filters} userRole={userRole} />;
      case "empreendimentos":
        return <RelatorioEmpreendimentos filters={filters} userRole={userRole} />;
      case "origem":
        return <RelatorioOrigem filters={filters} userRole={userRole} />;
      case "interacao":
        return <RelatorioInteracao filters={filters} userRole={userRole} />;
      case "visitas":
        return <RelatorioVisitas filters={filters} userRole={userRole} />;
      case "tarefas":
        return <RelatorioTarefas filters={filters} userRole={userRole} />;
      case "negocios":
        return <RelatorioNegocios filters={filters} userRole={userRole} />;
      case "mega":
        return <MegaRelatorio filters={filters} userRole={userRole} />;
      default:
        return <ReportPlaceholder tabName={TAB_LABELS[activeTab] || activeTab} />;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f0f0f5" }}>
      <ReportTabs
        activeTab={activeTab}
        onTabChange={(tab) => update({ tab })}
      />
      <ReportFilters
        filters={filters}
        onFiltersChange={(f) =>
          update({
            periodo: f.periodo,
            de: f.dataInicio || "",
            ate: f.dataFim || "",
            equipe: f.equipe,
            corretor: f.corretor,
            segmento: f.segmento,
          })
        }
        userRole={userRole}
        onExport={exportToPDF}
      />
      <div id="report-tab-content" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {renderTab()}
      </div>
    </div>
  );
}
