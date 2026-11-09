/** Tela de ligação única para Listas, Estagnados e Descartados: cliente, roteiro, resultado e ranking. */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, SkipForward, Trophy, Phone, Loader2, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { playSoundSuccess, getCelebrationEnabled } from "@/lib/celebrations";
import ArenaRanking from "@/components/arena/ArenaRanking";
import ClientePainel from "./ClientePainel";
import RoteiroPainel from "./RoteiroPainel";
import ResultadoBarra from "./ResultadoBarra";
import VisitaDialog from "./VisitaDialog";
import PlacarCompacto from "./PlacarCompacto";
import { useFilaOA } from "./useFilaOA";
import { ORIGEM_INFO, resultadosDaOrigem, type OrigemOA, type ResultadoOA } from "./tipos";

interface Props { origem: OrigemOA; listaIds: string[]; empreendimentos: string[]; onSair: () => void }

const MSG: Partial<Record<ResultadoOA, string>> = {
  nao_atendeu: "Próximo! 💪",
  sem_interesse: "Registrado. Bora pro próximo!",
  numero_errado: "Número errado registrado.",
};

export default function TelaLigacao({ origem, listaIds, empreendimentos, onSair }: Props) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const fila = useFilaOA({ origem, listaIds, empreendimentos });
  const { cliente, carregando, gravando, vazio, proximo, registrar, pular, sair } = fila;
  const [visitaAberta, setVisitaAberta] = useState(false);
  const [ultimo, setUltimo] = useState<ResultadoOA | null>(null);
  const [ligou, setLigou] = useState(false);
  const [destacar, setDestacar] = useState(false);
  const [aba, setAba] = useState<"ligar" | "ranking">("ligar");
  const corretorNome = String((user?.user_metadata as { nome?: string } | undefined)?.nome ?? "");

  useEffect(() => { void proximo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setLigou(false); setDestacar(false); }, [cliente?.id]);

  // Ao voltar do discador do celular, pede o resultado na hora.
  useEffect(() => {
    if (!ligou) return;
    const onVoltar = () => { if (document.visibilityState === "visible") setDestacar(true); };
    document.addEventListener("visibilitychange", onVoltar);
    window.addEventListener("focus", onVoltar);
    return () => { document.removeEventListener("visibilitychange", onVoltar); window.removeEventListener("focus", onVoltar); };
  }, [ligou]);

  const concluir = useCallback(async (r: ResultadoOA, extras = {}) => {
    setUltimo(r);
    const ok = await registrar(r, extras);
    if (!ok) return false;
    if (r === "aproveitar" || r === "visita") {
      toast.success(r === "visita" ? "Visita marcada e cliente no seu Pipeline! 🎉" : "Aproveitado! O cliente agora está no seu Pipeline. 🎉");
      if (getCelebrationEnabled()) playSoundSuccess();
    } else if (MSG[r]) toast(MSG[r], { duration: 1500 });
    await proximo();
    return true;
  }, [registrar, proximo]);

  const onResultado = useCallback((r: ResultadoOA) => {
    if (r === "visita") { setVisitaAberta(true); return; }
    void concluir(r);
  }, [concluir]);

  // Atalhos de teclado no computador: 1–5 resultados, P pula.
  useEffect(() => {
    if (isMobile || !cliente || aba !== "ligar") return;
    const opcoes = resultadosDaOrigem(origem);
    const ordem: ResultadoOA[] = ["nao_atendeu", "sem_interesse", "numero_errado", "aproveitar", "visita"];
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement;
      if (visitaAberta || gravando || e.metaKey || e.ctrlKey || e.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName) || alvo.isContentEditable) return;
      const r = ordem[Number(e.key) - 1];
      if (r && opcoes.includes(r)) { e.preventDefault(); onResultado(r); }
      if (e.key.toLowerCase() === "p") { e.preventDefault(); void pular(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aba, isMobile, cliente, origem, visitaAberta, gravando, onResultado, pular]);

  const sairTela = async () => { await sair(); onSair(); };

  return (
    <div className={isMobile && cliente && aba === "ligar" ? "pb-36" : ""}>
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-2 backdrop-blur md:mx-0 md:rounded-2xl md:border md:bg-card md:px-4">
        <Button variant="ghost" size="sm" onClick={() => void sairTela()} className="gap-1 px-2"><ArrowLeft className="h-4 w-4" aria-hidden /> Sair</Button>
        <span className="hidden truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline">{ORIGEM_INFO[origem].emoji} {ORIGEM_INFO[origem].titulo}</span>
        <div className="flex min-w-0 flex-1 justify-center"><PlacarCompacto /></div>
        <div role="tablist" aria-label="Visão" className="flex shrink-0 rounded-full bg-muted p-0.5">
          {(["ligar", "ranking"] as const).map((a) => (
            <button key={a} type="button" role="tab" aria-selected={aba === a} onClick={() => setAba(a)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-fast sm:px-3 ${aba === a ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {a === "ligar" ? <><Phone className="h-3.5 w-3.5" aria-hidden /><span className="hidden sm:inline">Ligar</span></> : <><Trophy className="h-3.5 w-3.5 text-warning-500" aria-hidden /><span className="hidden sm:inline">Ranking</span></>}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void pular()} disabled={!cliente || gravando || carregando || aba !== "ligar"} className="gap-1 px-2">
          Pular <SkipForward className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {aba === "ranking" && <div className="mx-auto max-w-2xl"><ArenaRanking /></div>}
      <div className={aba === "ranking" ? "hidden" : "grid items-start gap-3 lg:grid-cols-[minmax(320px,400px)_1fr]"}>
        <AnimatePresence mode="wait">
          {cliente ? (
            <motion.div key={cliente.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }} className="contents">
              <ClientePainel cliente={cliente} origem={origem} onLigou={() => setLigou(true)}>
                {!isMobile && <ResultadoBarra origem={origem} gravando={gravando} fixo={false} destacar={destacar} ultimo={ultimo} onResultado={onResultado} />}
              </ClientePainel>
              <div className="min-w-0 space-y-3">
                <RoteiroPainel cliente={cliente} corretorNome={corretorNome} />
                {isMobile && origem === "listas" && (
                  <button type="button" onClick={() => onResultado("numero_errado")} disabled={gravando} className="w-full py-2 text-center text-sm text-muted-foreground underline-offset-2 hover:underline">
                    Número errado?
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="estado" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-8 text-center lg:col-span-2">
              {carregando || !vazio ? (
                <><Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden /><p className="text-sm text-muted-foreground">Buscando o próximo cliente…</p></>
              ) : (
                <>
                  <PartyPopper className="h-10 w-10 text-primary" aria-hidden />
                  <p className="text-lg font-semibold">Você zerou essa fila! 👏</p>
                  <p className="max-w-sm text-sm text-muted-foreground">Não há mais clientes disponíveis neste filtro agora. Escolha outra origem para continuar ligando.</p>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => void proximo()}>Tentar de novo</Button><Button onClick={onSair}>Escolher outra fila</Button></div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isMobile && cliente && aba === "ligar" && <ResultadoBarra origem={origem} gravando={gravando} fixo destacar={destacar} ultimo={ultimo} onResultado={onResultado} />}

      <VisitaDialog aberto={visitaAberta} nome={cliente?.nome ?? ""} gravando={gravando} onFechar={() => setVisitaAberta(false)}
        onConfirmar={async (dataVisita, horaVisita, nota) => { setUltimo("visita"); if (await concluir("visita", { dataVisita, horaVisita, nota })) setVisitaAberta(false); }} />

    </div>
  );
}
