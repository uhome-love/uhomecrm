/**
 * performanceReport.ts — relatório da Performance em HTML e PDF.
 *
 * Um único modelo de dados alimenta os dois formatos (nada de print de tela).
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtMoney } from "@/lib/fmtMoney";
import {
  agruparFunilPorEquipe,
  presencaPct,
  somarFunil,
  type FunilLinha,
} from "@/hooks/useFunilPerformance";

export interface ReportMeta {
  periodoLabel: string;
  escopo: string;
  geradoEm: string;
}

const n = (v: number) => v.toLocaleString("pt-BR");

function modelo(linhas: FunilLinha[]) {
  const total = somarFunil(linhas);
  const grupos = agruparFunilPorEquipe(linhas);
  const head = ["Corretor", "Presença", "Leads", "Pipeline", "Descartes", "Visitas", "Realizadas", "Negócios", "Gerado", "Assinado"];
  const body: string[][] = [];
  grupos.forEach((g) => {
    body.push([`Equipe ${g.equipe}`, "", "", "", "", "", "", "", "", ""]);
    g.membros.forEach((l) =>
      body.push([
        l.corretor_nome ?? "—",
        `${l.presenca_dias}/${l.dias_uteis_decorridos || l.dias_uteis}`,
        n(l.leads_recebidos),
        n(l.pipeline_ativo),
        n(l.descartes),
        n(l.visitas_total),
        n(l.visitas_realizadas),
        n(l.negocios_abertos),
        fmtMoney(l.vgv_gerado, "short"),
        fmtMoney(l.vgv_assinado, "short"),
      ])
    );
    body.push([
      `Total ${g.equipe}`,
      "",
      n(g.totais.leads_recebidos),
      n(g.totais.pipeline_ativo),
      n(g.totais.descartes),
      n(g.totais.visitas_total),
      n(g.totais.visitas_realizadas),
      n(g.totais.negocios_abertos),
      fmtMoney(g.totais.vgv_gerado, "short"),
      fmtMoney(g.totais.vgv_assinado, "short"),
    ]);
  });
  return { total, head, body };
}

export function gerarRelatorioHtml(linhas: FunilLinha[], meta: ReportMeta): string {
  const { total, head, body } = modelo(linhas);
  const kpis = [
    ["Presença", `${Math.round(presencaPct(total))}%`],
    ["Leads recebidos", n(total.leads_recebidos)],
    ["Visitas totais", n(total.visitas_total)],
    ["Visitas realizadas", n(total.visitas_realizadas)],
    ["Negócios abertos", n(total.negocios_abertos)],
    ["VGV gerado", fmtMoney(total.vgv_gerado, "short")],
    ["VGV assinado", fmtMoney(total.vgv_assinado, "short")],
  ];
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Performance — ${esc(meta.periodoLabel)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;background:#F8FAFC;color:#0A0E1A;margin:0;padding:28px}
.w{max-width:1100px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}p.sub{color:#64748B;font-size:13px;margin:0 0 22px}
.k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.c{background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:12px}
.c b{display:block;font-size:19px;margin-top:4px}.c span{font-size:11px;color:#64748B}
table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #E2E8F0;border-radius:12px;overflow:hidden}
th{background:#F1F5F9;text-align:left;padding:8px;font-size:10.5px;text-transform:uppercase;color:#475569}
td{padding:7px 8px;border-top:1px solid #F1F5F9}
@media print{body{background:#fff}}
</style></head><body><div class="w">
<h1>Performance Comercial</h1>
<p class="sub">${esc(meta.periodoLabel)} · ${esc(meta.escopo)} · gerado em ${esc(meta.geradoEm)} (BRT)</p>
<div class="k">${kpis.map(([l, v]) => `<div class="c"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("")}</div>
<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>
</div></body></html>`;
}

export function baixarRelatorioHtml(linhas: FunilLinha[], meta: ReportMeta) {
  const blob = new Blob([gerarRelatorioHtml(linhas, meta)], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `performance-${meta.periodoLabel.replace(/[^\w]+/g, "-").toLowerCase()}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function baixarRelatorioPdf(linhas: FunilLinha[], meta: ReportMeta) {
  const { total, head, body } = modelo(linhas);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  doc.setFontSize(18);
  doc.text("Performance Comercial", 40, 44);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${meta.periodoLabel} · ${meta.escopo} · gerado em ${meta.geradoEm} (BRT)`, 40, 62);

  doc.setTextColor(20);
  const resumo = [
    `Presença ${Math.round(presencaPct(total))}%`,
    `Leads ${n(total.leads_recebidos)}`,
    `Visitas ${n(total.visitas_total)} (${n(total.visitas_realizadas)} realizadas)`,
    `Negócios ${n(total.negocios_abertos)}`,
    `Gerado ${fmtMoney(total.vgv_gerado, "short")}`,
    `Assinado ${fmtMoney(total.vgv_assinado, "short")}`,
  ].join("   |   ");
  doc.setFontSize(9);
  doc.text(resumo, 40, 82);

  autoTable(doc, {
    head: [head],
    body,
    startY: 96,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [73, 105, 255] },
    didParseCell: (d) => {
      const first = String(d.row.raw?.[0] ?? "");
      if (d.section === "body" && (first.startsWith("Equipe ") || first.startsWith("Total "))) {
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.fillColor = [241, 245, 249];
      }
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Página ${i} de ${pages}`, doc.internal.pageSize.getWidth() - 90, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`performance-${meta.periodoLabel.replace(/[^\w]+/g, "-").toLowerCase()}.pdf`);
}
