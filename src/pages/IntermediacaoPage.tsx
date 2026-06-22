import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, FileSignature, Loader2, Download, Search } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface CorretorOption {
  user_id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  creci: string | null;
}

interface CorretorForm {
  user_id: string;
  nome: string;
  cpf: string;
  rg: string;
  email: string;
  percentual: string; // %
}

interface Parcela {
  vencimento: string; // yyyy-mm-dd
  valor: string;      // numérico
}

interface Testemunha {
  nome: string;
  email: string;
}

// Testemunha fixa disponível como atalho de preenchimento.
const CAROLINA: Testemunha = { nome: "Carolina de Camargo Madruga", email: "carolina@uhome.com.br" };

// ─── Helpers de cálculo (replicado na edge function) ───────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v: string) => {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDataCurta = (iso: string) => {
  if (!iso) return "--/--/--";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

interface CredorCalc {
  nome: string;
  isUhome: boolean;
  total: number;
  parcelas: number[];
}

function calcularCredores(
  valorTotal: number,
  corretores: { nome: string; pct: number }[],
  pctGabrielle: number,
  pctDiretoria: number,
  parcelas: number[],
): { credores: CredorCalc[]; totalLinha: number[]; zemo: { total: number; parcelas: number[] } } {
  const pctUhome = Math.max(0, 100 - corretores.reduce((s, c) => s + c.pct, 0) - pctGabrielle - pctDiretoria);

  const defs: { nome: string; pct: number; isUhome: boolean }[] = [
    ...corretores.map((c) => ({ nome: c.nome, pct: c.pct, isUhome: false })),
    { nome: "Gabrielle Rodrigues", pct: pctGabrielle, isUhome: false },
    { nome: "Diretoria", pct: pctDiretoria, isUhome: false },
    { nome: "UHome", pct: pctUhome, isUhome: true },
  ];

  const credores: CredorCalc[] = defs.map((d) => {
    const total = round2((d.pct / 100) * valorTotal);
    const ps: number[] = [];
    let acc = 0;
    parcelas.forEach((valorP, i) => {
      if (i === parcelas.length - 1) {
        ps.push(round2(total - acc));
      } else {
        const v = round2((d.pct / 100) * valorP);
        ps.push(v);
        acc = round2(acc + v);
      }
    });
    return { nome: d.nome, isUhome: d.isUhome, total, parcelas: ps };
  });

  const totalLinha = parcelas.map((_, i) =>
    round2(credores.reduce((s, c) => s + c.parcelas[i], 0)),
  );

  // ZemoBank recebe o total da corretagem (todos os credores, inclusive a UHome).
  const zemo = {
    total: round2(credores.reduce((s, c) => s + c.total, 0)),
    parcelas: totalLinha,
  };

  return { credores, totalLinha, zemo };
}

// ─── Componente ────────────────────────────────────────────────────────────────
export default function IntermediacaoPage() {
  // Comprador
  const [tipoPessoa, setTipoPessoa] = useState<"PF" | "PJ">("PF");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [socioAdmin, setSocioAdmin] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [genero, setGenero] = useState("");
  const [profissao, setProfissao] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [regimeBens, setRegimeBens] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");

  // Imóvel
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [vgv, setVgv] = useState("");

  // Corretores
  const [opcoesCorretores, setOpcoesCorretores] = useState<CorretorOption[]>([]);
  const emptyCorretor: CorretorForm = { user_id: "", nome: "", cpf: "", rg: "", email: "", percentual: "" };
  const [corretor1, setCorretor1] = useState<CorretorForm>({ ...emptyCorretor });
  const [corretor2, setCorretor2] = useState<CorretorForm>({ ...emptyCorretor });
  const [usarCorretor2, setUsarCorretor2] = useState(false);

  // Comissão
  const [valorTotal, setValorTotal] = useState("");
  const [pctGabrielle, setPctGabrielle] = useState("15");
  const [pctDiretoria, setPctDiretoria] = useState("10");
  const [parcelas, setParcelas] = useState<Parcela[]>([{ vencimento: "", valor: "" }]);

  // Data do contrato
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataContrato, setDataContrato] = useState(hoje);

  // Testemunhas (Testemunha 2 já vem com Carolina pré-preenchida)
  const [testemunha1, setTestemunha1] = useState<Testemunha>({ nome: "", email: "" });
  const [testemunha2, setTestemunha2] = useState<Testemunha>({ ...CAROLINA });

  const [gerando, setGerando] = useState(false);
  const [carregandoCorretores, setCarregandoCorretores] = useState(true);

  // Carregar corretores (via RPC SECURITY DEFINER — contorna RLS de user_roles p/ gestores)
  useEffect(() => {
    (async () => {
      setCarregandoCorretores(true);
      const { data, error } = await supabase.rpc("get_corretores_intermediacao");
      if (error) {
        toast.error("Erro ao carregar corretores: " + error.message);
        setCarregandoCorretores(false);
        return;
      }
      const opts = (data ?? [])
        .filter((p) => p.nome)
        .map((p) => ({
          user_id: p.user_id as string,
          nome: p.nome as string,
          cpf: p.cpf as string | null,
          email: p.email as string | null,
          creci: p.creci as string | null,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      setOpcoesCorretores(opts);
      setCarregandoCorretores(false);
    })();
  }, []);

  const selecionarCorretor = (
    userId: string,
    setter: React.Dispatch<React.SetStateAction<CorretorForm>>,
  ) => {
    const op = opcoesCorretores.find((o) => o.user_id === userId);
    setter((prev) => ({
      ...prev,
      user_id: userId,
      nome: op?.nome ?? "",
      cpf: op?.cpf ?? "",
      email: op?.email ?? "",
    }));
  };

  // Cálculo em tempo real
  const calc = useMemo(() => {
    const corretoresInput = [
      { nome: corretor1.nome || "Corretor 1", pct: num(corretor1.percentual) },
      ...(usarCorretor2 ? [{ nome: corretor2.nome || "Corretor 2", pct: num(corretor2.percentual) }] : []),
    ];
    const valoresParcelas = parcelas.map((p) => num(p.valor));
    return calcularCredores(
      num(valorTotal),
      corretoresInput,
      num(pctGabrielle),
      num(pctDiretoria),
      valoresParcelas,
    );
  }, [corretor1, corretor2, usarCorretor2, valorTotal, pctGabrielle, pctDiretoria, parcelas]);

  const pctUhome = useMemo(() => {
    const somaCorr = num(corretor1.percentual) + (usarCorretor2 ? num(corretor2.percentual) : 0);
    return Math.max(0, 100 - somaCorr - num(pctGabrielle) - num(pctDiretoria));
  }, [corretor1, corretor2, usarCorretor2, pctGabrielle, pctDiretoria]);

  const addParcela = () => setParcelas((p) => [...p, { vencimento: "", valor: "" }]);
  const removeParcela = (i: number) =>
    setParcelas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const updateParcela = (i: number, campo: keyof Parcela, valor: string) =>
    setParcelas((p) => p.map((par, idx) => (idx === i ? { ...par, [campo]: valor } : par)));

  const handleGerar = async () => {
    // validações básicas
    if (tipoPessoa === "PF" && !nomeCompleto.trim()) return toast.error("Informe o nome completo do comprador.");
    if (tipoPessoa === "PJ" && (!razaoSocial.trim() || !socioAdmin.trim())) return toast.error("Informe Razão Social e sócio-administrador.");
    if (!empreendimento.trim() || !unidade.trim()) return toast.error("Informe empreendimento e unidade.");
    if (!corretor1.user_id) return toast.error("Selecione o Corretor 1.");
    if (num(valorTotal) <= 0) return toast.error("Informe o valor total da corretagem.");
    if (parcelas.some((p) => !p.vencimento || num(p.valor) <= 0)) return toast.error("Preencha todas as parcelas (vencimento e valor).");

    const payload = {
      comprador: {
        tipoPessoa,
        razaoSocial, cnpj, socioAdmin,
        nomeCompleto, genero, profissao, estadoCivil, regimeBens,
        cpf, rg, telefone, email, endereco,
      },
      imovel: { empreendimento, unidade, vgv: num(vgv) },
      corretores: [
        { nome: corretor1.nome, cpf: corretor1.cpf, rg: corretor1.rg, email: corretor1.email, percentual: num(corretor1.percentual) },
        ...(usarCorretor2 && corretor2.user_id
          ? [{ nome: corretor2.nome, cpf: corretor2.cpf, rg: corretor2.rg, email: corretor2.email, percentual: num(corretor2.percentual) }]
          : []),
      ],
      comissao: {
        valorTotal: num(valorTotal),
        pctGabrielle: num(pctGabrielle),
        pctDiretoria: num(pctDiretoria),
        parcelas: parcelas.map((p) => ({ vencimento: p.vencimento, valor: num(p.valor) })),
      },
      dataContrato,
    };

    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-intermediacao", { body: payload });
      if (error) throw error;
      if (!data?.base64 || !data?.filename) throw new Error("Resposta inválida do servidor.");

      const bin = atob(data.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Documento gerado com sucesso!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar o documento.";
      toast.error(msg);
    } finally {
      setGerando(false);
    }
  };

  const ACCENT = "#4F46E5";

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <FileSignature className="h-6 w-6" style={{ color: ACCENT }} />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Instrumento de Intermediação Imobiliária</h1>
          <p className="text-sm text-muted-foreground">Gere o contrato de intermediação da Uhome em .docx</p>
        </div>
      </header>

      <Tabs defaultValue="gerar" className="space-y-6">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Intermediação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-6">


      {/* Comprador */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comprador (Contratante)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de pessoa</Label>
              <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as "PF" | "PJ")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PF">Pessoa Física</SelectItem>
                  <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipoPessoa === "PJ" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Razão Social</Label><Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex: Empresa Exemplo LTDA." /></div>
              <div className="space-y-2"><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Nome do sócio-administrador</Label><Input value={socioAdmin} onChange={(e) => setSocioAdmin(e.target.value)} placeholder="Ex: Carlos Souza" /></div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2"><Label>Nome completo</Label><Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Ex: João da Silva Souza" /></div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={genero} onValueChange={setGenero}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Profissão</Label><Input value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex: Engenheiro" /></div>
              <div className="space-y-2">
                <Label>Estado civil</Label>
                <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro(a)">Solteiro(a)</SelectItem>
                    <SelectItem value="casado(a)">Casado(a)</SelectItem>
                    <SelectItem value="divorciado(a)">Divorciado(a)</SelectItem>
                    <SelectItem value="viúvo(a)">Viúvo(a)</SelectItem>
                    <SelectItem value="união estável">União estável</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {estadoCivil === "casado(a)" && (
                <div className="space-y-2"><Label>Regime de bens</Label><Input value={regimeBens} onChange={(e) => setRegimeBens(e.target.value)} /></div>
              )}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>CPF</Label><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></div>
            <div className="space-y-2"><Label>RG</Label><Input value={rg} onChange={(e) => setRg(e.target.value)} placeholder="0000000000" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(51) 99999-9999" /></div>
            <div className="space-y-2"><Label>E-mail</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@email.com" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Endereço completo</Label><Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua Exemplo, nº 123, Bairro, Porto Alegre/RS, CEP 90000-000" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Imóvel */}
      <Card>
        <CardHeader><CardTitle className="text-base">Imóvel</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>Empreendimento</Label><Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} placeholder="Ex: Shift Torre Residencial" /></div>
          <div className="space-y-2"><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex: 1107" /></div>
          <div className="space-y-2 sm:col-span-3"><Label>VGV (valor do imóvel)</Label><Input value={vgv} onChange={(e) => setVgv(e.target.value)} placeholder="R$ 000.000,00" /></div>
        </CardContent>
      </Card>

      {/* Corretores */}
      <Card>
        <CardHeader><CardTitle className="text-base">Corretores</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {/* Corretor 1 */}
          <div className="space-y-3">
            <Label className="font-medium">Corretor 1</Label>
            <Select value={corretor1.user_id} onValueChange={(v) => selecionarCorretor(v, setCorretor1)} disabled={carregandoCorretores}>
              <SelectTrigger>
                <SelectValue placeholder={carregandoCorretores ? "Carregando corretores..." : "Buscar corretor..."} />
              </SelectTrigger>
              <SelectContent>
                {opcoesCorretores.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                    {carregandoCorretores ? "Carregando..." : "Nenhum corretor encontrado"}
                  </div>
                ) : (
                  opcoesCorretores.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.nome}</SelectItem>)
                )}
              </SelectContent>
            </Select>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor1.cpf} onChange={(e) => setCorretor1({ ...corretor1, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
              <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor1.rg} onChange={(e) => setCorretor1({ ...corretor1, rg: e.target.value })} placeholder="0000000000" /></div>
              <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor1.email} onChange={(e) => setCorretor1({ ...corretor1, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
              <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input value={corretor1.percentual} onChange={(e) => setCorretor1({ ...corretor1, percentual: e.target.value })} /></div>
            </div>
          </div>

          {/* Corretor 2 */}
          {!usarCorretor2 ? (
            <Button variant="outline" size="sm" onClick={() => setUsarCorretor2(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Corretor 2
            </Button>
          ) : (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Corretor 2</Label>
                <Button variant="ghost" size="sm" onClick={() => { setUsarCorretor2(false); setCorretor2({ ...emptyCorretor }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Select value={corretor2.user_id} onValueChange={(v) => selecionarCorretor(v, setCorretor2)} disabled={carregandoCorretores}>
                <SelectTrigger>
                  <SelectValue placeholder={carregandoCorretores ? "Carregando corretores..." : "Buscar corretor..."} />
                </SelectTrigger>
                <SelectContent>
                  {opcoesCorretores.length === 0 ? (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      {carregandoCorretores ? "Carregando..." : "Nenhum corretor encontrado"}
                    </div>
                  ) : (
                    opcoesCorretores.map((o) => <SelectItem key={o.user_id} value={o.user_id}>{o.nome}</SelectItem>)
                  )}
                </SelectContent>
              </Select>
              <div className="grid sm:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor2.cpf} onChange={(e) => setCorretor2({ ...corretor2, cpf: e.target.value })} placeholder="000.000.000-00" /></div>
                <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor2.rg} onChange={(e) => setCorretor2({ ...corretor2, rg: e.target.value })} placeholder="0000000000" /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor2.email} onChange={(e) => setCorretor2({ ...corretor2, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
                <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input value={corretor2.percentual} onChange={(e) => setCorretor2({ ...corretor2, percentual: e.target.value })} /></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comissão */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comissão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="space-y-2"><Label>Valor total da corretagem</Label><Input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="R$ 00.000,00" /></div>
            <div className="space-y-2"><Label>% Gabrielle</Label><Input value={pctGabrielle} onChange={(e) => setPctGabrielle(e.target.value)} /></div>
            <div className="space-y-2"><Label>% Diretoria</Label><Input value={pctDiretoria} onChange={(e) => setPctDiretoria(e.target.value)} /></div>
            <div className="space-y-2"><Label>% UHome (auto)</Label><Input value={`${round2(pctUhome)}%`} readOnly disabled /></div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Parcelas</Label>
              <Button variant="outline" size="sm" onClick={addParcela}><Plus className="h-4 w-4 mr-1" /> Adicionar parcela</Button>
            </div>
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={p.vencimento} onChange={(e) => updateParcela(i, "vencimento", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor</Label><Input value={p.valor} onChange={(e) => updateParcela(i, "valor", e.target.value)} placeholder="R$ 0.000,00" /></div>
                <Button variant="ghost" size="icon" onClick={() => removeParcela(i)} disabled={parcelas.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Data do contrato</Label><Input type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pré-visualização do quadro de pagamentos</CardTitle></CardHeader>
        <CardContent className="space-y-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credor</TableHead>
                <TableHead>Valor</TableHead>
                {parcelas.map((p, i) => <TableHead key={i}>{fmtDataCurta(p.vencimento)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {calc.credores.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{brl(c.total)}</TableCell>
                  {c.parcelas.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell>Total</TableCell>
                <TableCell>{brl(calc.credores.reduce((s, c) => s + c.total, 0))}</TableCell>
                {calc.totalLinha.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
              </TableRow>
            </TableBody>
          </Table>

          <div>
            <p className="text-sm font-medium mb-2">2.1 — Divisão de pagamento (ZemoBank)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credor</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Valor total</TableHead>
                  {parcelas.map((p, i) => <TableHead key={i}>{fmtDataCurta(p.vencimento)}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">ZemoBank</TableCell>
                  <TableCell>Pix ou Boleto</TableCell>
                  <TableCell>{brl(calc.zemo.total)}</TableCell>
                  {calc.zemo.parcelas.map((v, i) => <TableCell key={i}>{brl(v)}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

          <div className="flex justify-end pb-10">
            <Button onClick={handleGerar} disabled={gerando} style={{ backgroundColor: ACCENT }} className="text-white hover:opacity-90">
              {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
              Gerar Intermediação
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Aba Histórico ──────────────────────────────────────────────────────────────
interface IntermediacaoRegistro {
  id: string;
  created_at: string;
  comprador_nome: string;
  tipo_pessoa: string;
  empreendimento: string;
  unidade: string;
  vgv: number;
  valor_comissao: number;
  corretores: string[];
  arquivo_path: string;
  filename: string;
}

const fmtDataHist = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

function HistoricoTab() {
  const [registros, setRegistros] = useState<IntermediacaoRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [baixando, setBaixando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("intermediacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar o histórico.");
      } else {
        setRegistros((data ?? []) as IntermediacaoRegistro[]);
      }
      setLoading(false);
    })();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter(
      (r) =>
        r.comprador_nome.toLowerCase().includes(q) ||
        r.empreendimento.toLowerCase().includes(q),
    );
  }, [registros, busca]);

  const baixar = async (r: IntermediacaoRegistro) => {
    setBaixando(r.id);
    try {
      const { data, error } = await supabase.storage
        .from("intermediacoes")
        .createSignedUrl(r.arquivo_path, 300);
      if (error || !data?.signedUrl) throw error ?? new Error("URL não gerada");
      window.open(data.signedUrl, "_blank");
    } catch {
      toast.error("Não foi possível gerar o link de download.");
    } finally {
      setBaixando(null);
    }
  };

  const apagar = async (r: IntermediacaoRegistro) => {
    setApagando(r.id);
    try {
      if (r.arquivo_path) {
        await supabase.storage.from("intermediacoes").remove([r.arquivo_path]);
      }
      const { error } = await supabase.from("intermediacoes").delete().eq("id", r.id);
      if (error) throw error;
      setRegistros((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Intermediação apagada.");
    } catch {
      toast.error("Não foi possível apagar a intermediação.");
    } finally {
      setApagando(null);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por comprador ou empreendimento..."
            className="pl-8"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma intermediação encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Comprador</TableHead>
                  <TableHead>Empreendimento / Unidade</TableHead>
                  <TableHead className="text-right">VGV</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead>Corretores</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-sm">{fmtDataHist(r.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{r.comprador_nome}</TableCell>
                    <TableCell className="text-sm">
                      {r.empreendimento}
                      <span className="text-muted-foreground"> / {r.unidade}</span>
                    </TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.vgv)}</TableCell>
                    <TableCell className="text-right text-sm whitespace-nowrap">{brl(r.valor_comissao)}</TableCell>
                    <TableCell className="text-sm">{(r.corretores ?? []).join(", ")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => baixar(r)}
                          disabled={baixando === r.id}
                        >
                          {baixando === r.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-1">Download</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={apagando === r.id}
                            >
                              {apagando === r.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Apagar intermediação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação remove permanentemente o registro de{" "}
                                <strong>{r.comprador_nome}</strong> e o documento gerado. Não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => apagar(r)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Apagar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
