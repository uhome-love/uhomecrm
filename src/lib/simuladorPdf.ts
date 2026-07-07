/**
 * Gerador do PDF de simulação de financiamento — layout moderno, marca U.Home,
 * dados do corretor, pronto para enviar no WhatsApp.
 *
 * Usa html2pdf.js (já presente no projeto). As cores aqui são literais porque o
 * PDF é um documento isolado (não a UI do app) e precisa de fidelidade de render.
 */

import { fmtMoney } from "./fmtMoney";
import type { ResultadoSimulacao, AnaliseRenda, AnaliseIdade } from "./financiamento";

export interface DadosCorretor {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface DadosSeguros {
  seguradora: string;
  cetAnual: number;
  primeiraParcelaTotal: number;
  ultimaParcelaTotal: number;
  mip1: number;
  dfi1: number;
  tarifa: number;
  totalSeguros: number;
  idadeConsiderada: number;
  idadeEstimada: boolean;
  dataReferencia: string;
}

export interface DadosPdf {
  corretor: DadosCorretor;
  banco: string;
  modoLabel: string; // "Financiamento convencional" | "Minha Casa Minha Vida — Faixa X"
  regiao?: string; // Região de referência das condições (ex.: Porto Alegre e RM)
  valorImovel: number;
  entrada: number;
  resultado: ResultadoSimulacao;
  analiseRenda: AnaliseRenda | null;
  analiseIdade: AnaliseIdade | null;
  subsidioEstimado?: number;
  clienteNome?: string;
  fonteTaxas: string;
  dataReferencia: string;
  /** Estimativa de seguros (MIP/DFI) + tarifa + CET aproximado, quando ativa. */
  seguros?: DadosSeguros;
}

const BRAND = "#4969FF";
const BRAND_DARK = "#2640BF";
const INK = "#17204D";
const MUTED = "#6B7280";
const FONT = "'Montserrat','Segoe UI',Arial,sans-serif";

/**
 * Logo oficial U.Home (PNG servido em /logo-uhome-pdf.png) sobre um "pill" branco.
 * Usamos <img> em flex com dimensões explícitas e object-fit porque o html2canvas
 * do html2pdf colapsa imagens em span/line-height:0 e rasteriza SVG com transform
 * de forma inconsistente — este formato garante fidelidade total do logo no PDF.
 */
function logoUHomePill(height: number): string {
  const width = Math.round(height * 3.659); // proporção real do PNG (1384×380)
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const src = `${origin}/logo-uhome-pdf.png`;
  return `<div style="display:flex;align-items:center;background:#ffffff;padding:9px 16px;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.12);width:${width}px;">
    <img src="${src}" alt="U.Home" crossorigin="anonymous" style="width:${width}px;height:${height}px;object-fit:contain;display:block;" />
  </div>`;
}


function fmt(v: number) {
  return fmtMoney(v, "exact");
}

function prazoLabel(meses: number) {
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  return m ? `${meses} meses (${anos}a ${m}m)` : `${meses} meses (${anos} anos)`;
}

/** Seleciona parcelas-chave para a mini tabela (1, 12, 24... anuais + última). */
function parcelasChave(r: ResultadoSimulacao) {
  const marcos = new Set<number>([1]);
  for (let ano = 1; ano * 12 <= r.prazoMeses; ano++) {
    if (ano % 5 === 0 || ano === 1) marcos.add(ano * 12);
  }
  marcos.add(12);
  marcos.add(r.prazoMeses);
  return r.parcelas
    .filter((p) => marcos.has(p.numero))
    .sort((a, b) => a.numero - b.numero);
}

function buildHtml(d: DadosPdf): string {
  const r = d.resultado;
  const chave = parcelasChave(r);
  const iniciais = (d.corretor.nome || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  const rendaSelo = d.analiseRenda
    ? d.analiseRenda.aprovavel
      ? `<span style="background:#E7F7EE;color:#0B7A3B;padding:4px 10px;border-radius:8px;font-weight:600;font-size:12px;">✓ Parcela dentro de 30% da renda (${(d.analiseRenda.percentualComprometido * 100).toFixed(1)}%)</span>`
      : `<span style="background:#FDEBEB;color:#C0392B;padding:4px 10px;border-radius:8px;font-weight:600;font-size:12px;">⚠ Comprometimento acima de 30% (${(d.analiseRenda.percentualComprometido * 100).toFixed(1)}%) — risco de reprovação</span>`
    : "";

  const linhasTabela = chave
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #EEF0F5;">${p.numero}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEF0F5;text-align:right;font-weight:600;">${fmt(p.prestacao)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEF0F5;text-align:right;color:${MUTED};">${fmt(p.juros)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEF0F5;text-align:right;color:${MUTED};">${fmt(p.amortizacao)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #EEF0F5;text-align:right;">${fmt(p.saldoDevedor)}</td>
      </tr>`,
    )
    .join("");

  const card = (label: string, value: string, big = false) => `
    <div style="background:#F7F8FC;border:1px solid #EEF0F5;border-radius:12px;padding:12px 14px;">
      <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;">${label}</div>
      <div style="font-size:${big ? "22px" : "16px"};font-weight:700;color:${INK};margin-top:2px;">${value}</div>
    </div>`;

  const subsidioLinha =
    d.subsidioEstimado && d.subsidioEstimado > 0
      ? `<div style="margin-top:8px;font-size:12px;color:${BRAND_DARK};">Subsídio estimado abatido: <strong>${fmt(d.subsidioEstimado)}</strong> (valor exato depende da análise da Caixa)</div>`
      : "";

  return `
  <div style="font-family:${FONT};color:${INK};width:760px;padding:0;background:#fff;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});padding:26px 32px;color:#fff;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          ${logoUHomePill(30)}
          <div style="font-size:13px;opacity:.92;margin-top:10px;font-weight:500;">Simulação de Financiamento Imobiliário</div>
        </div>
        <div style="text-align:right;font-size:12px;opacity:.9;font-weight:500;">
          ${d.modoLabel}<br/>
          ${d.regiao ? `${d.regiao}<br/>` : ""}
          Emitido em ${new Date().toLocaleDateString("pt-BR")}
        </div>
      </div>
    </div>

    <div style="padding:24px 32px;">
      ${d.clienteNome ? `<div style="font-size:13px;color:${MUTED};margin-bottom:12px;">Cliente: <strong style="color:${INK};">${d.clienteNome}</strong></div>` : ""}

      <!-- Hero cards -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
        ${card("Valor do imóvel", fmt(d.valorImovel))}
        ${card("Entrada", fmt(d.entrada))}
        ${card("Valor financiado", fmt(r.valorFinanciado))}
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-top:10px;">
        ${card("Banco", d.banco)}
        <div style="background:linear-gradient(135deg,${BRAND},${BRAND_DARK});border-radius:12px;padding:12px 14px;color:#fff;">
          <div style="font-size:11px;opacity:.9;text-transform:uppercase;letter-spacing:.04em;">1ª parcela</div>
          <div style="font-size:24px;font-weight:800;margin-top:2px;">${fmt(r.primeiraParcela)}</div>
        </div>
      </div>
      ${subsidioLinha}

      <!-- Resumo -->
      <div class="avoid-break" style="margin-top:20px;background:#F7F8FC;border:1px solid #EEF0F5;border-radius:12px;padding:16px;">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:13px;">
          <div><span style="color:${MUTED};">Sistema</span><br/><strong>${r.sistema}</strong></div>
          <div><span style="color:${MUTED};">Taxa de juros</span><br/><strong>${(r.taxaAnual * 100).toFixed(2)}% a.a. (${(r.taxaMensal * 100).toFixed(3)}% a.m.)</strong></div>
          <div><span style="color:${MUTED};">Prazo</span><br/><strong>${prazoLabel(r.prazoMeses)}</strong></div>
          <div><span style="color:${MUTED};">Última parcela</span><br/><strong>${fmt(r.ultimaParcela)}</strong></div>
          <div><span style="color:${MUTED};">Total de juros</span><br/><strong>${fmt(r.totalJuros)}</strong></div>
          <div><span style="color:${MUTED};">Total pago</span><br/><strong>${fmt(r.totalPago)}</strong></div>
        </div>
        <div style="margin-top:12px;">${rendaSelo}</div>
        ${d.analiseIdade ? `<div style="margin-top:8px;font-size:12px;color:${MUTED};">Idade do proponente: ${d.analiseIdade.idadeAnos} anos — prazo dentro do limite de 80 anos e 6 meses ao fim do contrato.</div>` : ""}
      </div>

      ${
        d.seguros
          ? `
      <!-- Seguros + CET -->
      <div class="avoid-break" style="margin-top:16px;background:#F0F2FF;border:1px solid #DEE3FF;border-radius:12px;padding:16px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:10px;">Parcela com seguros e CET aproximado</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          ${card("1ª parcela + seguros", fmt(d.seguros.primeiraParcelaTotal), true)}
          ${card("CET aproximado", `${(d.seguros.cetAnual * 100).toFixed(2)}% a.a.`)}
          ${card("Custo total dos seguros", fmt(d.seguros.totalSeguros))}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:12px;margin-top:12px;color:${MUTED};">
          <div>MIP (1ª): <strong style="color:${INK};">${fmt(d.seguros.mip1)}</strong></div>
          <div>DFI (mensal): <strong style="color:${INK};">${fmt(d.seguros.dfi1)}</strong></div>
          <div>Tarifa adm.: <strong style="color:${INK};">${fmt(d.seguros.tarifa)}</strong></div>
        </div>
        <div style="margin-top:10px;font-size:11px;color:${MUTED};">
          Seguradora de referência: <strong style="color:${INK};">${d.seguros.seguradora}</strong>.
          MIP calculado para ${d.seguros.idadeConsiderada} anos${d.seguros.idadeEstimada ? " (idade estimada — informe a data de nascimento para maior precisão)" : ""}
          e recalculado sobre o saldo devedor a cada faixa etária. Valores estimados (ref. ${d.seguros.dataReferencia}).
        </div>
      </div>`
          : ""
      }

      <!-- Tabela -->
      <div class="avoid-break" style="margin-top:20px;">
        <div style="font-size:14px;font-weight:700;margin-bottom:8px;">Evolução das parcelas</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead>
            <tr style="color:${MUTED};text-align:left;">
              <th style="padding:6px 8px;border-bottom:2px solid #E5E8F0;">Parcela</th>
              <th style="padding:6px 8px;border-bottom:2px solid #E5E8F0;text-align:right;">Prestação</th>
              <th style="padding:6px 8px;border-bottom:2px solid #E5E8F0;text-align:right;">Juros</th>
              <th style="padding:6px 8px;border-bottom:2px solid #E5E8F0;text-align:right;">Amortização</th>
              <th style="padding:6px 8px;border-bottom:2px solid #E5E8F0;text-align:right;">Saldo devedor</th>
            </tr>
          </thead>
          <tbody>${linhasTabela}</tbody>
        </table>
      </div>

      <!-- Corretor -->
      <div class="avoid-break" style="margin-top:24px;display:flex;align-items:center;gap:14px;background:#F0F2FF;border:1px solid #DEE3FF;border-radius:12px;padding:16px;">
        ${
          d.corretor.avatarUrl
            ? `<img src="${d.corretor.avatarUrl}" style="width:52px;height:52px;border-radius:50%;object-fit:cover;" />`
            : `<div style="width:52px;height:52px;border-radius:50%;background:${BRAND};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;">${iniciais}</div>`
        }
        <div style="flex:1;">
          <div style="font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:.04em;">Seu corretor</div>
          <div style="font-size:16px;font-weight:700;color:${INK};">${d.corretor.nome}</div>
          <div style="font-size:12px;color:${MUTED};">
            ${d.corretor.telefone ? `Tel.: ${d.corretor.telefone}` : ""}
            ${d.corretor.email ? ` &nbsp;•&nbsp; ${d.corretor.email}` : ""}
          </div>
        </div>
        <div style="background:${BRAND};color:#fff;padding:8px 16px;border-radius:10px;font-weight:600;font-size:13px;">Fale comigo</div>
      </div>

      <!-- Rodapé / aviso legal -->
      <div class="avoid-break" style="margin-top:18px;font-size:10.5px;color:${MUTED};line-height:1.5;border-top:1px solid #EEF0F5;padding-top:12px;">
        <strong>Taxas de referência: ${d.dataReferencia}.</strong> Fonte: ${d.fonteTaxas}.
        ${
          d.seguros
            ? "Parcela já com estimativa de seguros MIP/DFI e tarifa de administração; CET aproximado (não inclui TR projetada, IOF nem tarifa de avaliação — o CET oficial sai na carta do banco). Seguros são estimativas de mercado por idade/seguradora e variam conforme a apólice."
            : "Simulação estimativa (+ TR, sem seguros/CET)."
        }
        No Minha Casa Minha Vida, o enquadramento, o subsídio e a taxa
        dependem da análise da Caixa por renda/região. Condições finais sujeitas à aprovação do banco.
      </div>
    </div>
  </div>`;
}

/** Garante que a fonte Montserrat esteja carregada antes de rasterizar o PDF. */
async function ensureMontserrat() {
  if (typeof document === "undefined") return;
  const ID = "montserrat-pdf-font";
  if (!document.getElementById(ID)) {
    const link = document.createElement("link");
    link.id = ID;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }
  try {
    if ((document as any).fonts?.load) {
      await Promise.all([
        (document as any).fonts.load("400 16px Montserrat"),
        (document as any).fonts.load("600 16px Montserrat"),
        (document as any).fonts.load("700 16px Montserrat"),
        (document as any).fonts.load("800 16px Montserrat"),
      ]);
      await (document as any).fonts.ready;
    }
  } catch {
    /* segue com fallback de fonte */
  }
}

export async function gerarPdfSimulacao(d: DadosPdf, acao: "download" | "share" = "download") {
  const html2pdf = (await import("html2pdf.js")).default;
  await ensureMontserrat();
  const container = document.createElement("div");
  container.innerHTML = buildHtml(d);
  container.style.position = "fixed";
  container.style.left = "-10000px";
  document.body.appendChild(container);

  // Garante que todas as imagens (logo, avatar) estejam decodificadas antes de
  // rasterizar — evita quadros em branco no lugar do logo no html2canvas.
  await Promise.all(
    Array.from(container.querySelectorAll("img")).map((img) => {
      const el = img as HTMLImageElement;
      if (el.complete && el.naturalWidth > 0) return Promise.resolve();
      return el.decode().catch(() => undefined);
    }),
  );

  const nomeArquivo = `Simulacao-${d.banco.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const opt = {
    margin: [0, 0, 0, 0] as [number, number, number, number],
    filename: nomeArquivo,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "pt", format: "a4", orientation: "portrait" as const },
    pagebreak: { mode: ["css", "legacy"], avoid: ".avoid-break" },
  };

  try {
    const worker = html2pdf().set(opt).from(container.firstElementChild as HTMLElement);

    if (acao === "share" && typeof navigator !== "undefined" && (navigator as any).canShare) {
      const blob: Blob = await worker.outputPdf("blob");
      const file = new File([blob], nomeArquivo, { type: "application/pdf" });
      if ((navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({ files: [file], title: "Simulação de Financiamento" });
        return;
      }
      // fallback para download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    await worker.save();
  } finally {
    document.body.removeChild(container);
  }
}
