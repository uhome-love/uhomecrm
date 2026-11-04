import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Power, Send, Users, CheckCircle2 } from "lucide-react";
import { produtoLabel } from "./useLiaHub";
import { RECUPERA_CONFIG } from "@/lia/recupera";
import { BALDES, useLiaReengajamento } from "./useLiaReengajamento";
import LiaLeituraAviso from "./LiaLeituraAviso";
import LiaReengajamentoLotes from "./LiaReengajamentoLotes";

export default function LiaReengajarTab() {
 const { loadingResumo, errorResumo, refetchResumo, runs, loadingRuns, errorRuns, refetchRuns, loadingCounts, errorCounts, refetchCounts,
  flag, flagLoading, flagError, refetchFlag, modo, setModo, produtoSlug, setProdutoSlug, balde, setBalde, capDia, setCapDia, lote, setLote,
  produtosDisponiveis, elegiveis, contagemPorBalde, countsPorRun, armar, mudarStatus, toggleFlag } = useLiaReengajamento();
 const flagConhecida = !flagLoading && !flagError && typeof flag === "boolean";
 return <div className="space-y-6">
  <section className="flex flex-wrap items-center gap-3 border-y border-border py-4">
   <Power className={flagConhecida && flag ? "h-5 w-5 text-success" : "h-5 w-5 text-muted-foreground"} />
   <div className="min-w-0 flex-1">
    <h2 className="text-sm font-semibold text-foreground">{!flagConhecida ? "Status dos envios indisponível" : flag ? "Envios ligados" : "Envios desligados"}</h2>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{flagConhecida && flag ? "Lotes ativos seguem seus horários e limites configurados." : flagConhecida ? "Nenhum envio automático. Piloto planejado: até " + RECUPERA_CONFIG.limiteDia + " contatos/dia; cada lote mantém seu limite configurado." : "Aguardando a leitura do status atual."}</p>
   </div>
   <Button size="sm" variant="outline" onClick={() => toggleFlag.mutate(!flag)} disabled={!flagConhecida || toggleFlag.isPending}>{flag ? "Desligar envios" : "Ligar envios"}</Button>
  </section>
  {flagError && <LiaLeituraAviso titulo="Não foi possível consultar o status dos envios." tentar={() => { void refetchFlag(); }} />}
  {errorResumo && <LiaLeituraAviso titulo="Não foi possível consultar os contatos para este lote." tentar={() => { void refetchResumo(); }} />}
      {/* ARMAR NOVO LOTE */}
      <section className="border-t border-border pt-5">
        <header className="mb-4">
          <h2 className="text-sm font-semibold text-foreground">Preparar novo lote</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Monta a fila (pausada) a partir da base de descartados, já sem bloqueados, opt-outs e leads vivos. Não dispara nada até você iniciar o lote e ligar o motor.
          </p>
        </header>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as "produto" | "cardapio")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Empreendimento</SelectItem>
                  <SelectItem value="cardapio">Cardápio de empreendimentos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modo === "produto" && (
              <div className="space-y-1">
                <Label className="text-[11px]">Imóvel</Label>
                <Select value={produtoSlug} onValueChange={setProdutoSlug}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {produtosDisponiveis.map((p) => (
                      <SelectItem key={p} value={p}>{produtoLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[11px]">Motivo do descarte</Label>
              <Select value={balde} onValueChange={setBalde}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BALDES.map((b) => (
                    <SelectItem key={b.valor} value={b.valor}>
                      {b.rotulo} ({contagemPorBalde.get(b.valor) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Limite do lote por dia</Label>
              <Input type="number" min={1} max={500} className="h-9" value={capDia} onChange={(e) => setCapDia(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tamanho do lote</Label>
              <Input type="number" min={1} max={500} className="h-9" value={lote} onChange={(e) => setLote(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
            <span className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <b>{loadingResumo || errorResumo ? "—" : elegiveis}</b> elegíveis nesse filtro
            </span>
            <span className="text-xs text-muted-foreground">{modo === "produto" ? "Mensagem por empreendimento" : "Mensagem com opções da campanha"}</span>
            <div className="ml-auto">
              <Button size="sm" onClick={() => armar.mutate()} disabled={armar.isPending || loadingResumo || errorResumo || elegiveis === 0}>
                <Send className="mr-1.5 h-4 w-4" /> Preparar lote (pausado)
              </Button>
            </div>
          </div>
          {modo === "cardapio" && (
            <p className="flex items-center gap-1.5 text-[11px] text-success-700 dark:text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Cérebro do cardápio pronto: o lead responde o número do menu e a LIA atende o empreendimento escolhido ou entende o perfil e passa para a Fila CEO.
            </p>
          )}
        </div>
      </section>

  <section className="border-t border-border pt-5">
   <h2 className="mb-4 text-sm font-semibold text-foreground">Histórico de lotes</h2>
   {errorRuns ? <LiaLeituraAviso titulo="Não foi possível consultar os lotes." tentar={() => { void refetchRuns(); }} /> : loadingRuns ? <Skeleton className="h-24 w-full" /> : !runs?.length ? <p className="py-6 text-sm text-muted-foreground">Nenhum lote preparado.</p> : <LiaReengajamentoLotes runs={runs} countsPorRun={countsPorRun} countsIndisponiveis={loadingCounts || errorCounts} mudarStatus={mudarStatus} />}
   {errorCounts && <LiaLeituraAviso titulo="Não foi possível consultar os totais dos lotes." tentar={() => { void refetchCounts(); }} />}
  </section>
 </div>;
}
