// =============================================================================
// PresencaRoletaPanel — Painel de presença física dos corretores por turno.
//
// Presença ≠ Credenciamento:
//   - Credenciamento = "quero receber lead nesse turno" (aprovado pelo CEO)
//   - Presença       = "estou fisicamente na empresa nesse turno"
//                      (validada pelo gerente, independe de credenciamento)
//
// Layout compacto: uma linha por corretor, com os turnos lado a lado.
// No escopo CEO, os corretores são agrupados por equipe (gestor).
// =============================================================================
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Users,
  Check,
  LogOut,
  Target,
  ChevronDown,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";
import {
  usePresencaCorretoresDia,
  type CorretorPresenca,
  type PresencaScope,
} from "@/hooks/usePresencaCorretoresDia";
import { useRoletaPresencas } from "@/hooks/useRoletaPresencas";
import {
  derivarEstadoTurno,
  ESTADO_LABEL,
  ESTADO_CLASSES,
  TURNO_LABEL,
  type EstadoCorretor,
  type PresencaTurno,
  type PresencaRow,
} from "@/lib/roletaPresenca";

interface Props {
  scope: PresencaScope;
  gestorId?: string;
  /** Quando true, esconde o link "Gerenciar roleta" no rodapé */
  hideManagerLink?: boolean;
  /** Quando true, agrupa corretores por equipe (default: true no escopo ceo) */
  groupByTeam?: boolean;
}

const TURNOS_BASE: PresencaTurno[] = ["manha", "tarde"];
const TURNO_LABEL_FULL: Record<PresencaTurno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noturna: "Noturna",
};

/** Corretor está credenciado neste turno? (dia_todo cobre manhã e tarde) */
function isCredenciadoNoTurno(
  credenciamentos: string[],
  turno: PresencaTurno,
): boolean {
  if (credenciamentos.includes(turno)) return true;
  if ((turno === "manha" || turno === "tarde") && credenciamentos.includes("dia_todo"))
    return true;
  return false;
}

// -----------------------------------------------------------------------------
// Mini-bloco de um turno (compact, horizontal)
function TurnoChip({
  turno,
  ativoAgora,
  presenca,
  credenciado,
  canManage,
  onMark,
  isMutating,
}: {
  turno: PresencaTurno;
  ativoAgora: boolean;
  presenca: PresencaRow | undefined;
  credenciado: boolean;
  canManage: boolean;
  onMark: (turno: PresencaTurno, status: "na_empresa" | "saiu") => void;
  isMutating: boolean;
}) {
  const estado: EstadoCorretor = derivarEstadoTurno(presenca, credenciado);
  const showChegou = canManage && estado !== "na_empresa" && estado !== "saiu";
  const showSaiu = canManage && estado === "na_empresa";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs min-w-0 transition",
        ativoAgora
          ? "bg-primary/5 border border-primary/30 shadow-sm"
          : "bg-muted/40 border border-border/50 hover:border-border",
      )}
    >
      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground w-14">
        {TURNO_LABEL_FULL[turno]}
      </span>
      <span
        className={cn(
          "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full whitespace-nowrap",
          ESTADO_CLASSES[estado],
        )}
      >
        {ESTADO_LABEL[estado]}
      </span>
      {credenciado && (
        <span
          className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary shrink-0"
          title="Credenciado neste turno"
        >
          <Target className="h-2.5 w-2.5" />
        </span>
      )}
      <div className="ml-auto flex gap-1">
        {showChegou && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1"
            disabled={isMutating}
            onClick={() => onMark(turno, "na_empresa")}
            title="Confirmar que chegou neste turno"
          >
            <Check className="h-3 w-3" />
            <span className="hidden lg:inline">Chegou</span>
          </Button>
        )}
        {showSaiu && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10"
            disabled={isMutating}
            onClick={() => onMark(turno, "saiu")}
            title="Marcar que saiu — remove da fila neste turno"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden lg:inline">Saiu</span>
          </Button>
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function CorretorRow({
  c,
  turnoAtivo,
  canManage,
  getPresenca,
  onMark,
  isMutating,
}: {
  c: CorretorPresenca;
  turnoAtivo: string;
  canManage: boolean;
  getPresenca: (id: string, turno: string) => PresencaRow | undefined;
  onMark: (
    corretor_id: string,
    turno: PresencaTurno,
    status: "na_empresa" | "saiu",
  ) => void;
  isMutating: boolean;
}) {
  const presencaManha = getPresenca(c.corretor_id, "manha");
  const presencaTarde = getPresenca(c.corretor_id, "tarde");
  const elegívelNoturna =
    presencaManha?.status === "na_empresa" &&
    presencaTarde?.status === "na_empresa";
  const credenciadoNoturna = c.credenciamentos.includes("noturna");
  const mostrarNoturna = elegívelNoturna || credenciadoNoturna;

  const turnos: PresencaTurno[] = mostrarNoturna
    ? [...TURNOS_BASE, "noturna"]
    : TURNOS_BASE;

  const algumCredenciado =
    c.credenciamentos.length > 0 &&
    (c.credenciamentos.includes("dia_todo") ||
      c.credenciamentos.some((k) => ["manha", "tarde", "noturna"].includes(k)));

  return (
    <div className="rounded-lg border border-border bg-card p-2 hover:bg-muted/10 transition">
      <div className="grid gap-2 md:grid-cols-[minmax(180px,220px)_1fr] md:items-center">
        {/* Coluna esquerda: identidade */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={c.avatar_url ?? undefined} alt={c.nome ?? ""} />
            <AvatarFallback className="text-[10px]">
              {(c.nome ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate leading-tight">
              {c.nome ?? "—"}
            </p>
            {algumCredenciado && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
                <Target className="h-2.5 w-2.5" /> Roleta
              </span>
            )}
          </div>
        </div>

        {/* Coluna direita: turnos lado a lado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
          {turnos.map((t) => (
            <TurnoChip
              key={t}
              turno={t}
              ativoAgora={turnoAtivo === t}
              presenca={getPresenca(c.corretor_id, t)}
              credenciado={isCredenciadoNoTurno(c.credenciamentos, t)}
              canManage={canManage}
              onMark={(turno, status) => onMark(c.corretor_id, turno, status)}
              isMutating={isMutating}
            />
          ))}
          {/* Placeholder para manter 3 colunas quando noturna não aparece */}
          {!mostrarNoturna && (
            <div className="hidden md:block" aria-hidden />
          )}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Grupo por equipe
function TeamGroup({
  nome,
  corretores,
  turnoAtivo,
  canManage,
  getPresenca,
  onMark,
  isMutating,
  foraDeJanela,
}: {
  nome: string;
  corretores: CorretorPresenca[];
  turnoAtivo: string;
  canManage: boolean;
  getPresenca: (id: string, turno: string) => PresencaRow | undefined;
  onMark: (
    corretor_id: string,
    turno: PresencaTurno,
    status: "na_empresa" | "saiu",
  ) => void;
  isMutating: boolean;
  foraDeJanela: boolean;
}) {
  const [open, setOpen] = useState(true);
  const naEmpresa = foraDeJanela
    ? 0
    : corretores.filter(
        (c) => getPresenca(c.corretor_id, turnoAtivo)?.status === "na_empresa",
      ).length;

  return (
    <div className="rounded-xl border border-border bg-muted/10 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              !open && "-rotate-90",
            )}
          />
          <span className="text-sm font-semibold text-foreground truncate">
            {nome}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {corretores.length} corretor{corretores.length === 1 ? "" : "es"}
          </span>
        </div>
        {!foraDeJanela && (
          <span className="text-[11px] font-medium text-success-700 tabular-nums shrink-0">
            {naEmpresa}/{corretores.length} presentes
          </span>
        )}
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 space-y-1.5">
          {corretores.map((c) => (
            <CorretorRow
              key={c.corretor_id}
              c={c}
              turnoAtivo={turnoAtivo}
              canManage={canManage}
              getPresenca={getPresenca}
              onMark={onMark}
              isMutating={isMutating}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
export function PresencaRoletaPanel({
  scope,
  gestorId,
  hideManagerLink,
  groupByTeam,
}: Props) {
  const { isAdmin, isGestor } = useUserRole();
  const canManage = isAdmin || isGestor;

  const { data, isLoading } = usePresencaCorretoresDia(scope, gestorId);
  const { getPresenca, marcarAsync, isMutating } = useRoletaPresencas();

  const corretores = data?.corretores ?? [];
  const turnoAtivo = data?.turno_ativo_atual ?? "";
  const turnoAtivoLabel = TURNO_LABEL[turnoAtivo] ?? "—";
  const foraDeJanela = !turnoAtivo || turnoAtivo === "madrugada";

  const shouldGroup = (groupByTeam ?? scope === "ceo") && corretores.length > 0;

  // Dialog state — registro de horário
  const [dialog, setDialog] = useState<{
    open: boolean;
    tipo: "chegada" | "saida";
    corretor_id: string;
    corretor_nome: string;
    turno: PresencaTurno;
  } | null>(null);

  const dataBRT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  // Estatísticas do topo
  const stats = useMemo(() => {
    if (foraDeJanela) return { naEmpresa: 0, faltas: 0, saidas: 0, semMarcar: 0 };
    let na = 0,
      falt = 0,
      saiu = 0,
      sem = 0;
    for (const c of corretores) {
      const p = getPresenca(c.corretor_id, turnoAtivo);
      if (p?.status === "na_empresa") na++;
      else if (p?.status === "saiu") saiu++;
      else if (p?.status === "falta") falt++;
      else sem++;
    }
    return { naEmpresa: na, faltas: falt, saidas: saiu, semMarcar: sem };
  }, [corretores, turnoAtivo, foraDeJanela, getPresenca]);

  // Agrupamento por gestor
  const grupos = useMemo(() => {
    if (!shouldGroup) return [];
    const map = new Map<string, { nome: string; corretores: CorretorPresenca[] }>();
    for (const c of corretores) {
      const key = c.gerente_id ?? "__sem_equipe__";
      const nome = c.gerente_nome ?? "Sem equipe";
      if (!map.has(key)) map.set(key, { nome, corretores: [] });
      map.get(key)!.corretores.push(c);
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => {
        // "Sem equipe" sempre no fim
        if (a.key === "__sem_equipe__") return 1;
        if (b.key === "__sem_equipe__") return -1;
        return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
      });
  }, [shouldGroup, corretores]);

  const titulo = scope === "ceo" ? "Presença da empresa" : "Presença do time";

  const handleMark = (
    corretor_id: string,
    turno: PresencaTurno,
    status: "na_empresa" | "saiu",
  ) => {
    const c = corretores.find((x) => x.corretor_id === corretor_id);
    setDialog({
      open: true,
      tipo: status === "na_empresa" ? "chegada" : "saida",
      corretor_id,
      corretor_nome: c?.nome ?? "corretor",
      turno,
    });
  };

  const handleConfirmHorario = async (iso: string) => {
    if (!dialog) return;
    try {
      await marcarAsync({
        corretor_id: dialog.corretor_id,
        turnos: [dialog.turno],
        status: dialog.tipo === "chegada" ? "na_empresa" : "saiu",
        chegou_em: dialog.tipo === "chegada" ? iso : null,
        saiu_em: dialog.tipo === "saida" ? iso : null,
      });
      setDialog(null);
    } catch {
      // toast já disparado pelo hook
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">
            Validada por turno pelo gestor, independente do credenciamento.
          </p>
        </div>
      </div>

      {/* Faixa de resumo */}
      <div
        className={cn(
          "rounded-lg px-3 py-2 mb-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1",
          foraDeJanela
            ? "bg-muted/40 text-muted-foreground"
            : "bg-success-50 text-success-700",
        )}
      >
        {foraDeJanela ? (
          <span className="font-medium">
            Presença de hoje · {corretores.length} corretor
            {corretores.length === 1 ? "" : "es"}
          </span>
        ) : (
          <>
            <span className="font-semibold">Turno {turnoAtivoLabel}</span>
            <span>
              Na empresa:{" "}
              <span className="tabular-nums font-bold">{stats.naEmpresa}</span>{" "}
              / {corretores.length}
            </span>
            {stats.saidas > 0 && (
              <span className="text-yellow-700">
                Saíram: <span className="tabular-nums font-bold">{stats.saidas}</span>
              </span>
            )}
            {stats.faltas > 0 && (
              <span className="text-destructive">
                Faltas: <span className="tabular-nums font-bold">{stats.faltas}</span>
              </span>
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-h-[180px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : corretores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
            <p className="text-sm text-muted-foreground">
              {scope === "gestor"
                ? "Nenhum corretor no seu time"
                : "Nenhum corretor ativo"}
            </p>
          </div>
        ) : shouldGroup ? (
          <div className="space-y-2">
            {grupos.map((g) => (
              <TeamGroup
                key={g.key}
                nome={g.nome}
                corretores={g.corretores}
                turnoAtivo={turnoAtivo}
                canManage={canManage}
                getPresenca={getPresenca}
                onMark={handleMark}
                isMutating={isMutating}
                foraDeJanela={foraDeJanela}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {corretores.map((c) => (
              <CorretorRow
                key={c.corretor_id}
                c={c}
                turnoAtivo={turnoAtivo}
                canManage={canManage}
                getPresenca={getPresenca}
                onMark={handleMark}
                isMutating={isMutating}
              />
            ))}
          </div>
        )}
      </div>

      {isAdmin && !hideManagerLink && (
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Link
            to="/roleta"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
          >
            Gerenciar roleta <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
