import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";
import html2pdf from "html2pdf.js";

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
  corretor_email: string;
  gerente_nome: string;
  gerente_cpf: string;
  gerente_creci: string;
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

// Common inline styles
const S = {
  p: { textAlign: "justify" as const, marginBottom: "12px", textIndent: "0" },
  pSmall: { textAlign: "justify" as const, marginBottom: "6px" },
  th: { border: "1px solid #000", padding: "4px 6px", textAlign: "center" as const, fontWeight: "bold" as const, fontSize: "9px", background: "#f5f5f5" },
  thLeft: { border: "1px solid #000", padding: "4px 6px", textAlign: "left" as const, fontWeight: "bold" as const, fontSize: "9px", background: "#f5f5f5" },
  td: { border: "1px solid #000", padding: "4px 6px", textAlign: "center" as const, fontSize: "9px" },
  tdLeft: { border: "1px solid #000", padding: "4px 6px", textAlign: "left" as const, fontSize: "9px" },
  tdBold: { border: "1px solid #000", padding: "4px 6px", textAlign: "center" as const, fontSize: "9px", fontWeight: "bold" as const },
};

export default function ContratoIntermediacao({ open, onOpenChange, data, onDataChange, onGenerated }: Props) {
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const contractRef = useRef<HTMLDivElement>(null);

  const parcelas = data.parcelas.length > 0 ? data.parcelas : [{ numero: 1, data: data.data_venda, valor: data.comissao_total }];

  // Separate credores: UHome vs Agilitas (everyone else)
  const credoresAtivos = data.credores.filter(c => c.percentual > 0);
  const uhomeCredor = credoresAtivos.find(c => c.credor_tipo === "imobiliaria" || c.credor_nome?.toLowerCase().includes("uhome"));
  const agilitasCredores = credoresAtivos.filter(c => c !== uhomeCredor);
  const agilitasTotal = agilitasCredores.reduce((s, c) => s + c.valor, 0);
  const uhomeTotal = uhomeCredor?.valor || 0;

  const handleDownload = async () => {
    if (!contractRef.current) return;
    setGenerating(true);
    try {
      const element = contractRef.current;
      await html2pdf()
        .set({
          margin: [25, 25, 20, 25],
          filename: `Intermediacao_${data.cliente_nome.replace(/\s+/g, "_")}_${data.empreendimento.replace(/\s+/g, "_")}_${data.unidade || "SN"}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
          pagebreak: { mode: ["css", "legacy"] },
        })
        .from(element)
        .save();
      onGenerated();
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const contratados = [] as { nome: string; cpf: string; creci: string; email: string; tipo: string }[];
  if (data.corretor_nome) contratados.push({ nome: data.corretor_nome, cpf: data.corretor_cpf, creci: data.corretor_creci, email: data.corretor_email, tipo: "Corretor(a)" });
  if (data.gerente_nome) contratados.push({ nome: data.gerente_nome, cpf: data.gerente_cpf, creci: data.gerente_creci, email: data.gerente_email, tipo: "Gerente/Corretor(a)" });

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

        {/* Contract preview */}
        <div
          ref={contractRef}
          style={{
            fontFamily: "Calibri, 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "#000",
            background: "#fff",
            padding: "10px",
          }}
        >
          {/* LOGO */}
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <img src="/logo-uhome.svg" alt="UHome Negócios Imobiliários" style={{ height: "55px" }} crossOrigin="anonymous" />
          </div>

          {/* TITLE */}
          <p style={{ textAlign: "center", fontSize: "13px", fontWeight: "bold", marginBottom: "24px", textDecoration: "underline" }}>
            INSTRUMENTO PARTICULAR DE INTERMEDIAÇÃO IMOBILIÁRIA
          </p>

          {/* CONTRATANTE */}
          <p style={S.p}>
            Pelo presente instrumento particular de intermediação imobiliária, de um lado, como <b>CONTRATANTE(S)</b>:
          </p>
          <p style={S.p}>
            <b>{data.cliente_nome || "_______________"}</b>, {data.cliente_estado_civil || "___________"}, inscrito no CPF/MF sob o nº {data.cliente_cpf || "___.___.___-__"}, telefone: {data.cliente_telefone || "(__) _____-____"}, e-mail: {data.cliente_email || "________________"}, residente e domiciliado na {data.cliente_endereco || "________________________________"}.
          </p>

          {/* CONTRATADOS */}
          <p style={S.p}>
            De outro lado, como <b>CONTRATADOS</b>:{" "}
            {contratados.map((c, i) => (
              <span key={i}>
                <b>{c.nome}</b>, inscrito no CPF sob o nº {c.cpf || "___.___.___-__"}, CRECI nº {c.creci || "______"}, endereço eletrônico: {c.email || "________________"}{i < contratados.length - 1 ? "; " : "; e "}
              </span>
            ))}
            <b>UHOME NEGÓCIOS IMOBILIÁRIOS</b>, pessoa jurídica inscrita no CNPJ sob o nº 37.900.790/0001-71, CRECI nº 25.682-J, com sede na Avenida João Wallig, nº 573, Loja 01, Bairro Passo d'Areia, Porto Alegre/RS, CEP 91340-000, neste ato representada por seu procurador <b>LUCAS SOUTO DE MORAES SARMENTO</b>, inscrito no CPF sob o nº 863.851.860-91, RG nº 9098653034, CRECI nº 58.516, endereço eletrônico: lucas@uhome.imb.br, doravante denominados, em conjunto, simplesmente CONTRATADOS.
          </p>

          <p style={S.p}>
            Isoladamente denominadas <b>"Parte"</b> e, em conjunto, <b>"Partes"</b>, têm entre si justo e contratado o que segue:
          </p>

          {/* CLAUSULA 1 */}
          <p style={S.p}>
            <b>1.</b> O(s) CONTRATANTE(S), por meio do presente instrumento, contrata(m) os CONTRATADOS para a prestação de serviços de intermediação imobiliária, com a finalidade de aquisição do imóvel descrito abaixo, assumindo o(s) CONTRATANTE(S) o compromisso de pagar aos CONTRATADOS os valores estabelecidos neste instrumento.
          </p>

          <p style={{ ...S.pSmall, marginLeft: "20px" }}>
            <b>EMPREENDIMENTO:</b> {data.empreendimento || "_______________"}
          </p>
          <p style={{ ...S.p, marginLeft: "20px" }}>
            <b>UNIDADE:</b> {data.unidade || "___"}
          </p>

          {/* CLAUSULA 2 */}
          <p style={S.p}>
            <b>2.</b> O valor total devido pelo(a,s) CONTRATANTE(S) a título de comissão de corretagem é de <b>{fmtR(data.comissao_total)}</b> a serem pagos da forma descrita nos respectivos vencimentos, que segue em no quadro abaixo:
          </p>

          {/* TABLE CREDORES */}
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
                    const parcelaVal = (c.valor / data.comissao_total) * p.valor;
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

          {/* 2.1 - Divisão de pagamento */}
          <p style={S.pSmall}>
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

          {/* 2.2 */}
          <p style={S.p}>
            <b>2.2.</b> O(a,s) CONTRATANTE(S) tem ciência, desde já, que os pagamentos devem, obrigatoriamente, ser realizados exclusivamente na forma prevista no item 2. supra e, caso venham a ser realizados de outra maneira, serão considerados não efetivados, ficando os CONTRATADOS assim como os demais prestadores de serviço autônomos (corretores), autorizados a cobrar os valores não quitados com todos os acréscimos moratórios cabíveis, dispostos no item 3 infra.
          </p>

          {/* 3 */}
          <p style={S.p}>
            <b>3.</b> Sobre qualquer parcela não paga, será aplicada correção monetária utilizando-se a variação positiva do Índice de Preços ao Consumidor Amplo - IPCA, publicado pelo Instituto Brasileiro de Geografia e Estatística (IBGE), além de juros de mora de 1% (um por cento) ao mês e multa de 2% (dois por cento), a partir do inadimplemento da obrigação até o dia do seu efetivo pagamento.
          </p>

          {/* 4 */}
          <p style={S.p}>
            <b>4.</b> Eventual inadimplemento por parte do(a,s) CONTRATANTE(S) quanto ao pagamento de qualquer uma das parcelas da comissão de corretagem informadas na cláusula 2 supra, acarretará o vencimento integral e antecipado de todas as demais previstas em tal cláusula, considerando-se o presente instrumento, desde logo, como título executivo extrajudicial, nos termos do artigo 784, III do Código de Processo Civil, sujeitando o(a,s) CONTRATANTE(S) inadimplente a ser inscrito nos Órgãos de Proteção ao Crédito.
          </p>

          {/* 5 */}
          <p style={S.p}>
            <b>5.</b> Os serviços prestados pelos CONTRATADOS, em conformidade com o presente instrumento serão objeto da emissão dos respectivos Recibos de Pagamento a Autônomo e/ou das Notas Fiscais de Serviços de forma individual por cada um dos prestadores de serviço e credores da comissão referidos no item 2. do presente instrumento.
          </p>

          {/* 6 */}
          <p style={S.p}>
            <b>6.</b> O(a,s) CONTRATANTE(S) reconhece(m) que uma vez ocorrida a efetiva intermediação imobiliária, o montante relativo à comissão de corretagem é de responsabilidade dele(a,s), CONTRATANTE(S), e ainda que o imóvel aqui identificado não venha a ser efetivamente adquirido por ele, a comissão de corretagem é devida e não será, em qualquer hipótese, devolvida pelo(s) CONTRATADO(S) e/ou prestadores de serviço autônomos (corretores) que co-participaram do serviço de intermediação em conformidade com o artigo 725 e seguintes do Código Civil, nem tampouco poderá ser a qualquer momento questionada pelo(a,s) CONTRATANTE(S).
          </p>

          {/* 7 - LGPD */}
          <p style={S.p}>
            <b>7.</b> O(a,s) CONTRATANTE(S) declara(m) ter ciência e concordar com o tratamento de seus dados pessoais pelos CONTRATADOS, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), conforme as disposições abaixo:
          </p>
          <p style={S.p}>
            <b>7.1.</b> Os dados pessoais coletados serão utilizados exclusivamente para as seguintes finalidades:
          </p>
          <p style={{ ...S.pSmall, marginLeft: "20px" }}>
            <b>7.1.1.</b> Prestação dos serviços de intermediação imobiliária objeto deste contrato, incluindo a comunicação com incorporadoras, construtoras, instituições financeiras e cartórios.
          </p>
          <p style={S.p}>
            <b>7.2.</b> Os dados pessoais poderão ser compartilhados com terceiros estritamente necessários à execução dos serviços, tais como incorporadoras, construtoras, correspondentes bancários, cartórios de registro de imóveis e instituições financeiras, sempre observada a finalidade contratual.
          </p>
          <p style={S.p}>
            <b>7.3.</b> Os CONTRATADOS se comprometem a adotar medidas de segurança técnicas e administrativas aptas a proteger os dados pessoais de acessos não autorizados e de situações acidentais ou ilícitas de destruição, perda, alteração, comunicação ou difusão.
          </p>
          <p style={S.p}>
            <b>7.4.</b> Os dados pessoais serão armazenados pelo período necessário ao cumprimento das finalidades para as quais foram coletados, inclusive para fins de cumprimento de obrigações legais, contratuais, prestação de contas ou requisição de autoridades competentes.
          </p>
          <p style={S.p}>
            <b>7.5.</b> O(a,s) CONTRATANTE(S) poderá(ão), a qualquer tempo, exercer os direitos previstos no artigo 18 da LGPD, mediante solicitação por escrito aos CONTRATADOS, incluindo confirmação da existência de tratamento, acesso aos dados, correção de dados incompletos, inexatos ou desatualizados, e eliminação dos dados pessoais tratados com consentimento, quando aplicável.
          </p>
          <p style={S.p}>
            <b>7.6.</b> O consentimento para o tratamento dos dados pessoais poderá ser revogado a qualquer momento, mediante manifestação expressa do(a,s) CONTRATANTE(S), por meio de comunicação escrita, sem prejuízo da legalidade do tratamento realizado anteriormente.
          </p>
          <p style={S.p}>
            <b>7.7.</b> Para fins de contato e exercício dos direitos relacionados à proteção de dados pessoais, o(a,s) CONTRATANTE(S) poderá(ão) entrar em contato através do endereço eletrônico: lucas@uhome.imb.br.
          </p>
          <p style={S.p}>
            <b>7.8.</b> O(a,s) CONTRATANTE(S) declara(m) ter lido e compreendido integralmente as disposições desta cláusula, manifestando seu livre, informado e inequívoco consentimento para o tratamento de seus dados pessoais nos termos aqui estabelecidos.
          </p>

          {/* 8 */}
          <p style={S.p}>
            <b>8.</b> As partes elegem, com renúncia a qualquer outro, o foro Central da Comarca de Porto Alegre para conhecer e dirimir quaisquer questões relacionadas com o presente instrumento, renunciando a qualquer outro, por mais privilegiado que seja ou se torne.
          </p>

          {/* Assinatura digital */}
          <p style={S.p}>
            As Partes concordam em assinar o presente instrumento, por: (i) meio de plataformas de assinatura digital, sendo certo que as assinaturas eletrônicas produzirão os mesmos efeitos das assinaturas manuscritas, nos termos do artigo 10, §2º, da Medida Provisória 2.200-2/2001, da Lei 14.063/2020 e demais legislação aplicável, incluindo eventual regulação vigente à época; ou (ii) de forma manuscrita, hipótese em que este instrumento será impresso e assinado em tantas vias quantas forem necessárias.
          </p>

          {/* PAGE BREAK before signatures */}
          <div style={{ pageBreakBefore: "always" }} />

          {/* DATE & SIGNATURES */}
          <p style={{ textAlign: "center", marginTop: "30px", marginBottom: "50px" }}>
            Porto Alegre, {formatDate(data.data_assinatura)}.
          </p>

          <div style={{ marginTop: "30px" }}>
            {/* CONTRATANTE */}
            <div style={{ borderTop: "1px solid #000", width: "70%", margin: "50px auto 5px auto" }} />
            <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
              <b>CONTRATANTE:</b> {data.cliente_nome || "_______________"} / CPF: {data.cliente_cpf || "___.___.___-__"}
            </p>

            {/* CONTRATADOS */}
            {contratados.map((c, i) => (
              <div key={i}>
                <div style={{ borderTop: "1px solid #000", width: "70%", margin: "40px auto 5px auto" }} />
                <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
                  <b>CONTRATADO {c.tipo.toUpperCase()}:</b> {c.nome} / CPF: {c.cpf || "___.___.___-__"} · CRECI: {c.creci || "______"}
                </p>
              </div>
            ))}

            {/* UHOME */}
            <div style={{ borderTop: "1px solid #000", width: "70%", margin: "40px auto 5px auto" }} />
            <p style={{ textAlign: "center", fontSize: "10px", marginBottom: "3px" }}>
              <b>CONTRATADO IMOBILIÁRIA:</b> UHOME NEGÓCIOS IMOBILIÁRIOS / CNPJ: 37.900.790/0001-71 · CRECI: 25.682-J
            </p>
          </div>

          {/* TESTEMUNHAS */}
          <div style={{ marginTop: "50px" }}>
            <p style={{ marginBottom: "8px", fontWeight: "bold" }}>TESTEMUNHAS:</p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ width: "45%" }}>
                <div style={{ borderTop: "1px solid #000", marginTop: "30px", marginBottom: "5px" }} />
                <p style={{ fontSize: "10px" }}>01. Ana Paula Silveira — anapsilveiram@gmail.com</p>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ borderTop: "1px solid #000", marginTop: "30px", marginBottom: "5px" }} />
                <p style={{ fontSize: "10px" }}>02. Bruno Schuler — bruno@uhome.imb.br</p>
              </div>
            </div>
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
