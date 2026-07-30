import { useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import RelatorioOrigemPerformance from "@/components/relatorios/RelatorioOrigemPerformance";
import type { ReportFilters } from "@/components/relatorios/reportUtils";
import { formatBRT } from "@/lib/brtTime";
import MarketingDashboard from "@/components/marketing/MarketingDashboard";

const PILLS: Array<{ id: string; label: string }> = [
  { id: "hoje", label: "Hoje" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "custom", label: "Personalizado" },
];

/**
 * Central de Marketing — dashboard de rastreamento de mídia paga.
 * Cruza campanha/conjunto/criativo/formulário/plataforma com qualidade,
 * visita, venda e tempo até 1º contato. Somente leitura.
 * Export PDF em A4 paisagem via html2canvas + jsPDF.
 */
const ABAS = [
  { id: "rastreamento", label: "Rastreamento & Funil" },
  { id: "investimento", label: "Investimento (Meta Ads)" },
] as const;
type AbaId = (typeof ABAS)[number]["id"];

export default function DadosAnunciosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const abaParam = searchParams.get("aba");
  const aba: AbaId = abaParam === "investimento" ? "investimento" : "rastreamento";
  const setAba = (id: AbaId) => {
    const next = new URLSearchParams(searchParams);
    if (id === "rastreamento") next.delete("aba");
    else next.set("aba", id);
    setSearchParams(next, { replace: true });
  };
  const [periodo, setPeriodo] = useState<string>("mes");
  const [de, setDe] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filters: ReportFilters = {
    periodo,
    dataInicio: de || undefined,
    dataFim: ate || undefined,
    equipe: "",
    corretor: "",
    segmento: "",
  };

  const exportPdf = async () => {
    const target = contentRef.current;
    if (!target) return;
    setExportingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const A4_W = 297;
      const A4_H = 210;
      const MARGIN = 10;
      const contentW = A4_W - MARGIN * 2;
      const contentH = A4_H - MARGIN * 2 - 8; // leave room for header/footer

      // Cover
      pdf.setFontSize(20);
      pdf.setTextColor(20);
      pdf.text("Central de Marketing", MARGIN, 25);
      pdf.setFontSize(11);
      pdf.setTextColor(90);
      const periodoLabel = periodo === "custom" && de && ate
        ? `${de} → ${ate}`
        : PILLS.find((p) => p.id === periodo)?.label ?? periodo;
      pdf.text(`Período: ${periodoLabel}`, MARGIN, 34);
      pdf.text(`Gerado em: ${formatBRT(new Date(), "dd/MM/yyyy HH:mm")} (BRT)`, MARGIN, 41);
      pdf.setDrawColor(220);
      pdf.line(MARGIN, 46, A4_W - MARGIN, 46);
      pdf.setFontSize(9);
      pdf.setTextColor(140);
      pdf.text("Uhome Sales · Rastreamento de mídia paga", MARGIN, A4_H - 6);

      // Slice canvas into landscape pages
      const pxPerMm = canvas.width / contentW;
      const sliceHpx = Math.floor(contentH * pxPerMm);
      let offset = 0;
      while (offset < canvas.height) {
        const sliceH = Math.min(sliceHpx, canvas.height - offset);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        pdf.addPage();
        const imgH = sliceH / pxPerMm;
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, contentW, imgH);
        offset += sliceH;
      }

      const total = pdf.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(140);
        pdf.text(`Página ${i} de ${total}`, A4_W - MARGIN, A4_H - 6, { align: "right" });
      }

      pdf.save(`dados-anuncios-${formatBRT(new Date(), "yyyy-MM-dd-HHmm")}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: "#f0f0f5" }}>
      <div style={{ background: "#fff", borderBottom: "0.5px solid #e5e7eb", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto" }}>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>Central de Marketing</h1>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Leads, anúncios e investimento: campanha, conjunto, criativo, formulário e conversões</p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#f3f4f6", padding: 3, borderRadius: 10 }}>
          {ABAS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              style={{
                padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: "none",
                background: aba === a.id ? "#fff" : "transparent",
                color: aba === a.id ? "#111827" : "#6b7280",
                fontWeight: aba === a.id ? 600 : 400,
                boxShadow: aba === a.id ? "0 1px 2px rgba(0,0,0,.08)" : "none",
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div style={{ display: aba === "rastreamento" ? "flex" : "none", gap: 6 }}>
          {PILLS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              style={{
                padding: "6px 12px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                border: periodo === p.id ? "none" : "0.5px solid #e5e7eb",
                background: periodo === p.id ? "#4F46E5" : "#fff",
                color: periodo === p.id ? "#fff" : "#6b7280",
                fontWeight: periodo === p.id ? 600 : 400,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {aba === "rastreamento" && periodo === "custom" && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
            <span style={{ color: "#9ca3af", fontSize: 12 }}>até</span>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={{ border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
          </div>
        )}
        {aba === "rastreamento" && (
        <button
          onClick={exportPdf}
          disabled={exportingPdf}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "#111827", color: "#fff", border: "none",
            borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: exportingPdf ? "wait" : "pointer",
            opacity: exportingPdf ? 0.6 : 1,
          }}
        >
          {exportingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
          PDF A4 paisagem
        </button>
        )}
      </div>
      <div style={{ padding: 16 }} ref={contentRef}>
        {aba === "rastreamento"
          ? <RelatorioOrigemPerformance filters={filters} userRole="admin" />
          : <MarketingDashboard />}
      </div>
    </div>
  );
}
