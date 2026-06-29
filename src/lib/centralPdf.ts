/**
 * centralPdf — exportação PDF da Central de Relatórios v2 (view Geral).
 *
 * Stack: html2canvas (captura DOM) + jsPDF (gera A4 retrato).
 *
 * exportGeral():
 *  - Página 1: capa (logo, título, período, equipe, gerado em DD/MM/AAAA HH:mm BRT)
 *  - Páginas 2..N: captura do elemento #central-relatorio-geral fatiada em A4
 *  - Rodapé "Página X de Y" em todas as páginas (post-loop via setPage)
 */
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatBRT } from "@/lib/brtTime";

export interface ExportMeta {
  periodoLabel: string;
  equipeLabel: string;
  /** Se omitido, usa "agora" formatado em BRT. */
  geradoEm?: string;
  /** id do elemento DOM a capturar. Default: central-relatorio-geral. */
  targetId?: string;
  /** Subtítulo exibido na capa. Default: "Visão geral consolidada". */
  subtitulo?: string;
}

const A4_W_MM = 210;
const A4_H_MM = 297;
const MARGIN_MM = 12;

export async function exportGeral(meta: ExportMeta): Promise<void> {
  const targetId = meta.targetId ?? "central-relatorio-geral";
  const target =
    document.getElementById(targetId) ??
    document.getElementById("central-relatorio-secao") ??
    document.getElementById("central-relatorio-geral");
  if (!target) {
    throw new Error(`Elemento #${targetId} não encontrado.`);
  }

  const geradoEm = meta.geradoEm ?? formatBRT(new Date(), "dd/MM/yyyy HH:mm");

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ─── Capa ────────────────────────────────────────────────────
  drawCover(pdf, {
    periodoLabel: meta.periodoLabel,
    equipeLabel: meta.equipeLabel,
    geradoEm,
    subtitulo: meta.subtitulo ?? "Visão geral consolidada",
  });

  // ─── Captura conteúdo ────────────────────────────────────────
  const canvas = await html2canvas(target, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const contentWmm = A4_W_MM - MARGIN_MM * 2;
  const contentHmm = A4_H_MM - MARGIN_MM * 2;
  const pxPerMm = canvas.width / contentWmm;
  const sliceHpx = Math.floor(contentHmm * pxPerMm);

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
    ctx.drawImage(
      canvas,
      0,
      offset,
      canvas.width,
      sliceH,
      0,
      0,
      canvas.width,
      sliceH
    );

    pdf.addPage();
    const imgH = sliceH / pxPerMm;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.92),
      "JPEG",
      MARGIN_MM,
      MARGIN_MM,
      contentWmm,
      imgH
    );

    offset += sliceH;
  }

  // ─── Rodapé numerado ─────────────────────────────────────────
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text(
      `Página ${i} de ${total}`,
      A4_W_MM - MARGIN_MM,
      A4_H_MM - 6,
      { align: "right" }
    );
  }

  const filename = `central-relatorios-${formatBRT(new Date(), "yyyy-MM-dd-HHmm")}.pdf`;
  pdf.save(filename);
}

function drawCover(
  pdf: jsPDF,
  meta: { periodoLabel: string; equipeLabel: string; geradoEm: string; subtitulo: string }
) {
  pdf.setFontSize(28);
  pdf.setTextColor(20);
  pdf.text("Central de Relatórios", MARGIN_MM, 60);

  pdf.setFontSize(14);
  pdf.setTextColor(80);
  pdf.text(meta.subtitulo, MARGIN_MM, 70);

  pdf.setDrawColor(200);
  pdf.line(MARGIN_MM, 80, A4_W_MM - MARGIN_MM, 80);

  pdf.setFontSize(11);
  pdf.setTextColor(60);
  pdf.text(`Período: ${meta.periodoLabel}`, MARGIN_MM, 95);
  pdf.text(`Equipe: ${meta.equipeLabel}`, MARGIN_MM, 103);
  pdf.text(`Gerado em: ${meta.geradoEm} (BRT)`, MARGIN_MM, 111);

  pdf.setFontSize(9);
  pdf.setTextColor(140);
  pdf.text("Uhome Sales · Central de Relatórios v2", MARGIN_MM, A4_H_MM - 12);
}
