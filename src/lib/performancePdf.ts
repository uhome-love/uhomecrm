/** Relatório semanal da Performance da Roleta em PDF (gerado no navegador). */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { CorretorPerf } from "@/hooks/usePerformanceRoleta";

export interface LinhaFechamento { nome: string; visitas_validas: number; crm_pct: number | null; situacao: string; um_a_um_pendente: boolean }

const SIT: Record<string, string> = { apto: "Apto", evolucao: "Em evolução", retomada: "Plano de retomada" };

export function gerarPdfPerformance(opts: { equipe: string; semanaLabel: string | null; corretores: CorretorPerf[]; fechamento: LinhaFechamento[] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(16); doc.text("Performance da Roleta — Uhome", 40, 48);
  doc.setFontSize(10); doc.setTextColor(100);
  doc.text(`Equipe: ${opts.equipe} · gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 40, 66);
  doc.setTextColor(0);

  const aptos = opts.corretores.filter((c) => !c.motivo?.bloqueado).length;
  doc.setFontSize(12); doc.text(`Agora: ${aptos} aptos de ${opts.corretores.length} corretores`, 40, 92);

  autoTable(doc, {
    startY: 104, styles: { fontSize: 9 }, headStyles: { fillColor: [73, 105, 255] },
    head: [["Corretor", "Equipe", "CRM", "Verde/Amarelo/Vermelho", "Visitas sem. passada", "Esta semana", "Situação agora"]],
    body: opts.corretores.map((c) => [c.nome, c.equipe, c.crm?.pct != null ? `${c.crm.pct}%` : "—",
      `${c.crm?.em_dia ?? 0} / ${c.crm?.ambar ?? 0} / ${c.crm?.vermelho ?? 0}`,
      String(c.visitas_semana_passada), String(c.visitas_semana_atual), c.motivo?.bloqueado ? c.motivo.titulo : "Apto"]),
  });

  if (opts.semanaLabel && opts.fechamento.length) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 28;
    doc.setFontSize(12); doc.text(`Fechamento semanal · ${opts.semanaLabel}`, 40, y);
    autoTable(doc, {
      startY: y + 10, styles: { fontSize: 9 }, headStyles: { fillColor: [73, 105, 255] },
      head: [["Corretor", "Visitas válidas", "CRM", "Situação", "1:1"]],
      body: opts.fechamento.map((l) => [l.nome, String(l.visitas_validas), l.crm_pct != null ? `${l.crm_pct}%` : "—", SIT[l.situacao] ?? l.situacao, l.um_a_um_pendente ? "Pendente" : ""]),
    });
  }
  const nome = `performance-roleta-${(opts.semanaLabel ?? "agora").replace(/\W+/g, "-")}.pdf`;
  doc.save(nome);
}
