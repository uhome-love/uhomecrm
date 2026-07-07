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

/** Logo oficial U.Home (vetorial). `fill` permite versão branca no cabeçalho. */
function logoUHome(fill: string, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" height="${height}" style="display:block;">
    <g transform="translate(0,1080) scale(0.1,-0.1)" fill="${fill}" stroke="none">
      <path d="M4295 7600 c-633 -43 -1197 -397 -1515 -951 -308 -537 -329 -1205 -56 -1764 290 -593 865 -990 1531 -1055 215 -22 545 16 754 85 656 219 1135 763 1273 1446 20 101 23 141 23 359 -1 263 -9 322 -70 536 -167 576 -631 1057 -1205 1247 -251 84 -481 114 -735 97z m314 -527 l181 -187 0 87 0 87 325 0 325 0 0 -423 0 -423 217 -224 217 -225 -201 -3 -201 -2 -5 -368 c-5 -392 -9 -430 -62 -588 -138 -412 -492 -634 -1009 -634 -212 0 -391 42 -543 127 -275 154 -432 409 -472 766 -6 53 -11 231 -11 397 l0 300 -202 0 -201 0 74 78 c120 124 883 915 1139 1179 129 134 238 243 242 243 3 0 88 -84 187 -187z"/>
      <path d="M4120 6674 c-162 -168 -382 -396 -489 -507 l-195 -202 67 -3 67 -3 0 -422 c0 -448 6 -532 51 -667 115 -352 452 -543 889 -501 338 32 548 159 668 405 84 173 102 318 102 849 l0 337 67 0 68 0 -83 83 -82 82 0 368 0 367 -135 0 -135 0 -2 -224 -3 -225 -275 285 c-151 156 -277 284 -280 284 -3 -1 -138 -138 -300 -306z m-70 -1117 c0 -371 2 -410 20 -482 11 -43 34 -100 51 -126 73 -114 222 -161 405 -128 110 20 192 88 235 195 24 58 24 65 29 499 l5 440 98 3 98 3 -3 -443 c-4 -487 -5 -494 -70 -628 -42 -87 -136 -181 -220 -220 -135 -62 -308 -74 -462 -31 -155 43 -283 163 -337 318 -42 117 -49 206 -49 616 l0 387 100 0 100 0 0 -403z"/>
      <path d="M6750 5510 l0 -1220 275 0 275 0 0 495 0 495 398 -2 397 -3 3 -492 2 -493 275 0 275 0 0 1220 0 1220 -275 0 -275 0 0 -485 0 -485 -400 0 -400 0 0 485 0 485 -275 0 -275 0 0 -1220z"/>
      <path d="M9624 5836 c-162 -31 -271 -75 -390 -157 -216 -150 -334 -373 -334 -634 0 -465 375 -795 905 -795 176 0 317 31 460 100 224 108 382 300 430 524 26 117 17 314 -18 417 -69 202 -225 368 -440 469 -126 59 -226 81 -397 86 -96 2 -169 -1 -216 -10z m281 -440 c69 -18 104 -38 153 -85 139 -135 140 -386 1 -521 -68 -66 -154 -100 -254 -100 -100 0 -186 34 -254 100 -84 82 -121 225 -91 351 47 195 245 309 445 255z"/>
      <path d="M11785 5826 c-97 -32 -145 -58 -220 -121 -35 -30 -67 -55 -70 -55 -3 0 -5 36 -5 80 l0 80 -260 0 -260 0 0 -760 0 -760 260 0 260 0 0 473 c0 530 1 535 69 607 69 73 208 90 310 38 51 -26 104 -95 121 -156 6 -23 10 -216 10 -499 l0 -463 260 0 260 0 0 470 c0 444 1 472 20 523 48 127 176 184 318 142 67 -20 114 -62 149 -133 l28 -57 3 -472 3 -473 259 0 260 0 0 483 c-1 265 -5 527 -10 582 -10 119 -41 212 -94 284 -50 67 -164 143 -269 177 -71 24 -99 28 -207 28 -116 1 -130 -1 -195 -28 -93 -38 -165 -87 -253 -170 -40 -38 -74 -67 -76 -65 -1 2 -17 25 -34 51 -49 71 -131 133 -225 168 -145 54 -297 64 -412 26z"/>
      <path d="M14468 5840 c-123 -22 -256 -78 -348 -145 -27 -20 -85 -74 -129 -121 -66 -70 -91 -105 -130 -187 -65 -135 -76 -185 -75 -342 1 -227 60 -374 216 -533 200 -204 447 -287 748 -253 208 24 372 92 496 205 64 59 153 170 143 180 -2 2 -85 44 -184 94 l-180 90 -57 -52 c-99 -90 -194 -122 -338 -114 -59 4 -89 12 -140 37 -36 18 -77 43 -91 57 -38 36 -70 107 -76 169 l-6 55 553 0 553 0 -6 128 c-3 78 -13 157 -26 203 -66 255 -258 439 -531 510 -94 24 -307 35 -392 19z m286 -344 c74 -31 138 -110 157 -193 l7 -33 -294 0 -293 0 5 33 c17 91 97 177 191 203 57 16 177 11 227 -10z"/>
      <path d="M15890 4898 c-76 -30 -160 -114 -188 -191 -72 -192 41 -405 237 -447 188 -40 365 78 401 266 21 108 -12 213 -92 294 -92 92 -240 125 -358 78z"/>
    </g>
  </svg>`;
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
          ${logoUHome("#ffffff", 34)}
          <div style="font-size:13px;opacity:.9;margin-top:8px;font-weight:500;">Simulação de Financiamento Imobiliário</div>
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
      <div style="margin-top:20px;background:#F7F8FC;border:1px solid #EEF0F5;border-radius:12px;padding:16px;">
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

      <!-- Tabela -->
      <div style="margin-top:20px;">
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
      <div style="margin-top:24px;display:flex;align-items:center;gap:14px;background:#F0F2FF;border:1px solid #DEE3FF;border-radius:12px;padding:16px;">
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
      <div style="margin-top:18px;font-size:10.5px;color:${MUTED};line-height:1.5;border-top:1px solid #EEF0F5;padding-top:12px;">
        <strong>Taxas de referência: ${d.dataReferencia}.</strong> Fonte: ${d.fonteTaxas}.
        Simulação estimativa (+ TR, sem seguros/CET). No Minha Casa Minha Vida, o enquadramento, o subsídio e a taxa
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

  const nomeArquivo = `Simulacao-${d.banco.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;

  const opt = {
    margin: [0, 0, 0, 0] as [number, number, number, number],
    filename: nomeArquivo,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "pt", format: "a4", orientation: "portrait" as const },
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
