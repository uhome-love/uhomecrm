// =============================================================================
// PresencaRoletaPanel — Painel de presença física dos corretores por turno.
//
// Presença ≠ Credenciamento:
//   - Credenciamento = "quero receber lead nesse turno" (aprovado pelo CEO)
//   - Presença       = "estou fisicamente na empresa nesse turno"
//                      (validada pelo gerente, independe de credenciamento)
//
// A lista mostra TODOS os corretores relevantes (time do gestor ou empresa
// inteira para o CEO), credenciados ou não. O credenciamento aparece só como
// selo informativo ao lado do nome.
// =============================================================================
import { Link } from "react-router-dom";
import { ArrowRight, Users, Check, LogOut, Target } from "lucide-react";
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
}

// Turnos fixos exibidos por corretor. Noturna aparece condicionalmente.
const TURNOS_BASE: PresencaTurno[] = ["manha", "tarde"];

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
function TurnoLinha({
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
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
        ativoAgora
          ? "bg-primary/5 border border-primary/20"
          : "bg-muted/20 border border-transparent",
      )}
    >
      <span className="w-14 shrink-0 font-medium text-muted-foreground">
        {TURNO_LABEL[turno]}
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
          className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-[1px] rounded-full whitespace-nowrap bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-0.5"
          title="Credenciado neste turno"
        >
          <Target className="h-2.5 w-2.5" /> Roleta
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
            <Check className="h-3 w-3" /> Chegou
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
            <LogOut className="h-3 w-3" /> Saiu
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
  // Noturna só aparece se manhã E tarde já estão na_empresa (elegibilidade)
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

  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={c.avatar_url ?? undefined} alt={c.nome ?? ""} />
          <AvatarFallback className="text-[10px]">
            {(c.nome ?? "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <p className="text-sm font-medium text-foreground truncate flex-1">
          {c.nome ?? "—"}
        </p>
      </div>
      <div className="space-y-1">
        {turnos.map((t) => (
          <TurnoLinha
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
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
export function PresencaRoletaPanel({ scope, gestorId, hideManagerLink }: Props) {
  const { isAdmin, isGestor } = useUserRole();
  const canManage = isAdmin || isGestor;

  const { data, isLoading } = usePresencaCorretoresDia(scope, gestorId);
  const { getPresenca, marcar, isMutating } = useRoletaPresencas();

  const corretores = data?.corretores ?? [];
  const turnoAtivo = data?.turno_ativo_atual ?? "";
  const turnoAtivoLabel = TURNO_LABEL[turnoAtivo] ?? "—";
  const foraDeJanela = !turnoAtivo || turnoAtivo === "madrugada";

  // "Na empresa agora" no turno ativo
  const naEmpresaAgora = foraDeJanela
    ? 0
    : corretores.filter(
        (c) => getPresenca(c.corretor_id, turnoAtivo)?.status === "na_empresa",
      ).length;

  const titulo =
    scope === "ceo" ? "Presença da Roleta" : "Presença do Time";

  const handleMark = (
    corretor_id: string,
    turno: PresencaTurno,
    status: "na_empresa" | "saiu",
  ) => {
    marcar({ corretor_id, turnos: [turno], status });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="text-[11px] text-muted-foreground">
            Presença é validada por turno pelo gestor, independente do credenciamento.
          </p>
        </div>
      </div>

      <div
        className={cn(
          "rounded-lg p-2.5 mb-3 text-xs font-medium",
          foraDeJanela
            ? "bg-muted/40 text-muted-foreground"
            : naEmpresaAgora > 0
              ? "bg-success-50 text-success-700"
              : "bg-muted/40 text-muted-foreground",
        )}
      >
        {foraDeJanela ? (
          <>Presença de hoje · {corretores.length} corretor{corretores.length === 1 ? "" : "es"}</>
        ) : (
          <>
            Turno {turnoAtivoLabel} · Na empresa agora:{" "}
            <span className="tabular-nums font-bold">{naEmpresaAgora}</span> /{" "}
            {corretores.length}
          </>
        )}
      </div>

      <div className="flex-1 min-h-[180px]">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
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
        ) : (
          <div className="space-y-2">
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
