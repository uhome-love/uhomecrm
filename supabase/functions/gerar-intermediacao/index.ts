import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, HeadingLevel,
} from "npm:docx@8.5.0";

// Logo Uhome (PNG base64) — gerada de public/images/uhome-logo-128.png
const LOGO_BASE64 = "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";

// ─── Dados fixos (nunca alterar) ───────────────────────────────────────────────
const UHOME = { cnpj: "37.900.790/0001-71", creci: "25.682J", endereco: "avenida João Wallig, n° 573, loja 01" };
// Dados sensíveis de funcionários (CPF, RG, endereço) carregados de segredos do backend.
// Configure os segredos INTERMEDIACAO_LUCAS_JSON e INTERMEDIACAO_GABRIELLE_JSON.
function loadPessoa(envName: string): Record<string, string> {
  const raw = Deno.env.get(envName);
  if (!raw) throw new Error(`Configuração ausente: segredo ${envName} não definido.`);
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    throw new Error(`Configuração inválida: segredo ${envName} não é um JSON válido.`);
  }
}
const LUCAS = loadPessoa("INTERMEDIACAO_LUCAS_JSON");
const GABRIELLE = loadPessoa("INTERMEDIACAO_GABRIELLE_JSON");
const TEST1 = { nome: "Gabriel Vieira", email: "gabriel.uhome@gmail.com" };
const TEST2 = { nome: "Carolina de Camargo Madruga", email: "carolina@uhome.com.br" };

// ─── Schemas ────────────────────────────────────────────────────────────────────
const ParcelaSchema = z.object({ vencimento: z.string().min(1), valor: z.number().positive() });
const CorretorSchema = z.object({
  nome: z.string().min(1), cpf: z.string().default(""), rg: z.string().default(""),
  email: z.string().default(""), percentual: z.number().min(0),
});
const BodySchema = z.object({
  comprador: z.object({
    tipoPessoa: z.enum(["PF", "PJ"]),
    razaoSocial: z.string().default(""), cnpj: z.string().default(""), socioAdmin: z.string().default(""),
    nomeCompleto: z.string().default(""), genero: z.string().default(""), profissao: z.string().default(""),
    estadoCivil: z.string().default(""), regimeBens: z.string().default(""),
    cpf: z.string().default(""), rg: z.string().default(""), telefone: z.string().default(""),
    email: z.string().default(""), endereco: z.string().default(""),
  }),
  imovel: z.object({ empreendimento: z.string().min(1), unidade: z.string().min(1), vgv: z.number().nonnegative() }),
  corretores: z.array(CorretorSchema).min(1).max(2),
  comissao: z.object({
    valorTotal: z.number().positive(),
    pctGabrielle: z.number().min(0), pctDiretoria: z.number().min(0),
    parcelas: z.array(ParcelaSchema).min(1),
  }),
  dataContrato: z.string().min(1),
});

type Body = z.infer<typeof BodySchema>;

// ─── Helpers ────────────────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtCurta = (iso: string) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y.slice(2)}`; };
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const dataExtenso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };
const primeiroNome = (s: string) => s.trim().split(/\s+/)[0] ?? "";
const sobrenome = (s: string) => { const p = s.trim().split(/\s+/); return p.length > 1 ? p[p.length - 1] : p[0] ?? ""; };
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "").trim();
// Nome de referência para o arquivo: PJ usa a 1ª palavra significativa da Razão Social
// (ignorando sufixos societários); PF mantém o sobrenome (última palavra).
function nomeParaArquivo(tipoPessoa: "PF" | "PJ", nomeOuRazao: string): string {
  if (tipoPessoa === "PJ") {
    const limpo = nomeOuRazao
      .replace(/\b(LTDA\.?|S\/?A\.?|EIRELI|ME|EPP|EMPREENDIMENTOS?|HOLDING)\b/gi, "")
      .trim();
    const primeira = limpo.split(/\s+/).filter(Boolean)[0] || "Empresa";
    return primeira.replace(/[^a-zA-Z0-9]/g, "");
  }
  const partes = nomeOuRazao.trim().split(/\s+/);
  return partes[partes.length - 1];
}
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface CredorCalc { nome: string; isUhome: boolean; total: number; parcelas: number[]; }

function calcular(b: Body) {
  const valorTotal = b.comissao.valorTotal;
  const valoresParcelas = b.comissao.parcelas.map((p) => p.valor);
  const somaCorr = b.corretores.reduce((s, c) => s + c.percentual, 0);
  const pctUhome = Math.max(0, 100 - somaCorr - b.comissao.pctGabrielle - b.comissao.pctDiretoria);

  const defs = [
    ...b.corretores.map((c) => ({ nome: c.nome, pct: c.percentual, isUhome: false })),
    { nome: "Gabrielle Rodrigues", pct: b.comissao.pctGabrielle, isUhome: false },
    { nome: "Diretoria", pct: b.comissao.pctDiretoria, isUhome: false },
    { nome: "UHome", pct: pctUhome, isUhome: true },
  ];

  const credores: CredorCalc[] = defs.map((d) => {
    const total = round2((d.pct / 100) * valorTotal);
    const ps: number[] = [];
    let acc = 0;
    valoresParcelas.forEach((vp, i) => {
      if (i === valoresParcelas.length - 1) ps.push(round2(total - acc));
      else { const v = round2((d.pct / 100) * vp); ps.push(v); acc = round2(acc + v); }
    });
    return { nome: d.nome, isUhome: d.isUhome, total, parcelas: ps };
  });

  const totalLinha = valoresParcelas.map((_, i) => round2(credores.reduce((s, c) => s + c.parcelas[i], 0)));
  const totalGeral = round2(credores.reduce((s, c) => s + c.total, 0));
  const zemoCred = credores.filter((c) => !c.isUhome);
  const zemo = {
    total: round2(zemoCred.reduce((s, c) => s + c.total, 0)),
    parcelas: valoresParcelas.map((_, i) => round2(zemoCred.reduce((s, c) => s + c.parcelas[i], 0))),
  };
  return { credores, totalLinha, totalGeral, zemo };
}

// ─── Builders de docx ───────────────────────────────────────────────────────────
const NORMAL = (text: string, opts: { bold?: boolean } = {}) =>
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text, bold: opts.bold })] });

const runsParagraph = (children: TextRun[]) =>
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children });

const cabecalho = () => {
  if (LOGO_BASE64) {
    const bytes = Uint8Array.from(atob(LOGO_BASE64), (c) => c.charCodeAt(0));
    return new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new ImageRun({ type: "png", data: bytes, transformation: { width: 110, height: 110 } })],
    });
  }
  // TODO: substituir por ImageRun com logo real
  return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "UHome.", bold: true, size: 36 })] });
};

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
const tcell = (text: string, opts: { bold?: boolean; fill?: string; width?: number; size?: number } = {}) =>
  new TableCell({
    borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 16 })] })],
  });

function tabelaComissao(calc: ReturnType<typeof calcular>, parcelas: Body["comissao"]["parcelas"]) {
  const n = parcelas.length;
  const dataSize = n > 5 ? 14 : 16; // 7pt para muitas parcelas, 8pt no caso comum
  const credorW = 1800, valorW = 1600;
  const parcelaW = Math.floor((9026 - credorW - valorW) / n);
  const columnWidths = [credorW, valorW, ...parcelas.map(() => parcelaW)];
  const tableWidth = columnWidths.reduce((s, w) => s + w, 0);

  const header = new TableRow({
    children: [
      tcell("Credor", { bold: true, fill: "EEEEFF", width: credorW }),
      tcell("Valor", { bold: true, fill: "EEEEFF", width: valorW }),
      ...parcelas.map((p) => tcell(fmtCurta(p.vencimento), { bold: true, fill: "EEEEFF", width: parcelaW })),
    ],
  });
  const rows = calc.credores.map((c) =>
    new TableRow({ children: [
      tcell(c.nome, { width: credorW, size: dataSize }),
      tcell(brl(c.total), { width: valorW, size: dataSize }),
      ...c.parcelas.map((v) => tcell(brl(v), { width: parcelaW, size: dataSize })),
    ] }));
  const totalRow = new TableRow({
    children: [
      tcell("Total", { bold: true, fill: "F4F4F4", width: credorW, size: dataSize }),
      tcell(brl(calc.totalGeral), { bold: true, fill: "F4F4F4", width: valorW, size: dataSize }),
      ...calc.totalLinha.map((v) => tcell(brl(v), { bold: true, fill: "F4F4F4", width: parcelaW, size: dataSize })),
    ],
  });
  return new Table({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths, rows: [header, ...rows, totalRow] });
}

function tabelaZemo(calc: ReturnType<typeof calcular>, parcelas: Body["comissao"]["parcelas"]) {
  const n = parcelas.length;
  const dataSize = n > 5 ? 14 : 16; // 7pt para muitas parcelas, 8pt no caso comum
  // Colunas fixas mais estreitas liberam espaço para as parcelas quando há muitas.
  const credorW = n > 5 ? 1600 : 1800, pagW = n > 5 ? 900 : 1200, valorW = 1600;
  const parcelaW = Math.floor((9026 - credorW - pagW - valorW) / n);
  const columnWidths = [credorW, pagW, valorW, ...parcelas.map(() => parcelaW)];
  const tableWidth = columnWidths.reduce((s, w) => s + w, 0);

  const header = new TableRow({
    children: [
      tcell("Credor", { bold: true, fill: "EEEEFF", width: credorW }),
      tcell("Pagamento", { bold: true, fill: "EEEEFF", width: pagW }),
      tcell("Valor total", { bold: true, fill: "EEEEFF", width: valorW }),
      ...parcelas.map((p) => tcell(fmtCurta(p.vencimento), { bold: true, fill: "EEEEFF", width: parcelaW })),
    ],
  });
  const row = new TableRow({
    children: [
      tcell("ZemoBank", { width: credorW, size: dataSize }),
      tcell("Pix ou Boleto", { width: pagW, size: dataSize }),
      tcell(brl(calc.zemo.total), { width: valorW, size: dataSize }),
      ...calc.zemo.parcelas.map((v) => tcell(brl(v), { width: parcelaW, size: dataSize })),
    ],
  });
  return new Table({ width: { size: tableWidth, type: WidthType.DXA }, columnWidths, rows: [header, row] });
}

function assinatura(label: string, nome: string) {
  return new Paragraph({
    spacing: { before: 360, after: 0 },
    children: [new TextRun({ text: "_____________________________________________________", break: 0 })],
  });
}
const assinaturaLabel = (label: string) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: label, bold: true, size: 18 })] });

// ─── Texto jurídico fixo (cláusulas 2.2 a 8) ───────────────────────────────────
const CLAUSULAS_FIXAS: string[] = [
  "2.2. O(a,s) CONTRATANTE(S) tem ciência, desde já, que os pagamentos devem, obrigatoriamente, ser realizados exclusivamente na forma prevista no item 2. supra e, caso venham a ser realizados de outra maneira, serão considerados não efetivados, ficando os CONTRATADOS assim como os demais prestadores de serviço autônomos (corretores), autorizados a cobrar os valores não quitados com todos os acréscimos moratórios cabíveis, dispostos no item 3 infra.",
  "3. Sobre qualquer parcela não paga, será aplicada correção monetária utilizando-se a variação positiva do Índice de Preços ao Consumidor Amplo - IPCA, publicado pelo Instituto Brasileiro de Geografia e Estatística (IBGE), além de juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento), a partir do inadimplemento da obrigação até o dia do seu efetivo pagamento.",
  "4. Eventual inadimplemento por parte do(a,s) CONTRATANTE(S) quanto ao pagamento de qualquer uma das parcelas da comissão de corretagem informadas na cláusula 2 supra, acarretará o vencimento integral e antecipado de todas as demais previstas em tal cláusula, considerando-se o presente instrumento, desde logo, como título executivo extrajudicial, nos termos do artigo 784, III do Código de Processo Civil, sujeitando o(a,s) CONTRATANTE(S) inadimplente a ser inscrito nos Órgãos de Proteção ao Crédito.",
  "5. Os serviços prestados pelos CONTRATADOS, em conformidade com o presente instrumento serão objeto da emissão dos respectivos Recibos de Pagamento a Autônomo e/ou das Notas Fiscais de Serviços de forma individual por cada um dos prestadores de serviço e credores da comissão referidos no item 2. do presente instrumento.",
  "6. O(a,s) CONTRATANTE(S) reconhece(m) que uma vez ocorrida a efetiva intermediação imobiliária, o montante relativo à comissão de corretagem é de responsabilidade dele(a,s), CONTRATANTE(S), e ainda que o imóvel aqui identificado não venha a ser efetivamente adquirido por ele, a comissão de corretagem é devida e não será, em qualquer hipótese, devolvida pelo(s) CONTRATADO(S) e/ou prestadores de serviço autônomos (corretores) que co-participaram do serviço de intermediação em conformidade com o artigo 725 e seguintes do Código Civil, nem tampouco poderá ser a qualquer momento questionada pelo(a,s) CONTRATANTE(S).",
  "7. Em atos pré-contratuais, na ocasião da celebração deste instrumento e durante o cumprimento das obrigações aqui determinadas, o(s) CONTRATADO(S) coletaram/coletarão do(a, os, as) CONTRATANTE(S) informações que são capazes de identificá-lo(s) ou torná-lo(s) identificável(s) (os \u201CDados Pessoais\u201D) e, para execução deste Contrato, os CONTRATADO(S) realizarão atividades diversas com os referidos (o \u201CTratamento\u201D), sempre observando, de forma rigorosa, a legislação aplicável à tal atividade, incluindo, mas não se limitando, a Lei nº 13.709/2018 (\u201CLei Geral de Proteção de Dados Pessoais\u201D ou \u201CLGPD\u201D).",
  "7.1. O Tratamento dos Dados Pessoais será realizado pelos CONTRATADO(S) ou por quem este(s) indicar(em), especialmente para: (a) viabilizar a execução deste Contrato; (b) Cumprir obrigações legais ou regulatórias; e (c) Exercer seus direitos em eventuais processos judiciais, administrativos ou arbitrais.",
  "7.1.1. Caso necessário o compartilhamento de Dados Pessoais para cumprimento das finalidades acima especificadas, o(s) CONTRATADO(S) celebrarão com o terceiro um contrato escrito para garantir que todas as obrigações e responsabilidades relacionadas à proteção dos Dados Pessoais de cada parte envolvida estejam devidamente estabelecidas.",
  "7.2. Os Dados Pessoais e os registros do Tratamento são armazenados em ambiente seguro e controlado, podendo estar em servidores do(s) CONTRATADO(S) localizados no Brasil, bem como em ambiente de uso de recursos ou servidores na nuvem (cloud computing), o que pode exigir transferência e/ou processamento Dados Pessoais fora do Brasil.",
  "7.3. Caso os Dados Pessoais sejam transferidos e/ou processados fora do território brasileiro, nos termos da Cláusula 8.2 supra, o(s) CONTRATADO(S) tomarão as medidas cabíveis para assegurar que as atividades sejam realizadas conformidade com a legislação aplicável, mantendo um nível de conformidade semelhante ou mais rigoroso que o previsto na legislação brasileira.",
  "7.4. Os Dados Pessoais somente serão armazenados pelo(s) CONTRATADO(S) pelo tempo que for necessário para cumprir com as finalidades para as quais foram coletados ou para cumprimento de quaisquer obrigações legais, regulatórias ou para preservação de direitos.",
  "7.5. Durante o período em que Tratarem os Dados Pessoais ou os mantiverem em seus arquivos, o(s) CONTRATADO(S) se compromete(m) a aplicar medidas técnicas e organizacionais de segurança da informação e governança corporativa aptas a proteger os Dados Pessoais tratados no âmbito do Contrato.",
  "7.6. Findo o prazo de manutenção e a necessidade legal, os Dados Pessoais serão excluídos com uso de métodos de descarte seguro ou utilizados de forma anonimizada para fins estatísticos.",
  "7.7. O(s) CONTRATADOS respeitam os direitos que o(s) CONTRATANTE(S) possuem na qualidade de titulares dos Dados Pessoais e disponibilizam o canal para esclarecer dúvidas sobre as atividades de Tratamento e garantir que o(s) CONTRATANTE(S) possam exercer seus direitos, tais como, mas não limitados a revogar consentimento, solicitar correção, anonimização, bloqueio ou portabilidade.",
  "7.8. O(s) CONTRATANTE(S) compreende(m) que é(são) responsável(is) pela precisão, veracidade e atualização dos Dados Pessoais que fornecer ao(s) CONTRATADO(S), desta forma, deve(m) contatar estes últimos, para atualizá-las em caso de alterações.",
  "8. As partes elegem, com renúncia a qualquer outro, o foro Central da Comarca de Porto Alegre para conhecer e dirimir quaisquer questões relacionadas com o presente instrumento, renunciando a qualquer outro, por mais privilegiado que seja ou se torne.",
  "As Partes concordam em assinar o presente instrumento, por: (i) meio de plataformas de assinatura digital, admitindo expressamente tal meio como válido, nos termos do permissivo contido no § 2º do artigo 10 da Medida Provisória nº 2.200-2/2001. Neste caso, fica dispensada a obrigatoriedade do uso de assinaturas, das Partes e/ou das testemunhas, por meio de certificados emitidos pela ICP-Brasil, nos mesmos termos do dispositivo mencionado no item acima, concordando as Partes que qualquer meio idôneo de certificação digital de autoria e integridade deste Instrumento será válido com comprovação de suas assinaturas e, na impossibilidade da assinatura neste formato digital; (ii) em 02 (duas) vias de igual teor e para um só fim, na presença de duas testemunhas abaixo qualificadas.",
];

function qualificacaoContratante(c: Body["comprador"]): TextRun[] {
  const runs: TextRun[] = [];
  runs.push(new TextRun("Pelo presente instrumento particular de intermediação imobiliária, de um lado, como "));
  runs.push(new TextRun({ text: "CONTRATANTE(S)", bold: true }));
  runs.push(new TextRun(": "));
  if (c.tipoPessoa === "PJ") {
    runs.push(new TextRun({ text: `${c.razaoSocial.toUpperCase()}`, bold: true }));
    runs.push(new TextRun(`, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${c.cnpj}, neste ato representada por seu Sócio-Administrador ${c.socioAdmin.toUpperCase()}, inscrito no CPF sob o nº ${c.cpf}, portador do RG nº ${c.rg}, telefone ${c.telefone}, e-mail ${c.email}, residente e domiciliado na ${c.endereco}.`));
  } else {
    const generoTxt = c.genero === "feminino" ? "brasileira" : "brasileiro";
    runs.push(new TextRun({ text: `${c.nomeCompleto.toUpperCase()}`, bold: true }));
    runs.push(new TextRun(`, ${generoTxt}, ${c.profissao}, ${c.estadoCivil}${c.estadoCivil === "casado(a)" && c.regimeBens ? ` sob o regime de ${c.regimeBens}` : ""}, inscrito(a) no CPF sob o nº ${c.cpf}, portador(a) do RG nº ${c.rg}, telefone ${c.telefone}, e-mail ${c.email}, residente e domiciliado(a) na ${c.endereco}.`));
  }
  return runs;
}

function qualificacaoContratados(corretores: Body["corretores"]): TextRun[] {
  const runs: TextRun[] = [];
  runs.push(new TextRun("De outro lado, como "));
  runs.push(new TextRun({ text: "CONTRATADOS", bold: true }));
  runs.push(new TextRun(", "));
  corretores.forEach((c) => {
    runs.push(new TextRun({ text: `${c.nome.toUpperCase()}`, bold: true }));
    const rgTrecho = c.rg && c.rg.trim() ? `RG: ${c.rg.trim()}, ` : "";
    runs.push(new TextRun(`, inscrito(a) no CPF: ${c.cpf}, ${rgTrecho}endereço eletrônico: ${c.email}, `));
  });
  runs.push(new TextRun({ text: GABRIELLE.nome, bold: true }));
  runs.push(new TextRun(`, inscrita no CPF: ${GABRIELLE.cpf}, endereço eletrônico: ${GABRIELLE.email}, residente e domiciliada na ${GABRIELLE.endereco} e `));
  runs.push(new TextRun({ text: "UHOME NEGÓCIOS IMOBILIÁRIOS", bold: true }));
  runs.push(new TextRun(`, inscrito no CNPJ: ${UHOME.cnpj}, CRECI: ${UHOME.creci}, localizada na ${UHOME.endereco}, neste ato representado por ${LUCAS.nome}, inscrito no CPF: ${LUCAS.cpf}, RG: ${LUCAS.rg}, CRECI: ${LUCAS.creci}, e-mail: ${LUCAS.email}, doravante denominados simplesmente `));
  runs.push(new TextRun({ text: "CONTRATADOS", bold: true }));
  runs.push(new TextRun("."));
  return runs;
}

async function montarDoc(b: Body): Promise<Document> {
  const calc = calcular(b);
  const children: (Paragraph | Table)[] = [];

  children.push(cabecalho());
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: "INSTRUMENTO PARTICULAR DE INTERMEDIAÇÃO IMOBILIÁRIA", bold: true, underline: {} })],
  }));

  children.push(runsParagraph(qualificacaoContratante(b.comprador)));
  children.push(runsParagraph(qualificacaoContratados(b.corretores)));
  children.push(NORMAL("Isoladamente denominadas \u201CParte\u201D e, em conjunto \u201CPartes\u201D, têm entre si, justo e acertado o quanto abaixo segue."));

  children.push(NORMAL("1. O(a,s) CONTRATANTE(S), por meio do presente instrumento, contrata(m) os CONTRATADOS os serviços de intermediação imobiliária, para aquisição do imóvel abaixo indicado, assumindo ele(a,es,as), CONTRATANTE(S), o compromisso de pagar aos CONTRATADOS, os valores indicados no presente instrumento."));
  children.push(NORMAL(`EMPREENDIMENTO: ${b.imovel.empreendimento.toUpperCase()}`, { bold: true }));
  children.push(NORMAL(`UNIDADE: ${b.imovel.unidade}`, { bold: true }));
  children.push(NORMAL(`VGV: ${brl(b.imovel.vgv)}`, { bold: true }));

  children.push(runsParagraph([
    new TextRun("2. O valor total devido pelo(a,s) "),
    new TextRun({ text: "CONTRATANTE(S)", bold: true }),
    new TextRun(" a título de comissão de corretagem é de "),
    new TextRun({ text: brl(b.comissao.valorTotal), bold: true }),
    new TextRun(" a serem pagos da forma descrita nos respectivos vencimentos, que segue no quadro abaixo:"),
  ]));
  children.push(tabelaComissao(calc, b.comissao.parcelas));

  children.push(new Paragraph({ spacing: { before: 200, after: 120 }, children: [new TextRun({ text: "2.1 - Divisão de pagamento:", bold: true })] }));
  children.push(tabelaZemo(calc, b.comissao.parcelas));
  children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));

  CLAUSULAS_FIXAS.forEach((t) => children.push(NORMAL(t)));

  children.push(new Paragraph({ spacing: { before: 240, after: 240 }, children: [new TextRun(`Porto Alegre, ${dataExtenso(b.dataContrato)}.`)] }));

  // Assinaturas
  const compradorNome = b.comprador.tipoPessoa === "PJ"
    ? `${b.comprador.razaoSocial.toUpperCase()} / ${b.comprador.socioAdmin.toUpperCase()}`
    : b.comprador.nomeCompleto.toUpperCase();
  children.push(assinatura("", ""));
  children.push(assinaturaLabel(`CONTRATANTE: ${compradorNome}`));
  b.corretores.forEach((c) => {
    children.push(assinatura("", ""));
    children.push(assinaturaLabel(`CORRETOR: ${c.nome.toUpperCase()}`));
  });
  children.push(assinatura("", ""));
  children.push(assinaturaLabel("DIRETORIA: GABRIELLE RODRIGUES"));
  children.push(assinatura("", ""));
  children.push(assinaturaLabel("IMOBILIÁRIA UHOME NEGÓCIOS IMOBILIÁRIOS"));

  children.push(new Paragraph({ spacing: { before: 240, after: 120 }, children: [new TextRun({ text: "Testemunhas:", bold: true })] }));
  children.push(assinatura("", ""));
  children.push(new Paragraph({ children: [new TextRun(`01. Nome: ${TEST1.nome} — E-mail: ${TEST1.email}`)] }));
  children.push(assinatura("", ""));
  children.push(new Paragraph({ children: [new TextRun(`02. Nome: ${TEST2.nome} — E-mail: ${TEST2.email}`)] }));

  return new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: { page: { margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } },
      children,
    }],
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const [{ data: isAdmin }, { data: isGestor }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "gestor" }),
    ]);
    if (!isAdmin && !isGestor) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores e gestores." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = parsed.data;

    const doc = await montarDoc(body);
    const buffer = await Packer.toBuffer(doc);
    const base64 = bufferToBase64(buffer);

    const nomeRef = body.comprador.tipoPessoa === "PJ" ? body.comprador.razaoSocial : body.comprador.nomeCompleto;
    const filename = `intermediacao_${slug(nomeParaArquivo(body.comprador.tipoPessoa, nomeRef))}_${slug(body.imovel.empreendimento)}_${slug(body.imovel.unidade)}_UHome.docx`;

    return new Response(JSON.stringify({ filename, base64 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar documento";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
