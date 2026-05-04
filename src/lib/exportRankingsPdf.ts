import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfRanking {
  title: string;
  caption?: string;
  headers: string[];
  rows: (string | number)[][];
}

// Paleta espelhando o CRM (Off-white / Deep Slate / Indigo)
const COLOR_PRIMARY: [number, number, number] = [73, 105, 255];   // #4969FF
const COLOR_PRIMARY_DARK: [number, number, number] = [55, 81, 219];
const COLOR_BG: [number, number, number] = [240, 240, 245];        // #f0f0f5
const COLOR_CARD: [number, number, number] = [255, 255, 255];
const COLOR_TEXT: [number, number, number] = [17, 24, 39];         // #111827
const COLOR_MUTED: [number, number, number] = [107, 114, 128];     // #6b7280
const COLOR_BORDER: [number, number, number] = [229, 231, 235];    // #e5e7eb
const COLOR_HEAD_BG: [number, number, number] = [248, 249, 252];
const COLOR_ALT_ROW: [number, number, number] = [251, 251, 253];
const COLOR_GOLD: [number, number, number] = [234, 179, 8];
const COLOR_SILVER: [number, number, number] = [148, 163, 184];
const COLOR_BRONZE: [number, number, number] = [180, 120, 70];

// Substitui caracteres não suportados por helvetica (WinAnsi) por equivalentes ASCII
function safeStr(s: string | number): string {
  return String(s ?? "")
    .replace(/Σ/g, "Total")
    .replace(/[•∙]/g, "·")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Remove emojis e símbolos fora do BMP latino
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

function drawHeader(
  doc: jsPDF,
  pageW: number,
  periodLabel: string,
  equipeLabel?: string
) {
  // Fundo geral da página
  doc.setFillColor(...COLOR_BG);
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), "F");

  // Faixa superior indigo
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageW, 64, "F");
  // Sub-faixa mais escura (linha decorativa)
  doc.setFillColor(...COLOR_PRIMARY_DARK);
  doc.rect(0, 60, pageW, 4, "F");

  // Logotipo textual
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("UhomeSales", 32, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Central de Rankings", 32, 42);

  // Período + equipe alinhados à direita
  const right = pageW - 32;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(safeStr(periodLabel), right, 26, { align: "right" });
  if (equipeLabel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(safeStr(equipeLabel), right, 42, { align: "right" });
  }
}

function drawSectionCard(
  doc: jsPDF,
  pageW: number,
  rk: PdfRanking,
  startY: number
) {
  const x = 24;
  const w = pageW - 48;

  // Cartão (sombra leve simulada)
  doc.setFillColor(220, 222, 230);
  doc.roundedRect(x + 1.5, startY + 1.5, w, 56, 10, 10, "F");
  doc.setFillColor(...COLOR_CARD);
  doc.roundedRect(x, startY, w, 56, 10, 10, "F");

  // Acento lateral indigo
  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(x, startY, 4, 56, 2, 2, "F");

  // Título
  doc.setTextColor(...COLOR_TEXT);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(safeStr(rk.title), x + 18, startY + 22);

  // Caption
  if (rk.caption) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(safeStr(rk.caption), x + 18, startY + 40);
  }

  // Resumo (total de linhas)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(`${rk.rows.length} corretores`, x + w - 14, startY + 22, { align: "right" });
}

function drawFooter(doc: jsPDF, pageW: number, idx: number, total: number) {
  const ph = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.5);
  doc.line(24, ph - 28, pageW - 24, ph - 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    24,
    ph - 14
  );
  doc.text("uhomesales.com", pageW / 2, ph - 14, { align: "center" });
  doc.text(`Página ${idx + 1} de ${total}`, pageW - 24, ph - 14, { align: "right" });
}

export function exportRankingsPdf(opts: {
  fileName: string;
  periodLabel: string;
  equipeLabel?: string;
  rankings: PdfRanking[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  opts.rankings.forEach((rk, idx) => {
    if (idx > 0) doc.addPage();

    drawHeader(doc, pageW, opts.periodLabel, opts.equipeLabel);
    drawSectionCard(doc, pageW, rk, 84);

    autoTable(doc, {
      startY: 156,
      head: [["#", ...rk.headers.map(safeStr)]],
      body: rk.rows.map((r, i) => [String(i + 1), ...r.map(v => safeStr(v))]),
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 9.5,
        cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
        textColor: COLOR_TEXT,
        lineColor: COLOR_BORDER,
        lineWidth: 0.4,
      },
      headStyles: {
        fillColor: COLOR_HEAD_BG,
        textColor: COLOR_MUTED,
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "left",
        lineWidth: 0,
        cellPadding: { top: 9, right: 10, bottom: 9, left: 10 },
      },
      alternateRowStyles: { fillColor: COLOR_ALT_ROW },
      bodyStyles: { fillColor: COLOR_CARD },
      columnStyles: {
        0: { halign: "center", cellWidth: 32, fontStyle: "bold", textColor: COLOR_MUTED },
      },
      margin: { left: 24, right: 24, bottom: 40 },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        // Destaque medalhas para top 3
        if (data.column.index === 0) {
          if (data.row.index === 0) data.cell.styles.textColor = COLOR_GOLD;
          else if (data.row.index === 1) data.cell.styles.textColor = COLOR_SILVER;
          else if (data.row.index === 2) data.cell.styles.textColor = COLOR_BRONZE;
        }
        // Nome do corretor em negrito
        if (data.column.index === 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = COLOR_TEXT;
        }
      },
      didDrawPage: () => {
        // Re-desenhar fundo/cabeçalho se a tabela quebrar para nova página
        const currentPage = doc.getCurrentPageInfo().pageNumber;
        if (currentPage > idx + 1) {
          drawHeader(doc, pageW, opts.periodLabel, opts.equipeLabel);
        }
      },
    });

    drawFooter(doc, pageW, idx, opts.rankings.length);
  });

  doc.save(opts.fileName);
}
