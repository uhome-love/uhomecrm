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
import { Plus, Trash2, FileSignature, Loader2, Download, Search, Pencil } from "lucide-react";
import { formatCurrencyInput, handleCurrencyChange, parseCurrencyToNumber, numberToRawCurrency } from "@/utils/currencyFormat";
import { ClientePipelineSeletor, type ClienteSelecionado } from "@/components/intermediacao/ClientePipelineSeletor";
import { GerentesComissao, type GerenteComissao } from "@/components/intermediacao/GerentesComissao";
import { todayBRT } from "@/lib/brtTime";
import { FormaPagamentoCard } from "@/components/intermediacao/FormaPagamentoCard";
import {
  DESCONTO_NF_PCT_PADRAO, construtoraDoEmpreendimento, type FormaPagamento,
} from "@/lib/intermediacaoPagamento";

import {maskCPF,maskRG,emptyComprador,CAROLINA,num,brl,fmtDataCurta,calcularCredores,CompradorFields,type CorretorOption,type CorretorForm,type CompradorForm,type Parcela,type Testemunha} from "@/components/intermediacao/IntermediacaoCampos";
import {HistoricoTab} from "@/components/intermediacao/IntermediacaoHistorico";
const round2=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;

// ─── Componente ────────────────────────────────────────────────────────────────
export default function IntermediacaoPage() {
  // Comprador(es) — lista dinâmica (aquisição pode ter vários compradores)
  const MAX_COMPRADORES = 6;
  const [compradores, setCompradores] = useState<CompradorForm[]>([{ ...emptyComprador }]);
  const updateComprador = (idx: number, patch: Partial<CompradorForm>) =>
    setCompradores((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  const addComprador = () =>
    setCompradores((prev) => (prev.length >= MAX_COMPRADORES ? prev : [...prev, { ...emptyComprador }]));
  const removeComprador = (idx: number) =>
    setCompradores((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));

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

  const [gerentes,setGerentes] = useState<GerenteComissao[]>([]);
  const [opcoesGerentes,setOpcoesGerentes] = useState<{user_id:string;nome:string}[]>([]);
  useEffect(()=>{void supabase.rpc("intermediacao_gerentes").then(r=>{if(r.error)toast.error("Não foi possível carregar os gerentes.");else setOpcoesGerentes(r.data??[]);});},[]);

  // Comissão
  const [valorTotal, setValorTotal] = useState("");
  const [pctGabrielle, setPctGabrielle] = useState("10");
  const [pctDiretoria, setPctDiretoria] = useState("5");
  const [parcelas, setParcelas] = useState<Parcela[]>([{ vencimento: "", valor: "" }]);

  // Data do contrato
  const hoje = todayBRT();
  const [dataContrato, setDataContrato] = useState(hoje);

  // Testemunhas (Testemunha 2 já vem com Carolina pré-preenchida)
  const [testemunha1, setTestemunha1] = useState<Testemunha>({ nome: "", email: "" });
  const [testemunha2, setTestemunha2] = useState<Testemunha>({ ...CAROLINA });

  const [gerando, setGerando] = useState(false);
  const [carregandoCorretores, setCarregandoCorretores] = useState(true);

  // Aba ativa (controlada, para permitir "Editar" a partir do histórico)
  const [aba, setAba] = useState("gerar");

  // Cliente do Pipeline, forma de pagamento e construtora
  const [cliente, setCliente] = useState<ClienteSelecionado | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [construtora, setConstrutora] = useState("");
  const [construtoraManual, setConstrutoraManual] = useState(false);

  // Construtora automática pelo empreendimento. Forma de pagamento nunca vem marcada: quem cria escolhe.
  useEffect(() => {
    if (!construtoraManual) setConstrutora(construtoraDoEmpreendimento(empreendimento) ?? "");
  }, [empreendimento, construtoraManual]);

  const aplicarCliente = (c: ClienteSelecionado) => {
    setCliente(c);
    setCompradores((prev) => [{ ...prev[0], nomeCompleto: prev[0].nomeCompleto || c.nome, telefone: prev[0].telefone || c.telefone, email: prev[0].email || c.email }, ...prev.slice(1)]);
    if (c.empreendimento) { setEmpreendimento(c.empreendimento); setConstrutoraManual(false); }
    if (c.unidade) setUnidade(c.unidade);
    if (c.vgv > 0) setVgv(numberToRawCurrency(c.vgv));
    if (c.corretorAuthId && opcoesCorretores.some((o) => o.user_id === c.corretorAuthId)) {
      selecionarCorretor(c.corretorAuthId, setCorretor1);
    }
    if (!c.negocioId) toast.info("Este cliente ainda não tem negócio aberto. A intermediação fica ligada ao cliente.");
  };

  // Carrega um payload salvo de volta no formulário (fluxo de edição).
  const carregarIntermediacao = (p: any) => {
    if (!p) return;
    
    const mapComprador = (x: any): CompradorForm => ({
      tipoPessoa: x?.tipoPessoa === "PJ" ? "PJ" : "PF",
      razaoSocial: x?.razaoSocial ?? "",
      cnpj: x?.cnpj ?? "",
      socioAdmin: x?.socioAdmin ?? "",
      nomeCompleto: x?.nomeCompleto ?? "",
      genero: x?.genero ?? "",
      profissao: x?.profissao ?? "",
      estadoCivil: x?.estadoCivil ?? "",
      regimeBens: x?.regimeBens ?? "",
      cpf: x?.cpf ?? "",
      rg: x?.rg ?? "",
      telefone: x?.telefone ?? "",
      email: x?.email ?? "",
      endereco: x?.endereco ?? "",
    });
    // Compat: payloads antigos têm apenas `comprador`; os novos têm `compradores` (array).
    const comps = Array.isArray(p.compradores) && p.compradores.length
      ? p.compradores
      : [p.comprador ?? {}];
    const mapeados = comps.map((c: any) => mapComprador(c ?? {}));
    setCompradores(mapeados.length ? mapeados : [{ ...emptyComprador }]);

    const im = p.imovel ?? {};
    setEmpreendimento(im.empreendimento ?? "");
    setUnidade(im.unidade ?? "");
    setVgv(numberToRawCurrency(im.vgv ?? 0));

    const corrs = Array.isArray(p.corretores) ? p.corretores : [];
    const mapCorr = (x: any): CorretorForm => ({
      user_id: "",
      nome: x?.nome ?? "",
      cpf: x?.cpf ?? "",
      rg: x?.rg ?? "",
      email: x?.email ?? "",
      percentual: x?.percentual != null ? String(x.percentual) : "",
    });
    setCorretor1(corrs[0] ? mapCorr(corrs[0]) : { ...emptyCorretor });
    if (corrs[1]) { setUsarCorretor2(true); setCorretor2(mapCorr(corrs[1])); }
    else { setUsarCorretor2(false); setCorretor2({ ...emptyCorretor }); }

    setGerentes(Array.isArray(p.gerentes)?p.gerentes.map((g:GerenteComissao)=>({...g,percentual:String(g.percentual)})):[]);
    const co = p.comissao ?? {};
    setValorTotal(numberToRawCurrency(co.valorTotal ?? 0));
    setPctGabrielle(co.pctGabrielle != null ? String(co.pctGabrielle) : "10");
    setPctDiretoria(co.pctDiretoria != null ? String(co.pctDiretoria) : "5");
    const pcs = Array.isArray(co.parcelas) ? co.parcelas : [];
    setParcelas(pcs.length ? pcs.map((x: any) => ({ vencimento: x?.vencimento ?? "", valor: numberToRawCurrency(x?.valor ?? 0) })) : [{ vencimento: "", valor: "" }]);

    const ts = Array.isArray(p.testemunhas) ? p.testemunhas : [];
    setTestemunha1(ts[0] ? { nome: ts[0].nome ?? "", email: ts[0].email ?? "" } : { nome: "", email: "" });
    setTestemunha2(ts[1] ? { nome: ts[1].nome ?? "", email: ts[1].email ?? "" } : { ...CAROLINA });

    setDataContrato(p.dataContrato ?? hoje);
    setFormaPagamento(p.formaPagamento === "nota_fiscal" || p.formaPagamento === "pix" || p.formaPagamento === "zemo" ? p.formaPagamento : null);
    setConstrutora(p.construtora ?? construtoraDoEmpreendimento(im.empreendimento) ?? "");
    setConstrutoraManual(!!p.construtora);
    setCliente(p.pipelineLeadId ? {
      pipelineLeadId: p.pipelineLeadId, negocioId: p.negocioId ?? null, nome: mapeados[0]?.nomeCompleto || mapeados[0]?.razaoSocial || "",
      telefone: "", email: "", empreendimento: im.empreendimento ?? "", unidade: im.unidade ?? "", vgv: im.vgv ?? 0, corretorAuthId: null,
    } : null);
    setAba("gerar");
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Dados carregados. Ajuste o que precisar e gere novamente.");
  };

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
    const valoresParcelas = parcelas.map((p) => parseCurrencyToNumber(p.valor));
    return calcularCredores(
      parseCurrencyToNumber(valorTotal),
      corretoresInput,
      num(pctGabrielle),
      num(pctDiretoria),
      valoresParcelas,
      gerentes.map(g=>({nome:g.nome||"Gerente",pct:num(g.percentual)})),
    );
  }, [corretor1, corretor2, usarCorretor2, valorTotal, pctGabrielle, pctDiretoria, parcelas, gerentes]);

  const somaPercentuais = useMemo(() => {
    const somaCorr = num(corretor1.percentual) + (usarCorretor2 ? num(corretor2.percentual) : 0);
    return somaCorr + num(pctGabrielle) + num(pctDiretoria) + gerentes.reduce((s,g)=>s+num(g.percentual),0);
  }, [corretor1, corretor2, usarCorretor2, pctGabrielle, pctDiretoria, gerentes]);

  const pctUhome = useMemo(() => Math.max(0, 100 - somaPercentuais), [somaPercentuais]);
  const pctExcedido = somaPercentuais > 100 + 1e-9;

  // Aviso quando a soma das parcelas diverge do valor total da corretagem.
  const somaParcelas = useMemo(
    () => round2(parcelas.reduce((s, p) => s + parseCurrencyToNumber(p.valor), 0)),
    [parcelas],
  );
  const parcelasDivergem = parseCurrencyToNumber(valorTotal) > 0 && Math.abs(somaParcelas - parseCurrencyToNumber(valorTotal)) > 0.01;

  // Atalhos de preenchimento de testemunhas: Carolina + corretores/gerentes carregados.
  const opcoesTestemunha = useMemo<Testemunha[]>(() => {
    const lista: Testemunha[] = [{ ...CAROLINA }];
    opcoesCorretores.forEach((o) => {
      if (o.nome) lista.push({ nome: o.nome, email: o.email ?? "" });
    });
    return lista;
  }, [opcoesCorretores]);

  const preencherTestemunha = (
    nome: string,
    setter: React.Dispatch<React.SetStateAction<Testemunha>>,
  ) => {
    const op = opcoesTestemunha.find((o) => o.nome === nome);
    if (op) setter({ nome: op.nome, email: op.email });
  };

  const addParcela = () => setParcelas((p) => [...p, { vencimento: "", valor: "" }]);
  const removeParcela = (i: number) =>
    setParcelas((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const updateParcela = (i: number, campo: keyof Parcela, valor: string) =>
    setParcelas((p) => p.map((par, idx) => (idx === i ? { ...par, [campo]: valor } : par)));

  const handleGerar = async () => {
    // validações básicas
    const validarComprador = (c: CompradorForm, rotulo: string): string | null => {
      if (c.tipoPessoa === "PF" && !c.nomeCompleto.trim()) return `Informe o nome completo do ${rotulo}.`;
      if (c.tipoPessoa === "PJ" && (!c.razaoSocial.trim() || !c.socioAdmin.trim())) return `Informe Razão Social e sócio-administrador do ${rotulo}.`;
      return null;
    };
    for (let i = 0; i < compradores.length; i++) {
      const rotulo = compradores.length > 1 ? `comprador ${i + 1}` : "comprador";
      const erro = validarComprador(compradores[i], rotulo);
      if (erro) return toast.error(erro);
    }
    if (!empreendimento.trim() || !unidade.trim()) return toast.error("Informe empreendimento e unidade.");
    if (!corretor1.user_id) return toast.error("Selecione o Corretor 1.");
    if (!cliente?.pipelineLeadId) return toast.error("Vincule um cliente do Pipeline.");
    if (gerentes.some(g=>!g.user_id||!g.percentual)) return toast.error("Selecione o gerente e o percentual.");
    if (!formaPagamento) {
      document.getElementById("forma-pagamento-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast.error("Escolha a forma de pagamento (ZemoBank, Nota fiscal ou PIX).");
    }
    if (parseCurrencyToNumber(valorTotal) <= 0) return toast.error("Informe o valor total da corretagem.");
    if (pctExcedido) return toast.error("A soma dos percentuais (corretores + gerentes + Gabrielle + Diretoria) ultrapassa 100%.");
    if (parcelas.some((p) => !p.vencimento || parseCurrencyToNumber(p.valor) <= 0)) return toast.error("Preencha todas as parcelas (vencimento e valor).");
    if (!testemunha1.nome.trim() || !testemunha1.email.trim()) return toast.error("Preencha nome e e-mail da Testemunha 1.");
    if (!testemunha2.nome.trim() || !testemunha2.email.trim()) return toast.error("Preencha nome e e-mail da Testemunha 2.");

    if (parcelasDivergem) return toast.error("A soma das parcelas deve ser igual à comissão bruta.");
    if (gerentes.length === 0 && !window.confirm("Nenhum gerente com comissão nesta intermediação. A parte do gerente vai para a UHome. Gerar assim mesmo?")) return;

    // Comprador: envia apenas os campos do tipo selecionado.
    const normalizarComprador = (c: CompradorForm) =>
      c.tipoPessoa === "PJ"
        ? {
            tipoPessoa: c.tipoPessoa, razaoSocial: c.razaoSocial, cnpj: c.cnpj, socioAdmin: c.socioAdmin,
            nomeCompleto: "", genero: "", profissao: "", estadoCivil: "", regimeBens: "",
            cpf: c.cpf, rg: c.rg, telefone: c.telefone, email: c.email, endereco: c.endereco,
          }
        : {
            tipoPessoa: c.tipoPessoa, razaoSocial: "", cnpj: "", socioAdmin: "",
            nomeCompleto: c.nomeCompleto, genero: c.genero, profissao: c.profissao, estadoCivil: c.estadoCivil,
            regimeBens: c.estadoCivil === "casado(a)" ? c.regimeBens : "",
            cpf: c.cpf, rg: c.rg, telefone: c.telefone, email: c.email, endereco: c.endereco,
          };

    const compradoresPayload = compradores.map(normalizarComprador);

    const payload = {
      comprador: compradoresPayload[0], // compat com consumidores antigos
      compradores: compradoresPayload,
      imovel: { empreendimento: empreendimento.trim(), unidade: unidade.trim(), vgv: parseCurrencyToNumber(vgv) },
      corretores: [
        { user_id: corretor1.user_id, nome: corretor1.nome, cpf: corretor1.cpf, rg: corretor1.rg, email: corretor1.email, percentual: num(corretor1.percentual) },
        ...(usarCorretor2 && corretor2.user_id
          ? [{ user_id: corretor2.user_id, nome: corretor2.nome, cpf: corretor2.cpf, rg: corretor2.rg, email: corretor2.email, percentual: num(corretor2.percentual) }]
          : []),
      ],
      gerentes: gerentes.map(g=>({...g,percentual:num(g.percentual)})),
      comissao: {
        valorTotal: parseCurrencyToNumber(valorTotal),
        pctGabrielle: num(pctGabrielle),
        pctDiretoria: num(pctDiretoria),
        parcelas: parcelas.map((p) => ({ vencimento: p.vencimento, valor: parseCurrencyToNumber(p.valor) })),
      },
      testemunhas: [
        { nome: testemunha1.nome.trim(), email: testemunha1.email.trim() },
        { nome: testemunha2.nome.trim(), email: testemunha2.email.trim() },
      ],
      dataContrato,
      formaPagamento,
      descontoNfPct: formaPagamento === "nota_fiscal" ? DESCONTO_NF_PCT_PADRAO : 0,
      construtora: construtora.trim() || undefined,
      negocioId: cliente?.negocioId ?? undefined,
      pipelineLeadId: cliente?.pipelineLeadId ?? undefined,
    };

    if (cliente?.negocioId) {
      const { data: existentes } = await supabase
        .from("intermediacoes")
        .select("id")
        .eq("negocio_id", cliente.negocioId).eq("status","ativa")
        .limit(1);
      if (existentes?.length && !window.confirm("Esta venda já tem intermediação. Gerar uma nova versão mesmo assim?")) return;
    }

    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerar-intermediacao", { body: payload });
      if (error) {
        let motivo = "";
        try {
          const ctx = (error as { context?: Response }).context;
          const j = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          const err = j?.error;
          if (typeof err === "string") motivo = err;
          else if (err && typeof err === "object") {
            const campos = Object.entries((err.fieldErrors ?? {}) as Record<string, string[]>).map(([k, v]) => `${k}: ${v.join(", ")}`);
            motivo = [...((err.formErrors ?? []) as string[]), ...campos].join(" · ");
          }
        } catch { /* mantém erro genérico */ }
        throw new Error(motivo || error.message);
      }
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


  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <FileSignature className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Instrumento de Intermediação Imobiliária</h1>
          <p className="text-sm text-muted-foreground">Gere o contrato de intermediação da Uhome em .docx</p>
        </div>
      </header>

      <Tabs value={aba} onValueChange={setAba} className="space-y-6">
        <TabsList>
          <TabsTrigger value="gerar">Gerar Intermediação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="gerar" className="space-y-6">


      <ClientePipelineSeletor value={cliente} onSelect={aplicarCliente} onClear={() => setCliente(null)} />

      {/* Comprador(es) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comprador (Contratante)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {compradores.map((comp, idx) => (
            <div key={idx} className={idx > 0 ? "space-y-4 border-t pt-4" : "space-y-4"}>
              {compradores.length > 1 && (
                <div className="flex items-center justify-between">
                  <Label className="font-medium">Comprador {idx + 1}</Label>
                  {idx > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => removeComprador(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              <CompradorFields
                value={comp}
                onChange={(patch) => updateComprador(idx, patch)}
              />
            </div>
          ))}

          {compradores.length < MAX_COMPRADORES && (
            <Button variant="outline" size="sm" onClick={addComprador}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar comprador
            </Button>
          )}
        </CardContent>
      </Card>


      {/* Imóvel */}
      <Card>
        <CardHeader><CardTitle className="text-base">Imóvel</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2 sm:col-span-2"><Label>Empreendimento</Label><Input value={empreendimento} onChange={(e) => setEmpreendimento(e.target.value)} placeholder="Ex: Shift Torre Residencial" /></div>
          <div className="space-y-2"><Label>Unidade</Label><Input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Ex: 1107" /></div>
          <div className="space-y-2"><Label>Construtora / Incorporadora</Label><Input value={construtora} onChange={(e) => { setConstrutora(e.target.value); setConstrutoraManual(true); }} placeholder="Automática pelo empreendimento" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>VGV (valor do imóvel)</Label><Input value={formatCurrencyInput(vgv)} onChange={(e) => setVgv(handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 000.000,00" /></div>
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
              <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor1.cpf} onChange={(e) => setCorretor1({ ...corretor1, cpf: maskCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></div>
              <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor1.rg} onChange={(e) => setCorretor1({ ...corretor1, rg: maskRG(e.target.value) })} placeholder="0000000000" /></div>
              <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor1.email} onChange={(e) => setCorretor1({ ...corretor1, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
              <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input type="number" min={0} max={100} value={corretor1.percentual} onChange={(e) => setCorretor1({ ...corretor1, percentual: e.target.value })} /></div>
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
                <div className="space-y-1"><Label className="text-xs">CPF</Label><Input value={corretor2.cpf} onChange={(e) => setCorretor2({ ...corretor2, cpf: maskCPF(e.target.value) })} inputMode="numeric" placeholder="000.000.000-00" /></div>
                <div className="space-y-1"><Label className="text-xs">RG</Label><Input value={corretor2.rg} onChange={(e) => setCorretor2({ ...corretor2, rg: maskRG(e.target.value) })} placeholder="0000000000" /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={corretor2.email} onChange={(e) => setCorretor2({ ...corretor2, email: e.target.value })} placeholder="nome@uhome.imb.br" /></div>
                <div className="space-y-1"><Label className="text-xs">% Comissão</Label><Input type="number" min={0} max={100} value={corretor2.percentual} onChange={(e) => setCorretor2({ ...corretor2, percentual: e.target.value })} /></div>
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
            <div className="space-y-2"><Label>Valor total da corretagem</Label><Input value={formatCurrencyInput(valorTotal)} onChange={(e) => setValorTotal(handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 00.000,00" /></div>
            <div className="space-y-2"><Label>% Gabrielle</Label><Input type="number" min={0} max={100} value={pctGabrielle} onChange={(e) => setPctGabrielle(e.target.value)} /></div>
            <div className="space-y-2"><Label>% Diretoria</Label><Input type="number" min={0} max={100} value={pctDiretoria} onChange={(e) => setPctDiretoria(e.target.value)} /></div>
            <div className="space-y-2"><Label>% UHome (auto)</Label><Input value={`${round2(pctUhome)}%`} readOnly disabled /></div>
          </div>
          <GerentesComissao value={gerentes} onChange={setGerentes} opcoes={opcoesGerentes}/>
          {pctExcedido && (
            <p className="text-sm font-medium text-destructive">
              A soma dos percentuais (corretores + gerentes + Gabrielle + Diretoria = {round2(somaPercentuais)}%) ultrapassa 100%.
            </p>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Parcelas</Label>
              <Button variant="outline" size="sm" onClick={addParcela}><Plus className="h-4 w-4 mr-1" /> Adicionar parcela</Button>
            </div>
            {parcelas.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Vencimento</Label><Input type="date" value={p.vencimento} onChange={(e) => updateParcela(i, "vencimento", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Valor</Label><Input value={formatCurrencyInput(p.valor)} onChange={(e) => updateParcela(i, "valor", handleCurrencyChange(e.target.value))} inputMode="numeric" placeholder="R$ 0.000,00" /></div>
                <Button variant="ghost" size="icon" onClick={() => removeParcela(i)} disabled={parcelas.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {parcelasDivergem && (
              <p className="text-sm font-medium text-amber-600">
                A soma das parcelas ({brl(somaParcelas)}) difere do valor total da corretagem ({brl(num(valorTotal))}).
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Data do contrato</Label><Input type="date" value={dataContrato} onChange={(e) => setDataContrato(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <FormaPagamentoCard
        forma={formaPagamento}
        onChange={setFormaPagamento}
        empreendimento={empreendimento}
        credores={calc.credores}
        pctDesconto={DESCONTO_NF_PCT_PADRAO}
      />


      {/* Testemunhas */}
      <Card>
        <CardHeader><CardTitle className="text-base">Testemunhas</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {[
            { label: "Testemunha 1", value: testemunha1, setter: setTestemunha1 },
            { label: "Testemunha 2", value: testemunha2, setter: setTestemunha2 },
          ].map(({ label, value, setter }) => (
            <div key={label} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-medium">{label}</Label>
                <Select value="" onValueChange={(v) => preencherTestemunha(v, setter)} disabled={carregandoCorretores}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Preencher rapidamente..." /></SelectTrigger>
                  <SelectContent>
                    {opcoesTestemunha.map((o) => (
                      <SelectItem key={o.nome} value={o.nome}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Nome</Label><Input value={value.nome} onChange={(e) => setter({ ...value, nome: e.target.value })} placeholder="Ex: Carolina de Camargo Madruga" /></div>
                <div className="space-y-1"><Label className="text-xs">E-mail</Label><Input value={value.email} onChange={(e) => setter({ ...value, email: e.target.value })} placeholder="nome@uhome.com.br" /></div>
              </div>
            </div>
          ))}
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

          {formaPagamento !== "zemo" ? (
            <p className="text-sm text-muted-foreground">
              {formaPagamento === "nota_fiscal"
                ? `2.1 — Nota fiscal: a Uhome recebe o valor integral e repassa a cada beneficiário, já descontados ${DESCONTO_NF_PCT_PADRAO}% (veja o quadro de repasse acima).`
                : formaPagamento === "pix"
                  ? "2.1 — PIX: cada beneficiário recebe direto na sua conta, conforme o quadro acima."
                  : "2.1 — Escolha a forma de pagamento:"}
              {!formaPagamento && (
                <span className="mt-2 flex flex-wrap gap-2">
                  {FORMAS_PAGAMENTO.map((f) => (
                    <Button key={f.value} type="button" size="sm" variant="outline" onClick={() => setFormaPagamento(f.value)}>{f.label}</Button>
                  ))}
                </span>
              )}
            </p>
          ) : (
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
          )}
        </CardContent>
      </Card>

          <div className="flex justify-end pb-10">
            <Button onClick={handleGerar} disabled={gerando}>
              {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
              Gerar Intermediação
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="historico">
          <HistoricoTab onEditar={carregarIntermediacao} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

