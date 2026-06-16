import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, HeadingLevel,
} from "npm:docx@8.5.0";

// Logo Uhome (PNG base64) — gerada de public/images/uhome-logo-128.png
const LOGO_BASE64 = "__LOGO_BASE64__";

// ─── Dados fixos (nunca alterar) ───────────────────────────────────────────────
const UHOME = { cnpj: "37.900.790/0001-71", creci: "25.682J", endereco: "avenida João Wallig, n° 573, loja 01" };
const LUCAS = { nome: "LUCAS SOUTO DE MORAES SARMENTO", cpf: "863.851.860-91", rg: "9098653034", creci: "58516", email: "lucas@uhome.imb.br" };
const GABRIELLE = { nome: "GABRIELLE RODRIGUES", cpf: "032.416.160-37", rg: "3098226875", email: "gabrielle@uhome.imb.br", endereco: "Rua Ariovaldo Pinheiro 177 apto 1201, Passo d'Areia, Porto Alegre, RS" };
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
  if (LOGO_BASE64 && LOGO_BASE64 !== "__LOGO_BASE64__") {
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
const tcell = (text: string, opts: { bold?: boolean; fill?: string } = {}) =>
  new TableCell({
    borders,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: 16 })] })],
  });

function tabelaComissao(calc: ReturnType<typeof calcular>, parcelas: Body["comissao"]["parcelas"]) {
  const header = new TableRow({
    children: [
      tcell("Credor", { bold: true, fill: "EEEEFF" }),
      tcell("Valor", { bold: true, fill: "EEEEFF" }),
      ...parcelas.map((p) => tcell(fmtCurta(p.vencimento), { bold: true, fill: "EEEEFF" })),
    ],
  });
  const rows = calc.credores.map((c) =>
    new TableRow({ children: [tcell(c.nome), tcell(brl(c.total)), ...c.parcelas.map((v) => tcell(brl(v)))] }));
  const totalRow = new TableRow({
    children: [
      tcell("Total", { bold: true, fill: "F4F4F4" }),
      tcell(brl(calc.totalGeral), { bold: true, fill: "F4F4F4" }),
      ...calc.totalLinha.map((v) => tcell(brl(v), { bold: true, fill: "F4F4F4" })),
    ],
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...rows, totalRow] });
}

function tabelaZemo(calc: ReturnType<typeof calcular>, parcelas: Body["comissao"]["parcelas"]) {
  const header = new TableRow({
    children: [
      tcell("Credor", { bold: true, fill: "EEEEFF" }),
      tcell("Pagamento", { bold: true, fill: "EEEEFF" }),
      tcell("Valor total", { bold: true, fill: "EEEEFF" }),
      ...parcelas.map((p) => tcell(fmtCurta(p.vencimento), { bold: true, fill: "EEEEFF" })),
    ],
  });
  const row = new TableRow({
    children: [
      tcell("ZemoBank"), tcell("Pix ou Boleto"), tcell(brl(calc.zemo.total)),
      ...calc.zemo.parcelas.map((v) => tcell(brl(v))),
    ],
  });
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, row] });
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
    runs.push(new TextRun(`, inscrito(a) no CPF: ${c.cpf}, RG: ${c.rg}, endereço eletrônico: ${c.email}, `));
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
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    const nomeRef = body.comprador.tipoPessoa === "PJ" ? body.comprador.razaoSocial : body.comprador.nomeCompleto;
    const filename = `intermediacao_${slug(sobrenome(nomeRef))}_${slug(body.imovel.empreendimento)}_${slug(body.imovel.unidade)}_UHome.docx`;

    return new Response(JSON.stringify({ filename, base64 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar documento";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
