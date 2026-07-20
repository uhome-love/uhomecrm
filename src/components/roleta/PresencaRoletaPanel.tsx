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
  AlertTriangle,
  X,
} from "lucide-react";
import { RegistrarHorarioDialog } from "./RegistrarHorarioDialog";
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
import { useElegibilidadeDomingo } from "@/hooks/useElegibilidadeDomingo";
import {
  derivarEstadoTurno,
  ESTADO_LABEL,
  ESTADO_CLASSES,
  TURNO_LABEL,
  getRegimeDoDia,
  type EstadoCorretor,
  type PresencaTurno,
  type PresencaRow,
} from "@/lib/roletaPresenca";

type MarkStatus = "na_empresa" | "saiu" | "falta";

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
  onMark: (turno: PresencaTurno, status: MarkStatus) => void;
  isMutating: boolean;
}) {
  const estadoDerivado: EstadoCorretor = derivarEstadoTurno(presenca, credenciado);
  // Noturna é benefício automático: aprovou credenciamento → presente sempre.
  // Sem botões de Presente/Faltou/Saiu no turno da noite.
  const isNoturna = turno === "noturna";
  const estado: EstadoCorretor =
    isNoturna && credenciado ? "na_empresa" : estadoDerivado;
  // Botões:
  //  - Credenciado + presente → só "Saiu"
  //  - Não credenciado sem marcar → "Presente" + "Faltou"
  //  - Marcado "Faltou" ou "Saiu" → "Presente" pra corrigir
  const showPresente = canManage && !isNoturna && estado !== "na_empresa";
  const showSaiu = canManage && !isNoturna && estado === "na_empresa";
  const showFaltou =
    canManage && !isNoturna && !credenciado && estado === "sem_marcar";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5 text-xs min-w-0 transition",
        ativoAgora
          ? "bg-primary/5 border border-primary/30 shadow-sm"
          : "bg-muted/40 border border-border/50 hover:border-border",
      )}
    >
      <span className="shrink-0 text-[11px] font-semibold text-muted-foreground truncate">
        {TURNO_LABEL_FULL[turno]}
      </span>
      <span
        className={cn(
          "shrink-0 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full whitespace-nowrap",
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
      <div className="ml-auto flex flex-wrap justify-end gap-1 shrink-0">
        {showPresente && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1 border-success-500/40 text-success-700 hover:bg-success-500/10"
            disabled={isMutating}
            onClick={() => onMark(turno, "na_empresa")}
            title="Marcar presente — registra o horário de chegada"
            aria-label="Marcar presente"
          >
            <Check className="h-3 w-3" />
            <span className="hidden xl:inline">Presente</span>
          </Button>
        )}
        {showFaltou && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={isMutating}
            onClick={() => onMark(turno, "falta")}
            title="Marcar falta — corretor não compareceu"
            aria-label="Marcar falta"
          >
            <X className="h-3 w-3" />
            <span className="hidden xl:inline">Faltou</span>
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
            aria-label="Marcar que saiu"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden xl:inline">Saiu</span>
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
    status: MarkStatus,
  ) => void;
  isMutating: boolean;
}) {
  const credenciadoNoturna = c.credenciamentos.includes("noturna");
  // Noturna é benefício automático — só aparece para quem tem credenciamento aprovado.
  const mostrarNoturna = credenciadoNoturna;

  const turnos: PresencaTurno[] = mostrarNoturna
    ? [...TURNOS_BASE, "noturna"]
    : TURNOS_BASE;

  const algumCredenciado =
    c.credenciamentos.length > 0 &&
    (c.credenciamentos.includes("dia_todo") ||
      c.credenciamentos.some((k) => ["manha", "tarde", "noturna"].includes(k)));

  return (
    <div className="rounded-lg border border-border bg-card p-2 hover:bg-muted/10 transition">
      <div className="grid gap-2 lg:grid-cols-[minmax(180px,220px)_1fr] lg:items-center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5 min-w-0">
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
            <div className="hidden xl:block" aria-hidden />
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
    status: MarkStatus,
  ) => void;
  isMutating: boolean;
  foraDeJanela: boolean;
}) {
  const [open, setOpen] = useState(true);
  const naEmpresa = foraDeJanela
    ? 0
    : corretores.filter((c) => {
        const p = getPresenca(c.corretor_id, turnoAtivo);
        if (p?.status === "na_empresa") return true;
        if (p) return false;
        return isCredenciadoNoTurno(
          c.credenciamentos,
          turnoAtivo as PresencaTurno,
        );
      }).length;

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
// WeekendPanel — renderização especial para Sábado e Domingo
function WeekendPanel({
  titulo,
  regimeLabel,
  modo,
  corretores,
  isLoading,
  getPresenca,
  onMarkSaiu,
  isMutating,
  canManage,
  dataBRT,
}: {
  titulo: string;
  regimeLabel: string;
  modo: "sabado" | "domingo";
  corretores: CorretorPresenca[];
  isLoading: boolean;
  getPresenca: (id: string, turno: string) => PresencaRow | undefined;
  onMarkSaiu: (corretor_id: string) => void;
  isMutating: boolean;
  canManage: boolean;
  dataBRT: string;
}) {
  // Filtra corretores conforme o modo:
  // - sábado: TODOS (credenciados = presente, não credenciados = falta)
  // - domingo: apenas os credenciados aprovados do dia
  const lista =
    modo === "domingo"
      ? corretores.filter((c) => c.credenciamentos.length > 0)
      : corretores;

  const credenciadoIds = lista
    .filter((c) => c.credenciamentos.length > 0)
    .map((c) => c.corretor_id);

  // Elegibilidade só pro domingo
  const { data: elegibilidade } = useElegibilidadeDomingo(
    modo === "domingo" ? credenciadoIds : [],
    dataBRT,
  );

  const naEmpresa = lista.filter((c) => c.credenciamentos.length > 0).length;
  const semCred = lista.length - naEmpresa;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-[11px] text-muted-foreground">{regimeLabel}</p>
      </div>

      <div className="rounded-lg px-3 py-2 mb-3 text-xs bg-muted/40 border border-border text-muted-foreground leading-snug">
        {modo === "sabado" ? (
          <>
            <strong>Sábado:</strong> quem está no credenciamento aprovado conta
            como <strong>Presente</strong> automaticamente. Quem não credenciou
            é registrado como <strong>Falta</strong> no fechamento (23:59 BRT).
          </>
        ) : (
          <>
            <strong>Domingo:</strong> roleta é benefício remoto (de casa). Só
            participa quem credenciou <em>e</em> tem elegibilidade da semana
            (≥4 presenças + ≥2 visitas realizadas). Sem falta.
          </>
        )}
      </div>

      <div className="rounded-lg px-3 py-2 mb-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1 bg-success-50 text-success-700">
        <span className="font-semibold">
          {modo === "sabado" ? "Presentes hoje" : "Participantes"}:
        </span>
        <span className="tabular-nums font-bold">{naEmpresa}</span>
        {modo === "sabado" && semCred > 0 && (
          <span className="text-destructive">
            Sem credenciar:{" "}
            <span className="tabular-nums font-bold">{semCred}</span>
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
          <p className="text-sm text-muted-foreground">
            {modo === "domingo"
              ? "Nenhum corretor credenciado para hoje."
              : "Nenhum corretor ativo."}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {lista.map((c) => {
            const credenciado = c.credenciamentos.length > 0;
            const presMorning = getPresenca(c.corretor_id, "manha");
            const saiu = presMorning?.status === "saiu";
            const el = elegibilidade?.[c.corretor_id];
            return (
              <div
                key={c.corretor_id}
                className="rounded-lg border border-border bg-card p-2 hover:bg-muted/10 transition flex items-center gap-3"
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage
                    src={c.avatar_url ?? undefined}
                    alt={c.nome ?? ""}
                  />
                  <AvatarFallback className="text-[10px]">
                    {(c.nome ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {c.nome ?? "—"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {modo === "sabado" ? (
                      credenciado ? (
                        <span
                          className={cn(
                            "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full",
                            saiu
                              ? "bg-yellow-500/15 text-yellow-700 border border-yellow-500/30"
                              : "bg-success-500/15 text-success-700 border border-success-500/30",
                          )}
                        >
                          {saiu ? "Saiu" : "Presente (auto)"}
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full bg-destructive/10 text-destructive border border-destructive/30">
                          Sem credenciar
                        </span>
                      )
                    ) : (
                      <>
                        <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full bg-success-500/15 text-success-700 border border-success-500/30">
                          Presente (auto)
                        </span>
                        {el && (
                          <span
                            className={cn(
                              "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full",
                              el.elegivel
                                ? "bg-primary/10 text-primary border border-primary/30"
                                : "bg-yellow-500/15 text-yellow-800 border border-yellow-500/30",
                            )}
                            title={`Presenças: ${el.presencas_semana}/4 · Visitas: ${el.visitas_semana}/2`}
                          >
                            {el.elegivel
                              ? "Elegível"
                              : `Inelegível ${el.presencas_semana}/4·${el.visitas_semana}/2`}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {modo === "sabado" && credenciado && !saiu && canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-yellow-500/40 text-yellow-700 hover:bg-yellow-500/10 shrink-0"
                    disabled={isMutating}
                    onClick={() => onMarkSaiu(c.corretor_id)}
                    title="Marcar que saiu"
                    aria-label="Marcar que saiu"
                  >
                    <LogOut className="h-3 w-3" />
                    <span className="hidden xl:inline">Saiu</span>
                  </Button>
                )}
              </div>
            );
          })}
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

  // Dialog state — registro de horário / falta
  const [dialog, setDialog] = useState<{
    open: boolean;
    tipo: "chegada" | "saida" | "falta";
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

  const regime = getRegimeDoDia(dataBRT);

  // Pendências do DIA (não do turno ativo) — banner persiste até finalizar.
  // Só conta em regime presencial (seg-sex); sáb/dom têm outra lógica.
  const pendenciasDia = useMemo(() => {
    if (regime.regime !== "seg_sex") return { total: 0, corretores: 0 };
    let total = 0;
    let corretoresPendentes = 0;
    for (const c of corretores) {
      let pendenciasDoCorretor = 0;
      for (const t of regime.turnosMarcaveis) {
        const p = getPresenca(c.corretor_id, t);
        const credenciado = isCredenciadoNoTurno(c.credenciamentos, t);
        // Sem row + não credenciado = pendente
        if (!p && !credenciado) pendenciasDoCorretor++;
      }
      if (pendenciasDoCorretor > 0) {
        total += pendenciasDoCorretor;
        corretoresPendentes++;
      }
    }
    return { total, corretores: corretoresPendentes };
  }, [corretores, regime, getPresenca]);

  // Estatísticas do turno ativo (mesma lógica anterior; para a faixa de resumo)
  const stats = useMemo(() => {
    if (foraDeJanela) return { naEmpresa: 0, faltas: 0, saidas: 0, semMarcar: 0 };
    let na = 0,
      falt = 0,
      saiu = 0,
      sem = 0;
    for (const c of corretores) {
      const p = getPresenca(c.corretor_id, turnoAtivo);
      const credenciado = isCredenciadoNoTurno(
        c.credenciamentos,
        turnoAtivo as PresencaTurno,
      );
      if (p?.status === "na_empresa") na++;
      else if (p?.status === "saiu") saiu++;
      else if (p?.status === "falta") falt++;
      else if (credenciado) na++; // credenciado sem row = presente automático
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
        if (a.key === "__sem_equipe__") return 1;
        if (b.key === "__sem_equipe__") return -1;
        return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
      });
  }, [shouldGroup, corretores]);

  const titulo = scope === "ceo" ? "Presença da empresa" : "Presença do time";

  const handleMark = (
    corretor_id: string,
    turno: PresencaTurno,
    status: MarkStatus,
  ) => {
    const c = corretores.find((x) => x.corretor_id === corretor_id);
    const tipo: "chegada" | "saida" | "falta" =
      status === "na_empresa"
        ? "chegada"
        : status === "saiu"
          ? "saida"
          : "falta";
    setDialog({
      open: true,
      tipo,
      corretor_id,
      corretor_nome: c?.nome ?? "corretor",
      turno,
    });
  };

  const handleConfirmHorario = async (iso: string) => {
    if (!dialog) return;
    try {
      const status: MarkStatus =
        dialog.tipo === "chegada"
          ? "na_empresa"
          : dialog.tipo === "saida"
            ? "saiu"
            : "falta";
      await marcarAsync({
        corretor_id: dialog.corretor_id,
        turnos: [dialog.turno],
        status,
        chegou_em: dialog.tipo === "chegada" ? iso : null,
        saiu_em: dialog.tipo === "saida" ? iso : null,
      });
      setDialog(null);
    } catch {
      // toast já disparado pelo hook
    }
  };

  // ─── Regime SÁBADO: credenciado = Presente auto · sem credencial = Falta auto ─
  if (regime.regime === "sabado") {
    return (
      <WeekendPanel
        titulo={titulo}
        regimeLabel={regime.label}
        modo="sabado"
        corretores={corretores}
        isLoading={isLoading}
        getPresenca={getPresenca}
        onMarkSaiu={(cid) => {
          const c = corretores.find((x) => x.corretor_id === cid);
          setDialog({
            open: true,
            tipo: "saida",
            corretor_id: cid,
            corretor_nome: c?.nome ?? "corretor",
            turno: "manha",
          });
        }}
        isMutating={isMutating}
        canManage={canManage}
        dataBRT={dataBRT}
      />
    );
  }

  // ─── Regime DOMINGO: benefício remoto + elegibilidade ────────────────────────
  if (regime.regime === "domingo") {
    return (
      <WeekendPanel
        titulo={titulo}
        regimeLabel={regime.label}
        modo="domingo"
        corretores={corretores}
        isLoading={isLoading}
        getPresenca={getPresenca}
        onMarkSaiu={() => {}}
        isMutating={isMutating}
        canManage={canManage}
        dataBRT={dataBRT}
      />
    );
  }


  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">
            {regime.label} · gestor valida por turno.
          </p>
        </div>
      </div>

      {/* Faixa de resumo do turno ativo */}
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

      {/* Banner persistente: enquanto houver pendência no dia */}
      {canManage && pendenciasDia.total > 0 && (
        <div className="rounded-lg px-3 py-2 mb-3 text-xs flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong>{pendenciasDia.corretores}</strong> corretor
            {pendenciasDia.corretores === 1 ? "" : "es"} sem marcação hoje (
            <strong>{pendenciasDia.total}</strong> turno
            {pendenciasDia.total === 1 ? "" : "s"} pendente
            {pendenciasDia.total === 1 ? "" : "s"}). Registre <strong>Presente</strong>
            {" "}ou <strong>Faltou</strong> antes de encerrar o dia — sem marcação
            não conta como falta.
          </div>
        </div>
      )}



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

      <RegistrarHorarioDialog
        open={!!dialog?.open}
        tipo={dialog?.tipo ?? "chegada"}
        dataBRT={dataBRT}
        corretorNome={dialog?.corretor_nome ?? ""}
        turnoLabel={TURNO_LABEL[dialog?.turno ?? ""] ?? "—"}
        onCancel={() => setDialog(null)}
        onConfirm={handleConfirmHorario}
        isSubmitting={isMutating}
      />
    </div>
  );
}
