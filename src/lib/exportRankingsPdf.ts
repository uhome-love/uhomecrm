import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfRanking {
  title: string;
  caption?: string;
  headers: string[];
  rows: (string | number)[][];
}

// Paleta espelhando o CRM
const COLOR_PRIMARY: [number, number, number] = [73, 105, 255];
const COLOR_PRIMARY_DARK: [number, number, number] = [55, 81, 219];
const COLOR_BG: [number, number, number] = [240, 240, 245];
const COLOR_CARD: [number, number, number] = [255, 255, 255];
const COLOR_TEXT: [number, number, number] = [17, 24, 39];
const COLOR_MUTED: [number, number, number] = [107, 114, 128];
const COLOR_BORDER: [number, number, number] = [229, 231, 235];
const COLOR_HEAD_BG: [number, number, number] = [248, 249, 252];
const COLOR_ALT_ROW: [number, number, number] = [251, 251, 253];
const COLOR_GOLD: [number, number, number] = [234, 179, 8];
const COLOR_SILVER: [number, number, number] = [148, 163, 184];
const COLOR_BRONZE: [number, number, number] = [180, 120, 70];

let fontPromise: Promise<{ regular: string; bold: string } | null> | null = null;

async function loadMontserrat(): Promise<{ regular: string; bold: string } | null> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    try {
      const fetchAsBase64 = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch ${url}`);
        const buf = await res.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
        }
        return btoa(binary);
      };
      const [regular, bold] = await Promise.all([
        fetchAsBase64("/fonts/Montserrat-Regular.ttf"),
        fetchAsBase64("/fonts/Montserrat-Bold.ttf"),
      ]);
      return { regular, bold };
    } catch (err) {
      console.warn("[exportRankingsPdf] Falha ao carregar Montserrat, usando helvetica.", err);
      return null;
    }
  })();
  return fontPromise;
}

function registerMontserrat(doc: jsPDF, fonts: { regular: string; bold: string } | null): string {
  if (!fonts) return "helvetica";
  try {
    doc.addFileToVFS("Montserrat-Regular.ttf", fonts.regular);
    doc.addFont("Montserrat-Regular.ttf", "Montserrat", "normal");
    doc.addFileToVFS("Montserrat-Bold.ttf", fonts.bold);
    doc.addFont("Montserrat-Bold.ttf", "Montserrat", "bold");
    return "Montserrat";
  } catch (err) {
    console.warn("[exportRankingsPdf] addFont falhou, fallback helvetica.", err);
    return "helvetica";
  }
}

function safeStr(s: string | number): string {
  return String(s ?? "")
    .replace(/Σ/g, "Total")
    .replace(/[•∙]/g, "·")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .trim();
}

function drawChrome(
  doc: jsPDF,
  fontFamily: string,
  pageW: number,
  pageH: number,
  periodLabel: string,
  equipeLabel: string | undefined,
  pageNum: number,
  totalPages: number
) {
  // Fundo
  doc.setFillColor(...COLOR_BG);
  doc.rect(0, 0, pageW, pageH, "F");

  // Faixa superior
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setFillColor(...COLOR_PRIMARY_DARK);
  doc.rect(0, 60, pageW, 4, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(15);
  doc.text("UhomeSales", 32, 26);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(10);
  doc.text("Central de Rankings", 32, 42);

  const right = pageW - 32;
  doc.setFontSize(10);
  doc.setFont(fontFamily, "bold");
  doc.text(safeStr(periodLabel), right, 26, { align: "right" });
  if (equipeLabel) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.text(safeStr(equipeLabel), right, 42, { align: "right" });
  }

  // Rodapé
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.5);
  doc.line(24, pageH - 28, pageW - 24, pageH - 28);
  doc.setFont(fontFamily, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_MUTED);
  doc.text(
    `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    24,
    pageH - 14
  );
  doc.text("uhomesales.com", pageW / 2, pageH - 14, { align: "center" });
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - 24, pageH - 14, { align: "right" });
}

function drawSectionCard(
  doc: jsPDF,
  fontFamily: string,
  pageW: number,
  rk: PdfRanking,
  startY: number
) {
  const x = 24;
  const w = pageW - 48;
  // Sombra
  doc.setFillColor(220, 222, 230);
  doc.roundedRect(x + 1.5, startY + 1.5, w, 56, 10, 10, "F");
  // Card
  doc.setFillColor(...COLOR_CARD);
  doc.roundedRect(x, startY, w, 56, 10, 10, "F");
  // Acento lateral
  doc.setFillColor(...COLOR_PRIMARY);
  doc.roundedRect(x, startY, 4, 56, 2, 2, "F");

  doc.setTextColor(...COLOR_TEXT);
  doc.setFont(fontFamily, "bold");
  doc.setFontSize(13);
  doc.text(safeStr(rk.title), x + 18, startY + 22);

  if (rk.caption) {
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(safeStr(rk.caption), x + 18, startY + 40);
  }

  doc.setFont(fontFamily, "bold");
  doc.setFontSize(9);
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text(`${rk.rows.length} corretores`, x + w - 14, startY + 22, { align: "right" });
}

export async function exportRankingsPdf(opts: {
  fileName: string;
  periodLabel: string;
  equipeLabel?: string;
  rankings: PdfRanking[];
}) {
  const fonts = await loadMontserrat();
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const fontFamily = registerMontserrat(doc, fonts);
  doc.setFont(fontFamily, "normal");

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Renderiza cada ranking; se contém muitas linhas, autoTable adiciona páginas
  opts.rankings.forEach((rk, idx) => {
    if (idx > 0) doc.addPage();

    drawSectionCard(doc, fontFamily, pageW, rk, 84);

    autoTable(doc, {
      startY: 156,
      head: [["#", ...rk.headers.map(safeStr)]],
      body: rk.rows.map((r, i) => [String(i + 1), ...r.map(v => safeStr(v))]),
      theme: "plain",
      styles: {
        font: fontFamily,
        fontSize: 9.5,
        cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
        textColor: COLOR_TEXT,
        lineColor: COLOR_BORDER,
        lineWidth: 0.4,
      },
      headStyles: {
        font: fontFamily,
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
      margin: { left: 24, right: 24, top: 84, bottom: 40 },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        if (data.column.index === 0) {
          if (data.row.index === 0) data.cell.styles.textColor = COLOR_GOLD;
          else if (data.row.index === 1) data.cell.styles.textColor = COLOR_SILVER;
          else if (data.row.index === 2) data.cell.styles.textColor = COLOR_BRONZE;
        }
        if (data.column.index === 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = COLOR_TEXT;
        }
      },
    });
  });

  // Aplica chrome (background+header+footer) DEPOIS, em todas as páginas, sem cobrir tabelas
  // Estratégia: redesenhar fundo+cabeçalho+rodapé em cada página, mas o conteúdo já está pintado.
  // Para evitar cobrir, usamos drawChrome só nas regiões fora da área de tabela
  // (faixa de 0–64 topo e área de rodapé). Por isso, aqui fazemos só topo + rodapé.
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Topo (faixa)
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(0, 0, pageW, 64, "F");
    doc.setFillColor(...COLOR_PRIMARY_DARK);
    doc.rect(0, 60, pageW, 4, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(15);
    doc.text("UhomeSales", 32, 26);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(10);
    doc.text("Central de Rankings", 32, 42);

    const right = pageW - 32;
    doc.setFont(fontFamily, "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(safeStr(opts.periodLabel), right, 26, { align: "right" });
    if (opts.equipeLabel) {
      doc.setFont(fontFamily, "normal");
      doc.setFontSize(9);
      doc.text(safeStr(opts.equipeLabel), right, 42, { align: "right" });
    }

    // Rodapé
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.5);
    doc.line(24, pageH - 28, pageW - 24, pageH - 28);
    doc.setFont(fontFamily, "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      24,
      pageH - 14
    );
    doc.text("uhomesales.com", pageW / 2, pageH - 14, { align: "center" });
    doc.text(`Página ${p} de ${totalPages}`, pageW - 24, pageH - 14, { align: "right" });
  }

  doc.save(opts.fileName);
}
