import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/simulador/MoneyInput";
import { TabelaParcelas } from "@/components/simulador/TabelaParcelas";
import { AtualizarTaxasDialog } from "@/components/simulador/AtualizarTaxasDialog";
import { useAuthUser } from "@/hooks/useAuthUser";
import { fmtMoney } from "@/lib/fmtMoney";
import {
  simular, analisarRenda, analisarIdade, idadeEmMeses, type SistemaAmortizacao, type ResultadoSimulacao,
} from "@/lib/financiamento";
import {
  calcularSeguros, DATA_REFERENCIA_SEGUROS, type ResultadoComSeguros,
} from "@/lib/segurosFinanciamento";
import { BANCOS, getBanco, getCondicao, DATA_REFERENCIA_TAXAS, REGIAO_REFERENCIA, type TipoImovel } from "@/lib/bancosFinanciamento";
import {
  enquadrarMCMV, MCMV_PRAZO_MAX_MESES, DATA_REFERENCIA_MCMV, type EnquadramentoMCMV,
} from "@/lib/mcmvFaixas";
import { gerarPdfSimulacao } from "@/lib/simuladorPdf";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator, Download, Share2, TrendingUp, AlertTriangle, CheckCircle2, Home, Percent, Info,
} from "lucide-react";

const PRAZO_ATALHOS = [20, 25, 30, 35];

export default function SimuladorFinanciamento() {
  const { profile } = useAuthUser();
  const { toast } = useToast();

  // ── Estado dos campos ──
  const [clienteNome, setClienteNome] = useState("");
  const [valorImovel, setValorImovel] = useState(0);
  const [entradaModo, setEntradaModo] = useState<"valor" | "percentual">("percentual");
  const [entradaValor, setEntradaValor] = useState(0);
  const [entradaPct, setEntradaPct] = useState(20);
  const [bancoId, setBancoId] = useState("caixa");
  const [tipoImovel, setTipoImovel] = useState<TipoImovel>("novo");
  const [usarMCMV, setUsarMCMV] = useState(false);
  const [sistema, setSistema] = useState<SistemaAmortizacao>("SAC");
  const [prazoAnos, setPrazoAnos] = useState(30);
  const [taxaCustom, setTaxaCustom] = useState<number | null>(null);
  const [renda, setRenda] = useState(0);
  const [dataNasc, setDataNasc] = useState("");

  const [resultado, setResultado] = useState<ResultadoSimulacao | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [incluirSeguros, setIncluirSeguros] = useState(true);

  const banco = getBanco(bancoId)!;
  const isCaixa = bancoId === "caixa";
  const mcmvAtivo = isCaixa && usarMCMV;
  const condicao = getCondicao(banco, tipoImovel);

  // ── Entrada / financiado ──
  const entrada = entradaModo === "valor" ? entradaValor : (valorImovel * entradaPct) / 100;
  const valorFinanciado = Math.max(0, valorImovel - entrada);

  // ── Enquadramento MCMV ──
  const enquadramento: EnquadramentoMCMV | null = mcmvAtivo ? enquadrarMCMV(renda, valorImovel) : null;

  // ── Taxa vigente (por banco + tipo de imóvel) ──
  const taxaBase = mcmvAtivo && enquadramento?.faixa ? enquadramento.faixa.taxaAnual : condicao.taxaAnual;
  const taxaAnual = taxaCustom ?? taxaBase;

  // ── Prazo (limites) ──
  const prazoMaxBanco = mcmvAtivo ? MCMV_PRAZO_MAX_MESES : banco.prazoMaxMeses;
  const analiseIdade = dataNasc ? analisarIdade(dataNasc) : null;
  const prazoMaxIdade = analiseIdade ? analiseIdade.prazoMaxMeses : Infinity;
  const prazoMaxMeses = Math.min(prazoMaxBanco, prazoMaxIdade);
  const prazoMeses = Math.min(prazoAnos * 12, prazoMaxMeses);

  const sistemasDisponiveis = banco.sistemas;

  // LTV do MCMV Faixa 4 exige 20% de entrada; demais usam a cota do banco/tipo.
  const financiaAteVigente = mcmvAtivo && enquadramento?.faixa?.entradaMinima
    ? 1 - enquadramento.faixa.entradaMinima
    : condicao.financiaAte;

  const financiadoAlerta = useMemo(() => {
    if (valorImovel <= 0) return null;
    const pctFinanciado = valorFinanciado / valorImovel;
    if (pctFinanciado > financiaAteVigente + 1e-9) {
      const rotulo = mcmvAtivo ? "Nesta faixa do MCMV" : `Para imóvel ${tipoImovel}, este banco`;
      return `${rotulo} financia até ${(financiaAteVigente * 100).toFixed(0)}% do imóvel. Aumente a entrada.`;
    }
    return null;
  }, [valorImovel, valorFinanciado, financiaAteVigente, mcmvAtivo, tipoImovel]);


  function handleSimular() {
    if (valorImovel <= 0) {
      toast({ title: "Informe o valor do imóvel", variant: "destructive" });
      return;
    }
    if (valorFinanciado <= 0) {
      toast({ title: "O valor financiado precisa ser maior que zero", variant: "destructive" });
      return;
    }
    if (mcmvAtivo && enquadramento && !enquadramento.elegivel) {
      toast({
        title: "Não elegível ao Minha Casa Minha Vida",
        description: enquadramento.alertas[0],
        variant: "destructive",
      });
      return;
    }
    if (analiseIdade && !analiseIdade.elegivel) {
      toast({ title: "Restrição de idade", description: analiseIdade.motivo, variant: "destructive" });
      return;
    }
    if (financiadoAlerta) {
      toast({ title: "Ajuste a entrada", description: financiadoAlerta, variant: "destructive" });
      return;
    }

    const subsidio = enquadramento?.subsidioEstimado ?? 0;
    const base = Math.max(0, valorFinanciado - subsidio);
    const r = simular(base, taxaAnual, prazoMeses, sistema);
    setResultado(r);
  }

  // Análise de renda considera a parcela com seguros quando o toggle está ativo.

  // Seguros (MIP/DFI) + tarifa + CET aproximado — estimativa por seguradora/idade.
  const seguros: ResultadoComSeguros | null = useMemo(() => {
    if (!resultado || !incluirSeguros) return null;
    return calcularSeguros(resultado, {
      valorImovel,
      bancoId,
      idadeInicialMeses: dataNasc ? idadeEmMeses(dataNasc) : null,
    });
  }, [resultado, incluirSeguros, valorImovel, bancoId, dataNasc]);

  // Parcela analisada para o comprometimento de renda: com seguros quando ativo.
  const parcelaParaRenda = seguros ? seguros.primeiraParcelaTotal : resultado?.primeiraParcela ?? 0;
  const analiseRendaEfetiva = resultado ? analisarRenda(parcelaParaRenda, renda) : null;

  async function handlePdf(acao: "download" | "share") {
    if (!resultado) return;
    setGerandoPdf(true);
    try {
      const tipoLabel = tipoImovel === "novo" ? "Imóvel novo / na planta" : "Imóvel usado";
      const modoLabel = mcmvAtivo && enquadramento?.faixa
        ? `Minha Casa Minha Vida — ${enquadramento.faixa.nome} · ${tipoLabel}`
        : `Financiamento convencional · ${tipoLabel}`;
      await gerarPdfSimulacao(
        {
          corretor: {
            nome: profile?.nome ?? "Corretor U.Home",
            telefone: profile?.telefone,
            email: profile?.email,
            avatarUrl: profile?.avatar_url,
          },
          banco: banco.nome,
          modoLabel,
          regiao: REGIAO_REFERENCIA,
          valorImovel,
          entrada,
          resultado,
          analiseRenda: analiseRendaEfetiva,
          analiseIdade,
          subsidioEstimado: enquadramento?.subsidioEstimado,
          clienteNome: clienteNome || undefined,
          fonteTaxas: mcmvAtivo ? `Portaria MCID 333/2026 (${DATA_REFERENCIA_MCMV})` : DATA_REFERENCIA_TAXAS,
          dataReferencia: mcmvAtivo ? DATA_REFERENCIA_MCMV : DATA_REFERENCIA_TAXAS,
          seguros: seguros
            ? {
                seguradora: seguros.seguradora,
                cetAnual: seguros.cetAnual,
                primeiraParcelaTotal: seguros.primeiraParcelaTotal,
                ultimaParcelaTotal: seguros.ultimaParcelaTotal,
                mip1: seguros.parcelas[0]?.mip ?? 0,
                dfi1: seguros.parcelas[0]?.dfi ?? 0,
                tarifa: seguros.parcelas[0]?.tarifa ?? 0,
                totalSeguros: seguros.totalSeguros,
                idadeConsiderada: seguros.idadeConsiderada,
                idadeEstimada: seguros.idadeEstimada,
                dataReferencia: DATA_REFERENCIA_SEGUROS,
              }
            : undefined,
        },
        acao,
      );
    } catch (e: any) {
      toast({ title: "Erro ao gerar PDF", description: e?.message, variant: "destructive" });
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-xl text-foreground sm:text-2xl">Simulador de Financiamento</h1>
            <p className="text-xs text-muted-foreground">
              {REGIAO_REFERENCIA} · Taxas de referência: {DATA_REFERENCIA_TAXAS} · estimativo (+ TR, sem seguros/CET)
            </p>
          </div>
        </div>
        <AtualizarTaxasDialog />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        {/* ─── Formulário ─── */}
        <Card className="p-5 space-y-4 h-fit">
          <div className="space-y-1.5">
            <Label htmlFor="cliente">Nome do cliente (opcional)</Label>
            <Input id="cliente" value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} placeholder="Ex.: Maria Silva" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valor">Valor do imóvel</Label>
            <MoneyInput id="valor" value={valorImovel} onValueChange={setValorImovel} />
            <p className="text-xs text-muted-foreground">Digite só os números — a formatação em reais é automática.</p>
          </div>

          {/* Tipo de imóvel: novo x usado (afeta taxa e cota de financiamento) */}
          <div className="space-y-1.5">
            <Label>Tipo de imóvel</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["novo", "usado"] as TipoImovel[]).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTipoImovel(t); setTaxaCustom(null); }}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    tipoImovel === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {t === "novo" ? "Novo / na planta" : "Usado"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {tipoImovel === "usado" && banco.observacaoUsado
                ? banco.observacaoUsado
                : `Financia até ${(condicao.financiaAte * 100).toFixed(0)}% · taxa ${(condicao.taxaAnual * 100).toFixed(2)}% a.a. (${REGIAO_REFERENCIA})`}
            </p>
          </div>


          {/* Entrada */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Entrada</Label>
              <div className="flex rounded-lg border border-border p-0.5 text-xs">
                <button
                  className={`rounded-md px-2 py-1 ${entradaModo === "percentual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => setEntradaModo("percentual")}
                >%</button>
                <button
                  className={`rounded-md px-2 py-1 ${entradaModo === "valor" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                  onClick={() => setEntradaModo("valor")}
                >R$</button>
              </div>
            </div>
            {entradaModo === "percentual" ? (
              <div className="relative">
                <Input
                  type="number" min={0} max={100} value={entradaPct}
                  onChange={(e) => setEntradaPct(Math.min(100, Math.max(0, Number(e.target.value))))}
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
            ) : (
              <MoneyInput value={entradaValor} onValueChange={setEntradaValor} />
            )}
            <p className="text-xs text-muted-foreground">
              Entrada: {fmtMoney(entrada, "exact")} · Financiado: <strong>{fmtMoney(valorFinanciado, "exact")}</strong>
            </p>
            {financiadoAlerta && <p className="text-xs text-danger-500">{financiadoAlerta}</p>}
          </div>

          {/* Banco */}
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bancoId} onValueChange={(v) => { setBancoId(v); setTaxaCustom(null); const b = getBanco(v)!; if (!b.sistemas.includes(sistema)) setSistema(b.sistemas[0]); if (v !== "caixa") setUsarMCMV(false); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANCOS.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* MCMV toggle */}
          {isCaixa && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-accent/50 p-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><Home className="h-4 w-4 text-primary" /> Minha Casa Minha Vida</p>
                <p className="text-xs text-muted-foreground">Enquadramento automático por renda e valor do imóvel</p>
              </div>
              <Switch checked={usarMCMV} onCheckedChange={(c) => { setUsarMCMV(c); setTaxaCustom(null); }} />
            </div>
          )}

          {/* Renda */}
          <div className="space-y-1.5">
            <Label htmlFor="renda">Renda familiar bruta</Label>
            <MoneyInput id="renda" value={renda} onValueChange={setRenda} />
            {mcmvAtivo && <p className="text-xs text-muted-foreground">No MCMV a renda define a faixa e a taxa aplicável.</p>}
          </div>

          {/* Data nascimento */}
          <div className="space-y-1.5">
            <Label htmlFor="nasc">Data de nascimento do proponente</Label>
            <Input id="nasc" type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} />
            {analiseIdade && (
              <p className={`text-xs ${analiseIdade.elegivel ? "text-muted-foreground" : "text-danger-500"}`}>
                {analiseIdade.elegivel
                  ? `Idade: ${analiseIdade.idadeAnos} anos · prazo máx. por idade: ${Math.floor(analiseIdade.prazoMaxMeses / 12)} anos`
                  : analiseIdade.motivo}
              </p>
            )}
          </div>

          {/* Sistema */}
          <div className="space-y-1.5">
            <Label>Sistema de amortização</Label>
            <div className="flex gap-2">
              {sistemasDisponiveis.map((s) => (
                <button
                  key={s}
                  onClick={() => setSistema(s)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    sistema === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {s} <span className="block text-[10px] font-normal">{s === "SAC" ? "parcela decrescente" : "parcela fixa"}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <Label>Prazo</Label>
            <div className="flex gap-2 flex-wrap">
              {PRAZO_ATALHOS.map((a) => (
                <button
                  key={a}
                  onClick={() => setPrazoAnos(a)}
                  disabled={a * 12 > prazoMaxMeses}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
                    prazoAnos === a ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                  }`}
                >{a} anos</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Prazo máximo: {Math.floor(prazoMaxMeses / 12)} anos ({prazoMaxMeses} meses)
              {analiseIdade?.elegivel && prazoMaxIdade < prazoMaxBanco ? " — limitado pela idade" : ""}
            </p>
          </div>

          {/* Taxa */}
          <div className="space-y-1.5">
            <Label htmlFor="taxa">Taxa de juros (% a.a.)</Label>
            <Input
              id="taxa" type="number" step="0.01"
              value={(taxaAnual * 100).toFixed(2)}
              onChange={(e) => setTaxaCustom(Number(e.target.value) / 100)}
            />
            <p className="text-xs text-muted-foreground">
              Pré-preenchida com a taxa auditada{mcmvAtivo && enquadramento?.faixa ? ` da ${enquadramento.faixa.nome}` : ` do ${banco.nome} para imóvel ${tipoImovel}`}. Ajuste conforme a proposta do banco.
            </p>
          </div>

          {/* Seguros + CET */}
          <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-accent/50 p-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5"><Percent className="h-4 w-4 text-primary" /> Incluir seguros e CET (estimado)</p>
              <p className="text-xs text-muted-foreground">MIP + DFI + tarifa, deixando a parcela próxima da carta do banco</p>
            </div>
            <Switch checked={incluirSeguros} onCheckedChange={setIncluirSeguros} />
          </div>

          <Button onClick={handleSimular} size="lg" className="w-full gap-2">
            <Calculator className="h-4 w-4" /> Simular financiamento
          </Button>
        </Card>

        {/* ─── Resultado ─── */}
        <div className="space-y-4 min-w-0">
          {mcmvAtivo && enquadramento && (
            <Card className="p-4 border-primary/30 bg-accent/40">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Home className="h-4 w-4 text-primary" />
                {enquadramento.faixa ? `Enquadramento: ${enquadramento.faixa.nome}` : "Sem enquadramento no MCMV"}
              </div>
              {enquadramento.alertas.map((a, i) => (
                <p key={i} className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {a}
                </p>
              ))}
              {enquadramento.faixa && enquadramento.elegivel && (
                <p className="mt-1 text-xs text-muted-foreground">{enquadramento.faixa.observacao}</p>
              )}
            </Card>
          )}

          {!resultado ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center text-muted-foreground">
              <TrendingUp className="h-10 w-10 opacity-40" />
              <p className="text-sm">Preencha os dados e clique em <strong>Simular</strong> para ver o demonstrativo de parcelas.</p>
            </Card>
          ) : (
            <>
              {/* Hero */}
              <Card className="p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Metric label="Valor financiado" value={fmtMoney(resultado.valorFinanciado, "exact")} />
                  <Metric label="1ª parcela" value={fmtMoney(resultado.primeiraParcela, "exact")} highlight />
                  <Metric label="Última parcela" value={fmtMoney(resultado.ultimaParcela, "exact")} />
                  <Metric label="Taxa" value={`${(resultado.taxaAnual * 100).toFixed(2)}% a.a.`} />
                  <Metric label="Prazo" value={`${Math.floor(resultado.prazoMeses / 12)} anos`} />
                  <Metric label="Sistema" value={resultado.sistema} />
                  <Metric label="Total de juros" value={fmtMoney(resultado.totalJuros, "exact")} />
                  <Metric label="Total pago" value={fmtMoney(resultado.totalPago, "exact")} />
                  {enquadramento?.subsidioEstimado ? (
                    <Metric label="Subsídio estimado" value={fmtMoney(enquadramento.subsidioEstimado, "exact")} />
                  ) : null}
                </div>

                {/* Seguros + CET aproximado */}
                {seguros && (
                  <div className="mt-4 rounded-xl border border-primary/30 bg-accent/40 p-4">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Percent className="h-4 w-4 text-primary" /> Parcela com seguros e CET aproximado
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <Metric label="1ª parcela + seguros" value={fmtMoney(seguros.primeiraParcelaTotal, "exact")} highlight />
                      <Metric label="CET aproximado" value={`${(seguros.cetAnual * 100).toFixed(2)}% a.a.`} />
                      <Metric label="Última + seguros" value={fmtMoney(seguros.ultimaParcelaTotal, "exact")} />
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>MIP (1ª): <strong className="text-foreground">{fmtMoney(seguros.parcelas[0].mip, "exact")}</strong></span>
                      <span>DFI/mês: <strong className="text-foreground">{fmtMoney(seguros.parcelas[0].dfi, "exact")}</strong></span>
                      <span>Tarifa: <strong className="text-foreground">{fmtMoney(seguros.parcelas[0].tarifa, "exact")}</strong></span>
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Estimativa via {seguros.seguradora}. MIP calculado para {seguros.idadeConsiderada} anos
                      {seguros.idadeEstimada ? " (idade estimada — informe a data de nascimento p/ maior precisão)" : ""} e
                      recalculado sobre o saldo devedor. CET não inclui TR/IOF; o oficial sai na carta do banco.
                    </p>
                  </div>
                )}

                {/* Análise de renda (considera seguros quando ativos) */}
                {analiseRendaEfetiva && (
                  <div
                    className={`mt-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
                      analiseRendaEfetiva.aprovavel
                        ? "border-success-300 bg-success-50/40"
                        : "border-danger-300 bg-danger-50/40"
                    }`}
                  >
                    {analiseRendaEfetiva.aprovavel ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-danger-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium">
                        {analiseRendaEfetiva.aprovavel ? "Parcela dentro de 30% da renda" : "Comprometimento acima de 30% da renda"}
                        {" "}({(analiseRendaEfetiva.percentualComprometido * 100).toFixed(1)}%)
                        {seguros ? " · já com seguros" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Parcela máxima recomendada (30%): {fmtMoney(analiseRendaEfetiva.parcelaMaxima, "exact")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Ações PDF */}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => handlePdf("download")} disabled={gerandoPdf} className="gap-2">
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                  <Button onClick={() => handlePdf("share")} disabled={gerandoPdf} variant="outline" className="gap-2">
                    <Share2 className="h-4 w-4" /> Compartilhar (WhatsApp)
                  </Button>
                </div>
              </Card>

              <TabelaParcelas resultado={resultado} />
            </>
          )}

          {/* Consulta CPF (fase 2) */}
          <Card className="p-4 border-dashed">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="h-4 w-4" /> Consulta de restrição de CPF (em breve)
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              A verificação de restrição de CPF exige contratação de um bureau de crédito (Serasa/SPC) e consentimento
              do cliente conforme a LGPD. Assim que o provedor for definido, ativamos aqui com segurança.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-primary bg-primary/5" : "border-border"}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 font-bold ${highlight ? "text-primary text-lg" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
