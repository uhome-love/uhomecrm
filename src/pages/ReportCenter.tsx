import { useCallback, lazy, Suspense } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { BarChart2, FileText, Users, Loader2, Download } from "lucide-react";

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
import RelatorioOfertaAtiva from "@/components/relatorios/RelatorioOfertaAtiva";
import MegaRelatorio from "@/components/relatorios/MegaRelatorio";
import RelatorioOrigemPerformance from "@/components/relatorios/RelatorioOrigemPerformance";

const RelatorioSemanal = lazy(() => import("@/pages/RelatorioSemanal"));
const RelatorioCorretor = lazy(() => import("@/pages/RelatorioCorretor"));

type Visao = "executivo" | "tematicos" | "um-a-um";

const TAB_LABELS: Record<string, string> = {
  vendas: "Vendas", leads: "Leads", negocios: "Negócios",
  "oferta-ativa": "Oferta Ativa", conversao: "Conversão",
  empreendimentos: "Empreendimentos", origem: "Origem",
  interacao: "Interação", visitas: "Visitas", tarefas: "Tarefas",
  mega: "✦ Mega",
};

export default function ReportCenter() {
  const { isAdmin, isGestor, isCorretor, loading } = useUserRole();
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();

  const visao = (params.get("visao") as Visao) || "executivo";
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
          if (v) next.set(k, v); else next.delete(k);
        });
        return next;
      });
    },
    [setParams]
  );

  const exportToPDF = useCallback(async () => {
    const isMega = activeTab === "mega";
    const targetId = visao !== "tematicos" ? "report-tab-content" : (isMega ? "mega-report-content" : "report-tab-content");
    if (isMega) {
      document.dispatchEvent(new CustomEvent("mega-expand-all"));
      await new Promise((r) => setTimeout(r, 600));
    }
    const element = document.getElementById(targetId);
    if (!element) {
      toast({ title: "Não foi possível capturar o relatório", variant: "destructive" });
      return;
    }
    toast({ title: "Carregando dados do relatório..." });
    const waitStart = Date.now();
    const MAX_WAIT = 20000;
    await new Promise((r) => setTimeout(r, 400));
    while (Date.now() - waitStart < MAX_WAIT) {
      const stillLoading = element.querySelector(".animate-pulse");
      if (!stillLoading) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    await new Promise((r) => setTimeout(r, 600));
    toast({ title: "Gerando PDF..." });
    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = html2canvasMod.default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: "#f0f0f5", logging: false });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const visaoLabel = visao === "executivo" ? "Executivo" : visao === "um-a-um" ? "1:1" : (TAB_LABELS[activeTab] ?? activeTab);
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`UhomeSales · Central de Relatórios · ${visaoLabel}`, 10, 8);
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
      while (yOffset < imgH) {
        if (!firstPage) pdf.addPage();
        const sliceHeightMm = Math.min(usableH - (firstPage ? 15 : 5), imgH - yOffset);
        const sliceHeightPx = (sliceHeightMm / imgH) * canvas.height;
        const startPx = (yOffset / imgH) * canvas.height;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.ceil(sliceHeightPx);
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#f0f0f5";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, startPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
        }
        const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(sliceData, "JPEG", 10, firstPage ? 15 : 5, imgW, sliceHeightMm, "", "FAST");
        yOffset += sliceHeightMm;
        firstPage = false;
      }
      const dateStr = new Date().toISOString().slice(0, 10);
      pdf.save(`uhomesales-${visao}-${dateStr}.pdf`);
      toast({ title: "PDF gerado com sucesso!" });
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    }
  }, [visao, activeTab, toast]);

  if (loading) return null;
  // Corretor: só visão Executivo (próprios dados via permissões internas)
  const corretorOnly = isCorretor && !isGestor && !isAdmin;
  if (corretorOnly && visao !== "executivo") {
    return <Navigate to="/central-relatorios?visao=executivo" replace />;
  }

  function renderTab() {
    switch (activeTab) {
      case "vendas": return <RelatorioVendas filters={filters} userRole={userRole} />;
      case "leads": return <RelatorioLeads filters={filters} userRole={userRole} />;
      case "conversao": return <RelatorioConversao filters={filters} userRole={userRole} />;
      case "empreendimentos": return <RelatorioEmpreendimentos filters={filters} userRole={userRole} />;
      case "origem": return <RelatorioOrigem filters={filters} userRole={userRole} />;
      case "interacao": return <RelatorioInteracao filters={filters} userRole={userRole} />;
      case "visitas": return <RelatorioVisitas filters={filters} userRole={userRole} />;
      case "tarefas": return <RelatorioTarefas filters={filters} userRole={userRole} />;
      case "negocios": return <RelatorioNegocios filters={filters} userRole={userRole} />;
      case "oferta-ativa": return <RelatorioOfertaAtiva filters={filters} userRole={userRole} />;
      case "mega": return <MegaRelatorio filters={filters} userRole={userRole} />;
      default: return <ReportPlaceholder tabName={TAB_LABELS[activeTab] || activeTab} />;
    }
  }

  const visoes: { key: Visao; label: string; icon: any; roles: string[] }[] = [
    { key: "executivo", label: "Executivo", icon: BarChart2, roles: ["admin", "gestor", "corretor"] },
    { key: "tematicos", label: "Temáticos", icon: FileText, roles: ["admin", "gestor"] },
    { key: "um-a-um", label: "1:1 Corretor", icon: Users, roles: ["admin", "gestor"] },
  ];
  const visiblesVisoes = visoes.filter(v => v.roles.includes(userRole));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", backgroundColor: "#f0f0f5" }}>
      {/* Header da Central */}
      <div style={{ backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px" }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-base font-semibold text-foreground">Central de Relatórios</h1>
          <p className="text-xs text-muted-foreground">Performance executiva, relatórios temáticos e 1:1 com IA</p>
        </div>
        <div className="flex items-center gap-2">
          {visiblesVisoes.map(v => {
            const isActive = visao === v.key;
            return (
              <button
                key={v.key}
                onClick={() => update({ visao: v.key })}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                  isActive
                    ? "bg-primary text-white border-transparent shadow-sm"
                    : "bg-white text-muted-foreground border-border hover:bg-accent"
                }`}
              >
                <v.icon className="h-3.5 w-3.5" /> {v.label}
              </button>
            );
          })}
          {visao === "tematicos" && (
            <Button size="sm" onClick={exportToPDF} className="ml-2 h-8 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo da visão */}
      {visao === "tematicos" && (
        <>
          <ReportTabs activeTab={activeTab} onTabChange={(tab) => update({ tab })} />
          <ReportFilters
            filters={filters}
            onFiltersChange={(f) => update({
              periodo: f.periodo, de: f.dataInicio || "", ate: f.dataFim || "",
              equipe: f.equipe, corretor: f.corretor, segmento: f.segmento,
            })}
            userRole={userRole}
            onExport={exportToPDF}
          />
          <div id="report-tab-content" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {renderTab()}
          </div>
        </>
      )}

      {visao === "executivo" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <RelatorioSemanal />
          </Suspense>
        </div>
      )}

      {visao === "um-a-um" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <RelatorioCorretor />
          </Suspense>
        </div>
      )}
    </div>
  );
}
