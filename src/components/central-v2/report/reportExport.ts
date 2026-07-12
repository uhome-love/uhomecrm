/**
 * reportExport — exportação do relatório por equipes em PDF e Excel.
 * PDF: jsPDF + autotable (uma seção por equipe + consolidado + negócios).
 * Excel: SheetJS (xlsx) com abas por equipe + consolidado + negócios.
 * Somente leitura — apenas formata os dados já carregados.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatBRT } from "@/lib/brtTime";
import { fmtMoney } from "@/lib/fmtMoney";
import type {
  RelatorioEquipesData,
  NegocioAndamento,
} from "@/hooks/useRelatorioEquipes";
import {
  agruparPorEquipe,
  orderMetrics,
  somaMetricas,
  METRIC_BY_KEY,
  type MetricKey,
  type EquipeAgrupada,
} from "./metrics";

export interface ExportInput {
  data: RelatorioEquipesData;
  metricas: MetricKey[];
  periodoLabel: string;
  escopoLabel: string;
}

function cellValue(v: number, key: MetricKey): string {
  const def = METRIC_BY_KEY[key];
  if (def.money) return v ? fmtMoney(v, "exact") : "0";
  return String(v ?? 0);
}

function cellValueRaw(v: number, key: MetricKey): number {
  return Number(v ?? 0);
}

function fileStamp(): string {
  return formatBRT(new Date(), "yyyy-MM-dd-HHmm");
}

// ─────────────────────────────────────── PDF ───────────────────────────────
export function exportRelatorioPdf(input: ExportInput): void {
  const { data, periodoLabel, escopoLabel } = input;
  const metricas = orderMetrics(input.metricas);
  const equipes = agruparPorEquipe(data.corretores);
  const geradoEm = formatBRT(new Date(), "dd/MM/yyyy HH:mm");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();

  // Capa
  pdf.setFontSize(22);
  pdf.setTextColor(20);
  pdf.text("Central de Relatórios — por Equipe", 14, 22);
  pdf.setFontSize(12);
  pdf.setTextColor(90);
  pdf.text(`Período: ${periodoLabel}`, 14, 32);
  pdf.text(`Escopo: ${escopoLabel}`, 14, 39);
  pdf.text(`Gerado em: ${geradoEm} (BRT)`, 14, 46);

  const head = [["Corretor", ...metricas.map((k) => METRIC_BY_KEY[k].label)]];
  let startY = 56;

  const drawEquipe = (eq: EquipeAgrupada) => {
    pdf.setFontSize(13);
    pdf.setTextColor(30);
    if (startY > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      startY = 20;
    }
    pdf.text(`Equipe ${eq.gerente_nome}`, 14, startY);
    const body = eq.corretores.map((c) => [
      c.nome,
      ...metricas.map((k) => cellValue(Number(c[k] ?? 0), k)),
    ]);
    const foot = [[
      "TOTAL EQUIPE",
      ...metricas.map((k) => cellValue(eq.totais[k], k)),
    ]];
    autoTable(pdf, {
      head,
      body,
      foot,
      startY: startY + 3,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [73, 105, 255], textColor: 255 },
      footStyles: { fillColor: [235, 238, 250], textColor: 20, fontStyle: "bold" },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error lastAutoTable injected by plugin
    startY = pdf.lastAutoTable.finalY + 10;
  };

  equipes.forEach(drawEquipe);

  // Consolidado
  pdf.addPage();
  startY = 20;
  pdf.setFontSize(16);
  pdf.setTextColor(20);
  pdf.text("Consolidado — Diretoria (todas as equipes)", 14, startY);
  const consHead = [["Indicador", ...equipes.map((e) => e.gerente_nome), "Empresa"]];
  const empresaTot = somaMetricas(data.corretores);
  const consBody = metricas.map((k) => [
    METRIC_BY_KEY[k].label,
    ...equipes.map((e) => cellValue(e.totais[k], k)),
    cellValue(empresaTot[k], k),
  ]);
  autoTable(pdf, {
    head: consHead,
    body: consBody,
    startY: startY + 5,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // Negócios em andamento
  if (data.negocios_andamento.length > 0) {
    pdf.addPage();
    pdf.setFontSize(16);
    pdf.setTextColor(20);
    pdf.text("Negócios em andamento (etapa Em Negociação)", 14, 20);
    autoTable(pdf, {
      head: [["Equipe", "Corretor", "Cliente", "Empreendimento", "Valor estimado", "Dias na etapa"]],
      body: data.negocios_andamento.map((n) => [
        n.equipe,
        n.corretor,
        n.cliente ?? "—",
        n.empreendimento ?? "—",
        n.valor_estimado ? fmtMoney(n.valor_estimado, "exact") : "—",
        String(n.dias_na_etapa),
      ]),
      startY: 26,
      styles: { fontSize: 8, cellPadding: 1.6 },
      headStyles: { fillColor: [73, 105, 255], textColor: 255 },
      theme: "grid",
      margin: { left: 14, right: 14 },
    });
  }

  // Rodapé numerado
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    pdf.text(`Uhome Sales · Página ${i} de ${total}`, pageW - 14, pdf.internal.pageSize.getHeight() - 6, {
      align: "right",
    });
  }

  pdf.save(`relatorio-equipes-${fileStamp()}.pdf`);
}

// ─────────────────────────────────────── Excel ─────────────────────────────
export function exportRelatorioExcel(input: ExportInput): void {
  const { data, periodoLabel, escopoLabel } = input;
  const metricas = orderMetrics(input.metricas);
  const equipes = agruparPorEquipe(data.corretores);
  const empresaTot = somaMetricas(data.corretores);
  const geradoEm = formatBRT(new Date(), "dd/MM/yyyy HH:mm");

  const wb = XLSX.utils.book_new();

  // Aba Consolidado
  const consAoa: (string | number)[][] = [
    ["Consolidado Diretoria — Todas as equipes"],
    [`Período: ${periodoLabel}`],
    [`Escopo: ${escopoLabel} · Gerado em ${geradoEm} (BRT)`],
    [],
    ["Indicador", ...equipes.map((e) => e.gerente_nome), "Empresa"],
    ...metricas.map((k) => [
      METRIC_BY_KEY[k].label,
      ...equipes.map((e) => cellValueRaw(e.totais[k], k)),
      cellValueRaw(empresaTot[k], k),
    ]),
  ];
  const wsCons = XLSX.utils.aoa_to_sheet(consAoa);
  wsCons["!cols"] = [{ wch: 24 }, ...equipes.map(() => ({ wch: 16 })), { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsCons, "Consolidado");

  // Uma aba por equipe
  const usedNames = new Set<string>(["Consolidado"]);
  for (const eq of equipes) {
    const header = ["Corretor", ...metricas.map((k) => METRIC_BY_KEY[k].label)];
    const aoa: (string | number)[][] = [
      [`Equipe ${eq.gerente_nome}`],
      [`Período: ${periodoLabel}`],
      [],
      header,
      ...eq.corretores.map((c) => [c.nome, ...metricas.map((k) => cellValueRaw(Number(c[k] ?? 0), k))]),
      ["TOTAL EQUIPE", ...metricas.map((k) => cellValueRaw(eq.totais[k], k))],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 26 }, ...metricas.map(() => ({ wch: 15 }))];
    let name = (eq.gerente_nome.split(" ")[0] || "Equipe").slice(0, 28);
    let i = 2;
    while (usedNames.has(name)) name = `${name.slice(0, 26)}_${i++}`;
    usedNames.add(name);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  // Aba Negócios em Andamento
  const negAoa: (string | number)[][] = [
    ["Negócios em andamento (etapa Em Negociação)"],
    [],
    ["Equipe", "Corretor", "Cliente", "Empreendimento", "Valor estimado", "Dias na etapa"],
    ...data.negocios_andamento.map((n: NegocioAndamento) => [
      n.equipe,
      n.corretor,
      n.cliente ?? "",
      n.empreendimento ?? "",
      Number(n.valor_estimado ?? 0),
      n.dias_na_etapa,
    ]),
  ];
  const wsNeg = XLSX.utils.aoa_to_sheet(negAoa);
  wsNeg["!cols"] = [{ wch: 18 }, { wch: 22 }, { wch: 26 }, { wch: 26 }, { wch: 16 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsNeg, "Negócios em Andamento");

  XLSX.writeFile(wb, `relatorio-equipes-${fileStamp()}.xlsx`);
}
