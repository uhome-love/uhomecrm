import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PdfRanking {
  title: string;
  caption?: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportRankingsPdf(opts: {
  fileName: string;
  periodLabel: string;
  equipeLabel?: string;
  rankings: PdfRanking[];
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho da capa / cada ranking começa em página nova exceto o primeiro
  opts.rankings.forEach((rk, idx) => {
    if (idx > 0) doc.addPage();

    // Topo
    doc.setFillColor(73, 105, 255); // indigo do tema
    doc.rect(0, 0, pageW, 56, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("UHomeSales · Rankings", 32, 26);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `${opts.periodLabel}${opts.equipeLabel ? ` · ${opts.equipeLabel}` : ""}`,
      32, 44
    );

    // Título do ranking
    doc.setTextColor(20, 20, 30);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(rk.title, 32, 84);
    if (rk.caption) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110, 110, 120);
      doc.text(rk.caption, 32, 100);
    }

    autoTable(doc, {
      startY: 112,
      head: [["#", ...rk.headers]],
      body: rk.rows.map((r, i) => [String(i + 1), ...r.map(v => String(v))]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [240, 240, 245], textColor: [40, 40, 50], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      margin: { left: 32, right: 32 },
    });

    // Rodapé
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      32, ph - 16
    );
    doc.text(`Página ${idx + 1} de ${opts.rankings.length}`, pageW - 32, ph - 16, { align: "right" });
  });

  doc.save(opts.fileName);
}
