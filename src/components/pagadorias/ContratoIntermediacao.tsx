import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Credor {
  credor_nome: string;
  credor_tipo: string;
  percentual: number;
  valor: number;
}

interface Parcela {
  numero: number;
  data: string;
  valor: number;
}

interface ContractData {
  cliente_nome: string;
  cliente_cpf: string;
  cliente_telefone: string;
  cliente_email: string;
  cliente_endereco: string;
  cliente_estado_civil?: string;
  compradores?: { nome: string; cpf: string; rg: string; nacionalidade: string; estado_civil: string; telefone: string; email: string; endereco: string; cidade: string; estado: string }[];
  empreendimento: string;
  unidade: string;
  vgv: number;
  comissao_pct: number;
  comissao_total: number;
  data_venda: string;
  credores: Credor[];
  parcelas: Parcela[];
  corretor_nome: string;
  corretor_cpf: string;
  corretor_creci: string;
  corretor_rg?: string;
  corretor_email: string;
  gerente_nome: string;
  gerente_cpf: string;
  gerente_creci: string;
  gerente_rg?: string;
  gerente_email: string;
  data_assinatura: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ContractData;
  onDataChange: (d: ContractData) => void;
  onGenerated: () => void;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function fmtR(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateShort(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

// Inline styles matching the real document (Calibri 11px, justified)
const S = {
  p: { textAlign: "justify" as const, marginBottom: "10px", textIndent: "0", lineHeight: "1.6" },
  pIndent: { textAlign: "justify" as const, marginBottom: "6px", marginLeft: "20px", lineHeight: "1.6" },
  th: { border: "1px solid #000", padding: "4px 8px", textAlign: "center" as const, fontWeight: "bold" as const, fontSize: "9px", background: "#f5f5f5" },
  thLeft: { border: "1px solid #000", padding: "4px 8px", textAlign: "left" as const, fontWeight: "bold" as const, fontSize: "9px", background: "#f5f5f5" },
  td: { border: "1px solid #000", padding: "4px 8px", textAlign: "center" as const, fontSize: "9px" },
  tdLeft: { border: "1px solid #000", padding: "4px 8px", textAlign: "left" as const, fontSize: "9px" },
  tdBold: { border: "1px solid #000", padding: "4px 8px", textAlign: "center" as const, fontSize: "9px", fontWeight: "bold" as const },
};

export default function ContratoIntermediacao({ open, onOpenChange, data, onDataChange, onGenerated }: Props) {
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);

  const parcelas = data.parcelas.length > 0 ? data.parcelas : [{ numero: 1, data: data.data_venda, valor: data.comissao_total }];

  // Separate credores
  const credoresAtivos = data.credores.filter(c => c.percentual > 0);
  const uhomeCredor = credoresAtivos.find(c => c.credor_tipo === "uhome" || c.credor_nome?.toLowerCase().includes("uhome"));
  const agilitasCredores = credoresAtivos.filter(c => c !== uhomeCredor);
  const agilitasTotal = agilitasCredores.reduce((s, c) => s + c.valor, 0);
  const uhomeTotal = uhomeCredor?.valor || 0;

  // Build contratados list from credores (everyone except uhome)
  const contratadosList: { nome: string; cpf: string; creci: string; rg: string; email: string; tipo: string }[] = [];
  
  // Add all non-uhome credores as contratados
  for (const c of credoresAtivos) {
    if (c.credor_tipo === "uhome") continue;
    
    let cpf = "", creci = "", email = "", rg = "", tipo = "Corretor(a)";
    
    if (c.credor_tipo === "corretor") {
      cpf = data.corretor_cpf;
      creci = data.corretor_creci;
      rg = data.corretor_rg || "";
      email = data.corretor_email;
      tipo = "Corretor(a)";
    } else if (c.credor_tipo === "gerente") {
      cpf = data.gerente_cpf;
      creci = data.gerente_creci;
      rg = data.gerente_rg || "";
      email = data.gerente_email;
      tipo = "Corretor(a)";
    }
    
    contratadosList.push({ nome: c.credor_nome, cpf, creci, rg, email, tipo });
  }

  const handleDownload = async () => {
    if (!contractRef.current) return;
    setGenerating(true);
    try {
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;
      
      // Clone content into a detached container to avoid Dialog transform/z-index bugs
      const clone = contractRef.current.cloneNode(true) as HTMLElement;
      const wrapper = document.createElement("div");
      wrapper.style.position = "fixed";
      wrapper.style.left = "-9999px";
      wrapper.style.top = "0";
      wrapper.style.width = "210mm"; // A4 width
      wrapper.style.background = "#fff";
      wrapper.style.zIndex = "-1";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const filename = `Intermediacao_${(data.cliente_nome || "Cliente").replace(/\s+/g, "_")}_${(data.empreendimento || "Empreendimento").replace(/\s+/g, "_")}_${data.unidade || "SN"}.pdf`;
      
      await html2pdf()
        .set({
          margin: [20, 20, 15, 20],
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, allowTaint: true, windowWidth: 794 },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(clone)
        .save();
      
      document.body.removeChild(wrapper);
      onGenerated();
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      console.error("PDF generation error:", e);
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📄 Contrato de Intermediação Imobiliária</DialogTitle>
        </DialogHeader>

        {/* Edit mode */}
        {editing && (
          <div className="space-y-3 border-b pb-4 mb-4">
            <p className="text-sm font-semibold text-muted-foreground">✏️ Editar dados antes de gerar</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Nome do cliente</Label><Input value={data.cliente_nome} onChange={e => onDataChange({ ...data, cliente_nome: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">CPF do cliente</Label><Input value={data.cliente_cpf} onChange={e => onDataChange({ ...data, cliente_cpf: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Estado civil</Label><Input value={data.cliente_estado_civil || ""} onChange={e => onDataChange({ ...data, cliente_estado_civil: e.target.value })} className="h-8 text-sm" placeholder="solteiro(a), casado(a)..." /></div>
              <div><Label className="text-xs">Endereço do cliente</Label><Input value={data.cliente_endereco} onChange={e => onDataChange({ ...data, cliente_endereco: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Telefone do cliente</Label><Input value={data.cliente_telefone} onChange={e => onDataChange({ ...data, cliente_telefone: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">E-mail do cliente</Label><Input value={data.cliente_email} onChange={e => onDataChange({ ...data, cliente_email: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Corretor - Nome</Label><Input value={data.corretor_nome} onChange={e => onDataChange({ ...data, corretor_nome: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Corretor - CPF</Label><Input value={data.corretor_cpf} onChange={e => onDataChange({ ...data, corretor_cpf: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Corretor - CRECI</Label><Input value={data.corretor_creci} onChange={e => onDataChange({ ...data, corretor_creci: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Corretor - E-mail</Label><Input value={data.corretor_email} onChange={e => onDataChange({ ...data, corretor_email: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Gerente - Nome</Label><Input value={data.gerente_nome} onChange={e => onDataChange({ ...data, gerente_nome: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Gerente - CPF</Label><Input value={data.gerente_cpf} onChange={e => onDataChange({ ...data, gerente_cpf: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Gerente - CRECI</Label><Input value={data.gerente_creci} onChange={e => onDataChange({ ...data, gerente_creci: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Gerente - E-mail</Label><Input value={data.gerente_email} onChange={e => onDataChange({ ...data, gerente_email: e.target.value })} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Data de assinatura</Label><Input type="date" value={data.data_assinatura} onChange={e => onDataChange({ ...data, data_assinatura: e.target.value })} className="h-8 text-sm" /></div>
            </div>
            <Button size="sm" onClick={() => setEditing(false)}>Aplicar alterações</Button>
          </div>
        )}

        {/* Contract preview — matches real PDF faithfully */}
        <div
          ref={contractRef}
          style={{
            fontFamily: "Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: "11px",
            lineHeight: "1.6",
            color: "#000",
            background: "#fff",
            padding: "10px",
          }}
        >
          {/* LOGO */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <img src="/logo-uhome.svg" alt="UHome" style={{ height: "55px" }} crossOrigin="anonymous" />
          </div>

          {/* TITLE */}
          <p style={{ textAlign: "center", fontSize: "13px", fontWeight: "bold", marginBottom: "24px", textDecoration: "underline" }}>
            INSTRUMENTO PARTICULAR DE INTERMEDIAÇÃO IMOBILIÁRIA
          </p>

          {/* ── CONTRATANTE(S) ── */}
          <p style={S.p}>
            Pelo presente instrumento particular de intermediação imobiliária, de um lado, como <b>CONTRATANTE(S)</b>:
          </p>
          {(data.compradores && data.compradores.length > 0 ? data.compradores : [
            { nome: data.cliente_nome, cpf: data.cliente_cpf, rg: "", nacionalidade: "", estado_civil: data.cliente_estado_civil || "", telefone: data.cliente_telefone, email: data.cliente_email, endereco: data.cliente_endereco, cidade: "", estado: "" }
          ]).map((c, i, arr) => (
            <p key={i} style={S.p}>
              <b>{c.nome || "_______________"}</b>, {c.nacionalidade || "___________"}, {c.estado_civil || "___________"}, inscrito no CPF/MF sob o nº {c.cpf || "___.___.___-__"}, telefone: {c.telefone || "(__) _____-____"}, e-mail: {c.email || "________________"}, residente e domiciliado na {c.endereco || "________________________________"}{(c as any).bairro ? `, Bairro ${(c as any).bairro}` : ""}{c.cidade ? `, na cidade de ${c.cidade}` : ""}{c.estado ? `/${c.estado}` : ""}{(c as any).cep ? `, CEP: ${(c as any).cep}` : ""}{i < arr.length - 1 ? ";" : "."}
            </p>
          ))}

          {/* ── CONTRATADOS ── */}
          <p style={S.p}>
            De outro lado, como <b>CONTRATADOS</b>:{" "}
            {contratadosList.map((c, i) => {
              // Format varies: with CRECI → "inscrito(a) no CRECI sob o nº X, CPF nº Y, portador do RG nº Z, e-mail: W"
              // Without CRECI → "CPF nº X, e-mail: Y"
              const hasCRECI = !!c.creci;
              return (
                <span key={i}>
                  <b>{c.nome || "_______________"}</b>
                  {hasCRECI ? (
                    <>
                      {`, inscrito(a) no CRECI sob o nº ${c.creci}`}
                      {c.cpf ? `, CPF nº ${c.cpf}` : ""}
                      {c.rg ? `, portador do RG nº ${c.rg}` : ""}
                      {c.email ? `, e-mail: ${c.email}` : ", endereço eletrônico: ________________"}
                    </>
                  ) : (
                    <>
                      {c.cpf ? `, CPF nº ${c.cpf}` : ""}
                      {c.rg ? `, portador do RG nº ${c.rg}` : ""}
                      {c.email ? `, e-mail: ${c.email}` : ", endereço eletrônico: ________________"}
                    </>
                  )}
                  {i < contratadosList.length - 1 ? "; " : "; e "}
                </span>
              );
            })}
            <b>UHOME NEGÓCIOS IMOBILIÁRIOS</b>, pessoa jurídica inscrita no CNPJ sob o nº 37.900.790/0001-71, CRECI nº 25.682-J, com sede na Avenida João Wallig, nº 573, Loja 01, Bairro Passo d'Areia, Porto Alegre/RS, CEP 91340-000, neste ato representada por seu procurador <b>LUCAS SOUTO DE MORAES SARMENTO</b>, inscrito no CPF sob o nº 863.851.860-91, RG nº 9098653034, CRECI nº 58.516, endereço eletrônico: lucas@uhome.imb.br, doravante denominados, em conjunto, simplesmente CONTRATADOS.
          </p>

          <p style={S.p}>
            Isoladamente denominadas <b>"Parte"</b> e, em conjunto, <b>"Partes"</b>, têm entre si justo e contratado o que segue:
          </p>

          {/* ── CLÁUSULA 1 ── */}
          <p style={S.p}>
            <b>1.</b> O(s) CONTRATANTE(S), por meio do presente instrumento, contrata(m) os CONTRATADOS para a prestação de serviços de intermediação imobiliária, com a finalidade de aquisição do imóvel descrito abaixo, assumindo o(s) CONTRATANTE(S) o compromisso de pagar aos CONTRATADOS os valores estabelecidos neste instrumento.
          </p>

          <p style={S.pIndent}>
            <b>EMPREENDIMENTO:</b> {data.empreendimento || "_______________"}
          </p>
          <p style={{ ...S.pIndent, marginBottom: "12px" }}>
            <b>UNIDADE:</b> {data.unidade || "___"}
          </p>

          {/* ── CLÁUSULA 2 ── */}
          <p style={S.p}>
            <b>2.</b> O valor total devido pelo(a,s) CONTRATANTE(S) a título de comissão de corretagem é de <b>{fmtR(data.comissao_total)}</b> a serem pagos da forma descrita nos respectivos vencimentos, que segue em no quadro abaixo:
          </p>

          {/* TABLE — Credores */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <thead>
              <tr>
                <th style={S.thLeft}>Credor</th>
                <th style={S.th}>Valor</th>
                {parcelas.map((p, i) => (
                  <th key={i} style={S.th}>{fmtDateShort(p.data)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {credoresAtivos.map((c, i) => (
                <tr key={i}>
                  <td style={S.tdLeft}>{c.credor_nome || c.credor_tipo}</td>
                  <td style={S.td}>{fmtR(c.valor)}</td>
                  {parcelas.map((p, j) => {
                    const parcelaVal = data.comissao_total > 0 ? (c.valor / data.comissao_total) * p.valor : 0;
                    return <td key={j} style={S.td}>{fmtR(parcelaVal)}</td>;
                  })}
                </tr>
              ))}
              <tr>
                <td style={{ ...S.tdLeft, fontWeight: "bold" }}>Total</td>
                <td style={S.tdBold}>{fmtR(data.comissao_total)}</td>
                {parcelas.map((p, j) => (
                  <td key={j} style={S.tdBold}>{fmtR(p.valor)}</td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* ── 2.1 — Divisão de pagamento ── */}
          <p style={{ ...S.p, marginBottom: "6px" }}>
            <b>2.1</b> - Divisão de pagamento:
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <thead>
              <tr>
                <th style={S.thLeft}>Credor</th>
                <th style={S.th}>Pagamento</th>
                <th style={S.th}>Valor total</th>
                {parcelas.map((p, i) => (
                  <th key={i} style={S.th}>{fmtDateShort(p.data)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={S.tdLeft}>Agilitas</td>
                <td style={S.td}>Boleto</td>
                <td style={S.td}>{fmtR(agilitasTotal)}</td>
                {parcelas.map((p, j) => {
                  const parcelaVal = data.comissao_total > 0 ? (agilitasTotal / data.comissao_total) * p.valor : 0;
                  return <td key={j} style={S.td}>{fmtR(parcelaVal)}</td>;
                })}
              </tr>
              <tr>
                <td style={S.tdLeft}>UHome</td>
                <td style={S.td}>Pix ou Boleto</td>
                <td style={S.td}>{fmtR(uhomeTotal)}</td>
                {parcelas.map((p, j) => {
                  const parcelaVal = data.comissao_total > 0 ? (uhomeTotal / data.comissao_total) * p.valor : 0;
                  return <td key={j} style={S.td}>{fmtR(parcelaVal)}</td>;
                })}
              </tr>
            </tbody>
          </table>

          {/* ── 2.2 ── */}
          <p style={S.p}>
            <b>2.2.</b> O(a,s) CONTRATANTE(S) tem ciência, desde já, que os pagamentos devem, obrigatoriamente, ser realizados exclusivamente na forma prevista no item 2. supra e, caso venham a ser realizados de outra maneira, serão considerados não efetivados, ficando os CONTRATADOS assim como os demais prestadores de serviço autônomos (corretores), autorizados a cobrar os valores não quitados com todos os acréscimos moratórios cabíveis, dispostos no item 3 infra.
          </p>

          {/* ── 3 ── */}
          <p style={S.p}>
            <b>3.</b> Sobre qualquer parcela não paga, será aplicada correção monetária utilizando-se a variação positiva do Índice de Preços ao Consumidor Amplo - IPCA, publicado pelo Instituto Brasileiro de Geografia e Estatística (IBGE), além de juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento), a partir do inadimplemento da obrigação até o dia do seu efetivo pagamento.
          </p>

          {/* ── 4 ── */}
          <p style={S.p}>
            <b>4.</b> Eventual inadimplemento por parte do(a,s) CONTRATANTE(S) quanto ao pagamento de qualquer uma das parcelas da comissão de corretagem informadas na cláusula 2 supra, acarretará o vencimento integral e antecipado de todas as demais previstas em tal cláusula, considerando-se o presente instrumento, desde logo, como título executivo extrajudicial, nos termos do artigo 784, III do Código de Processo Civil, sujeitando o(a,s) CONTRATANTE(S) inadimplente a ser inscrito nos Órgãos de Proteção ao Crédito.
          </p>

          {/* ── 5 ── */}
          <p style={S.p}>
            <b>5.</b> Os serviços prestados pelos CONTRATADOS, em conformidade com o presente instrumento serão objeto da emissão dos respectivos Recibos de Pagamento a Autônomo e/ou das Notas Fiscais de Serviços de forma individual por cada um dos prestadores de serviço e credores da comissão referidos no item 2. do presente instrumento.
          </p>

          {/* ── 6 ── */}
          <p style={S.p}>
            <b>6.</b> O(a,s) CONTRATANTE(S) reconhece(m) que uma vez ocorrida a efetiva intermediação imobiliária, o montante relativo à comissão de corretagem é de responsabilidade dele(a,s), CONTRATANTE(S), e ainda que o imóvel aqui identificado não venha a ser efetivamente adquirido por ele, a comissão de corretagem é devida e não será, em qualquer hipótese, devolvida pelo(s) CONTRATADO(S) e/ou prestadores de serviço autônomos (corretores) que co-participaram do serviço de intermediação em conformidade com o artigo 725 e seguintes do Código Civil, nem tampouco poderá ser a qualquer momento questionada pelo(a,s) CONTRATANTE(S).
          </p>

          {/* ── 7 — LGPD (fiel ao documento real) ── */}
          <p style={S.p}>
            <b>7.</b> Em atos pré-contratuais, na ocasião da celebração deste instrumento e durante o cumprimento das obrigações aqui determinadas, o(s) CONTRATADO(S) coletaram/coletarão do(a, os, as) CONTRATANTE(S) informações que são capazes de identificá-lo(s) ou torná-lo(s) identificável(s) (os "Dados Pessoais") e, para execução deste Contrato, os CONTRATADO(S) realizarão atividades diversas com os referidos (o "Tratamento"), sempre observando, de forma rigorosa, a legislação aplicável à tal atividade, incluindo, mas não se limitando, a Lei nº 13.709/2018 ("Lei Geral de Proteção de Dados Pessoais" ou "LGPD").
          </p>

          <p style={S.p}>
            <b>7.1.</b> O Tratamento dos Dados Pessoais será realizado pelos CONTRATADO(S) ou por quem este(s) indicar(em), especialmente para: (a) viabilizar a execução deste Contrato; (b) Cumprir obrigações legais ou regulatórias; e (c) Exercer seus direitos em eventuais processos judiciais, administrativos ou arbitrais.
          </p>

          <p style={S.p}>
            <b>7.1.1.</b> Caso necessário o compartilhamento de Dados Pessoais para cumprimento das finalidades acima especificadas, o(s) CONTRATADO(S) celebrarão com o terceiro um contrato escrito para garantir que todas as obrigações e responsabilidades relacionadas à proteção dos Dados Pessoais de cada parte envolvida estejam devidamente estabelecidas.
          </p>

          <p style={S.p}>
            <b>7.2.</b> Os Dados Pessoais e os registros do Tratamento são armazenados em ambiente seguro e controlado, podendo estar em servidores do(s) CONTRATADO(S) localizados no Brasil, bem como em ambiente de uso de recursos ou servidores na nuvem (cloud computing), o que pode exigir transferência e/ou processamento Dados Pessoais fora do Brasil.
          </p>

          <p style={S.p}>
            <b>7.3.</b> Caso os Dados Pessoais sejam transferidos e/ou processados fora do território brasileiro, nos termos da Cláusula 8.2 supra, o(s) CONTRATADO(S) tomarão as medidas cabíveis para assegurar que as atividades sejam realizadas em conformidade com a legislação aplicável, mantendo um nível de conformidade semelhante ou mais rigoroso que o previsto na legislação brasileira.
          </p>

          <p style={S.p}>
            <b>7.4.</b> Os Dados Pessoais somente serão armazenados pelo(s) CONTRATADO(S) pelo tempo que for necessário para cumprir com as finalidades para as quais foram coletados ou para cumprimento de quaisquer obrigações legais, regulatórias ou para preservação de direitos.
          </p>

          <p style={S.p}>
            <b>7.5.</b> Durante o período em que Tratarem os Dados Pessoais ou os mantiverem em seus arquivos, o(s) CONTRATADO(S) se compromete(m) a aplicar medidas técnicas e organizacionais de segurança da informação e governança corporativa aptas a proteger os Dados Pessoais tratados no âmbito do Contrato.
          </p>

          <p style={S.p}>
            <b>7.6.</b> Findo o prazo de manutenção e a necessidade legal, os Dados Pessoais serão excluídos com uso de métodos de descarte seguro ou utilizados de forma anonimizada para fins estatísticos.
          </p>

          <p style={S.p}>
            <b>7.7.</b> O(s) CONTRATADOS respeitam os direitos que o(s) CONTRATANTE(S) possuem na qualidade de titulares dos Dados Pessoais e disponibilizam o canal para esclarecer dúvidas sobre as atividades de Tratamento e garantir que o(s) CONTRATANTE(S) possam exercer seus direitos, tais como, mas não limitados a revogar consentimento, solicitar correção, anonimização, bloqueio ou portabilidade.
          </p>

          <p style={S.p}>
            <b>7.8.</b> O(s) CONTRATANTE(S) compreende(m) que é(são) responsável(is) pela precisão, veracidade e atualização dos Dados Pessoais que fornecer ao(s) CONTRATADO(S), desta forma, deve(m) contatar estes últimos, para atualizá-las em caso de alterações.
          </p>

          {/* ── 8 ── */}
          <p style={S.p}>
            <b>8.</b> As partes elegem, com renúncia a qualquer outro, o foro Central da Comarca de Porto Alegre para conhecer e dirimir quaisquer questões relacionadas com o presente instrumento, renunciando a qualquer outro, por mais privilegiado que seja ou se torne.
          </p>

          {/* Assinatura digital */}
          <p style={S.p}>
            As Partes concordam em assinar o presente instrumento, por: (i) meio de plataformas de assinatura digital, admitindo expressamente tal meio como válido, nos termos do permissivo contido no § 2º do artigo 10 da Medida Provisória nº 2.200-2/2001. Neste caso, fica dispensada a obrigatoriedade do uso de assinaturas, das Partes e/ou das testemunhas, por meio de certificados emitidos pela ICP-Brasil, nos mesmos termos do dispositivo mencionado no item acima, concordando as Partes que qualquer meio idôneo de certificação digital de autoria e integridade deste Instrumento será válido com comprovação de suas assinaturas e, na impossibilidade da assinatura neste formato digital; (ii) em 02 (duas) vias de igual teor e para um só fim, na presença de duas testemunhas abaixo qualificadas.
          </p>

          {/* PAGE BREAK before signatures */}
          <div style={{ pageBreakBefore: "always" }} />

          {/* DATE */}
          <p style={{ textAlign: "center", marginTop: "30px", marginBottom: "50px" }}>
            Porto Alegre, {formatDate(data.data_assinatura)}.
          </p>

          {/* ── ASSINATURAS ── */}
          <div style={{ marginTop: "20px" }}>
            {/* CONTRATANTE(S) */}
            {(data.compradores && data.compradores.length > 0 ? data.compradores : [
              { nome: data.cliente_nome }
            ]).map((c, i) => (
              <div key={`contratante-${i}`}>
                <div style={{ borderTop: "1px solid #000", width: "70%", margin: "40px auto 5px auto" }} />
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "0px" }}>
                  <b>CONTRATANTE:</b>
                </p>
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
                  {(c as any).nome || "_______________"}
                </p>
              </div>
            ))}

            {/* CONTRATADOS — each creditor gets a signature line */}
            {contratadosList.map((c, i) => (
              <div key={`contratado-${i}`}>
                <div style={{ borderTop: "1px solid #000", width: "70%", margin: "40px auto 5px auto" }} />
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "0px" }}>
                  <b>CONTRATADO:</b>
                </p>
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "0px" }}>
                  <b>CORRETOR{c.tipo === "Corretora" ? "A" : ""}:</b>
                </p>
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
                  {c.nome}
                </p>
              </div>
            ))}

            {/* UHOME / IMOBILIÁRIA */}
            <div style={{ borderTop: "1px solid #000", width: "70%", margin: "40px auto 5px auto" }} />
            <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "0px" }}>
              <b>CONTRATADO:</b>
            </p>
            <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "0px" }}>
              <b>IMOBILIÁRIA:</b>
            </p>
            <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
              UHOME NEGÓCIOS IMOBILIÁRIOS
            </p>
          </div>

          {/* ── TESTEMUNHAS ── */}
          <div style={{ marginTop: "50px" }}>
            <p style={{ marginBottom: "8px", fontWeight: "bold" }}>Testemunhas:</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ width: "50%", verticalAlign: "top", paddingRight: "20px" }}>
                    <div style={{ borderTop: "1px solid #000", marginTop: "30px", marginBottom: "5px" }} />
                    <p style={{ fontSize: "10px" }}>01. ___________________________</p>
                    <p style={{ fontSize: "10px" }}>Nome: Ana Paula Silveira</p>
                    <p style={{ fontSize: "10px" }}>E-mail: anapsilveiram@gmail.com</p>
                  </td>
                  <td style={{ width: "50%", verticalAlign: "top", paddingLeft: "20px" }}>
                    <div style={{ borderTop: "1px solid #000", marginTop: "30px", marginBottom: "5px" }} />
                    <p style={{ fontSize: "10px" }}>02. ___________________________</p>
                    <p style={{ fontSize: "10px" }}>Nome: Bruno Schuler</p>
                    <p style={{ fontSize: "10px" }}>E-mail: bruno@uhome.imb.br</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            <Pencil className="h-4 w-4 mr-1" /> {editing ? "Fechar edição" : "Editar dados"}
          </Button>
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Baixar PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
