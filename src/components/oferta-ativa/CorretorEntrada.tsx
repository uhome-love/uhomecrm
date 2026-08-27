/**
 * CorretorEntrada — entrada direta do corretor na Oferta Ativa.
 *
 * Uma única tela: meta do dia (editável) → campanha do dia → script → discador.
 * Sem tela de warm-up e sem modal de onboarding.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Phone, Users, Clock, LayoutGrid, ScrollText, Rocket, Radio, Pencil, Check, ChevronDown, LogOut,
} from "lucide-react";
import { useCorretorProgress } from "@/hooks/useCorretorProgress";
import { useCampanhasDisponiveis } from "@/hooks/useCampanhasDisponiveis";
import type { OALista } from "@/hooks/useOfertaAtiva";
import DialingModeWithScript from "./DialingModeWithScript";
import ScriptPanel from "./ScriptPanel";
import CorretorListSelection from "./CorretorListSelection";

function diasRestantes(expiraEm?: string | null) {
  if (!expiraEm) return null;
  const ms = new Date(expiraEm).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

interface Props {
  onSair?: () => void;
}

export default function CorretorEntrada({ onSair }: Props) {
  const { campanhas, statsMap, isLoading } = useCampanhasDisponiveis();
  const { progress, saveGoals, refetchGoals } = useCorretorProgress();
  const [selectedLista, setSelectedLista] = useState<OALista | null>(null);
  const [showTodas, setShowTodas] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const { setOpen, open } = useSidebar();
  const prevOpenRef = useRef(open);

  const destaque = campanhas[0] ?? null;
  const outras = useMemo(() => campanhas.slice(1), [campanhas]);

  // Modo arena: colapsa o menu lateral enquanto liga
  useEffect(() => {
    if (selectedLista) {
      prevOpenRef.current = open;
      document.body.classList.add("arena-mode");
      setOpen(false);
    } else {
      document.body.classList.remove("arena-mode");
      setOpen(prevOpenRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLista]);

  const iniciar = useCallback((lista: OALista) => setSelectedLista(lista), []);

  if (selectedLista) {
    return <DialingModeWithScript lista={selectedLista} onBack={() => setSelectedLista(null)} />;
  }

  if (showTodas) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowTodas(false)}>
          ← Voltar para a entrada rápida
        </Button>
        <CorretorListSelection />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  // Produto real da campanha (usado pelo script da ligação — não muda).
  const empDestaque = destaque?.empreendimento || destaque?.nome || "";

  // Título = nome da campanha; empreendimento só como apoio quando for produto real.
  const tituloDestaque = destaque?.nome || destaque?.empreendimento || "";
  const produtoDestaque =
    destaque?.empreendimento && !ehRotuloGenerico(destaque.empreendimento) && destaque.empreendimento !== tituloDestaque
      ? destaque.empreendimento
      : null;

  return (
    <div className="space-y-3">
      {/* Missão do dia — metas editáveis */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="grid flex-1 grid-cols-3 gap-4 min-w-[260px]">
          <MetaMini
            label="🔥 Ligações"
            atual={progress.tentativas}
            meta={progress.metaLigacoes}
            pct={progress.progLigacoes}
            onSave={(v) => saveGoals(v, progress.metaAproveitados, progress.metaVisitas).then(() => refetchGoals())}
          />
          <MetaMini
            label="✅ Aproveitados"
            atual={progress.aproveitados}
            meta={progress.metaAproveitados}
            pct={progress.progAproveitados}
            onSave={(v) => saveGoals(progress.metaLigacoes, v, progress.metaVisitas).then(() => refetchGoals())}
          />
          <MetaMini
            label="📅 Visitas"
            atual={progress.visitasMarcadas}
            meta={progress.metaVisitas}
            pct={progress.progVisitas}
            onSave={(v) => saveGoals(progress.metaLigacoes, progress.metaAproveitados, v).then(() => refetchGoals())}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-amber-500">⭐ {progress.pontos} pts</span>
          {onSair && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={onSair}>
              <LogOut className="h-3.5 w-3.5" /> Sair
            </Button>
          )}
        </div>
      </div>

      {/* Campanha do dia */}
      {destaque ? (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
                <Rocket className="h-3.5 w-3.5" /> Campanha do dia
              </p>
              <h2 className="mt-1 truncate text-xl font-bold text-foreground">{empDestaque}</h2>
              {destaque.observacao && (
                <p className="mt-1 text-sm italic text-muted-foreground">🎯 {destaque.observacao}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-[11px]">
                  <Users className="h-3 w-3" /> {statsMap[destaque.id]?.naFila ?? 0} leads na fila
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  {statsMap[destaque.id]?.aproveitados ?? 0} aproveitados
                </Badge>
                {diasRestantes(destaque.expira_em) !== null && (
                  <Badge variant="outline" className="gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    {diasRestantes(destaque.expira_em) === 0
                      ? "expira hoje"
                      : `expira em ${diasRestantes(destaque.expira_em)}d`}
                  </Badge>
                )}
              </div>
            </div>

            <Button size="lg" autoFocus className="gap-2" onClick={() => iniciar(destaque)}>
              <Phone className="h-4 w-4" /> Ligar agora
            </Button>
          </div>

          {/* Script da ligação — 1 clique */}
          <Collapsible open={scriptOpen} onOpenChange={setScriptOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ScrollText className="h-3.5 w-3.5" /> Script da ligação
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${scriptOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <ScriptPanel empreendimento={empDestaque} compact scriptFilter="ligacao" hideCta />
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <Radio className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">Nenhuma campanha liberada para você agora</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que a liderança liberar uma campanha de Oferta Ativa, ela aparece aqui.
          </p>
        </div>
      )}

      {/* Outras campanhas liberadas */}
      {outras.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Outras campanhas liberadas
          </p>
          {outras.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{c.empreendimento || c.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {statsMap[c.id]?.naFila ?? 0} na fila · {statsMap[c.id]?.aproveitados ?? 0} aproveitados
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => iniciar(c)}>
                <Phone className="h-3.5 w-3.5" /> Ligar
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowTodas(true)}>
        <LayoutGrid className="h-3.5 w-3.5" /> Ver todas as listas
      </Button>
    </div>
  );
}

function MetaMini({
  label, atual, meta, pct, onSave,
}: {
  label: string;
  atual: number;
  meta: number;
  pct: number;
  onSave: (value: number) => void | Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(meta));

  const confirmar = async () => {
    const v = Number(draft);
    setEditing(false);
    if (Number.isFinite(v) && v > 0 && v !== meta) await onSave(v);
  };

  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && confirmar()}
            className="h-6 w-14 px-1 font-mono text-sm"
          />
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={confirmar} aria-label="Salvar meta">
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          className="group flex items-center gap-1 font-mono text-sm font-bold text-foreground"
          onClick={() => { setDraft(String(meta)); setEditing(true); }}
          aria-label={`Editar meta de ${label}`}
        >
          {atual}<span className="text-muted-foreground">/{meta}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      )}
      <Progress value={pct} className="mt-1 h-1.5" />
    </div>
  );
}
