// =============================================================================
// PresencaDoCorretorPill — mostra ao corretor a presença marcada pelo gerente
// hoje + botão "Sair" (que retira ele da roleta imediatamente).
//
// Regime (já implementado no sistema):
//  - Seg-Sex: turno atual manual (Manhã/Tarde). Noturna = benefício auto.
//  - Sábado : credenciamento aprovado = presente.
//  - Domingo: benefício remoto por credencial + elegibilidade.
// =============================================================================
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRoletaPresencas } from "@/hooks/useRoletaPresencas";
import { useElegibilidadeDomingo } from "@/hooks/useElegibilidadeDomingo";
import { getRegimeDoDia, type PresencaTurno } from "@/lib/roletaPresenca";
import { Loader2, LogOut, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

function todayBRT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function horaDecimalBRT(): number {
  const brt = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.getHours() + brt.getMinutes() / 60;
}

function fmtHora(ts: string | null | undefined): string {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function turnoAtualPresencial(): PresencaTurno | null {
  const h = horaDecimalBRT();
  if (h >= 7 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  return null;
}

interface Props {
  profileId: string | null;
  authUserId: string | undefined;
}

export default function PresencaDoCorretorPill({ profileId, authUserId }: Props) {
  const hoje = todayBRT();
  const regime = getRegimeDoDia(hoje);
  const { presencas, isLoading } = useRoletaPresencas(hoje);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saindo, setSaindo] = useState(false);

  // Credenciamentos aprovados do dia (para noturna/sábado/domingo)
  const { data: creds = [] } = useQuery({
    queryKey: ["cred-do-corretor", profileId, hoje],
    enabled: !!profileId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("roleta_credenciamentos")
        .select("janela, status")
        .eq("corretor_id", profileId!)
        .eq("data", hoje);
      return data ?? [];
    },
  });

  const credAprovadoNoturna = creds.some(
    (c: any) => c.janela === "noturna" && c.status === "aprovado",
  );
  const credAprovadoDiaTodo = creds.some(
    (c: any) => c.janela === "dia_todo" && c.status === "aprovado",
  );

  const minhas = useMemo(
    () => (profileId ? presencas.filter((p) => p.corretor_id === profileId) : []),
    [presencas, profileId],
  );

  // Elegibilidade domingo
  const elegDomingo = useElegibilidadeDomingo(
    regime.regime === "domingo" && profileId ? [profileId] : [],
    hoje,
  );

  if (!profileId || isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground px-2.5 py-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando presença…
      </div>
    );
  }

  // ===== Sábado / Domingo (benefício por credencial) =====
  if (regime.regime === "sabado") {
    const aprovado = credAprovadoDiaTodo;
    return (
      <PillView
        icon={aprovado ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        label={aprovado ? "Presente · sábado" : "Sem credencial · sábado"}
        tone={aprovado ? "success" : "muted"}
        hint={aprovado ? "Credenciamento aprovado" : "Não credenciado no sábado"}
      />
    );
  }

  if (regime.regime === "domingo") {
    const eleg = elegDomingo.data?.[profileId];
    if (!credAprovadoDiaTodo) {
      return (
        <PillView
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="Sem credencial · domingo"
          tone="muted"
        />
      );
    }
    if (eleg && !eleg.elegivel) {
      return (
        <PillView
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="Não elegível · domingo"
          tone="warning"
          hint={`Precisa ≥4 presenças (${eleg.presencas_semana}) e ≥2 visitas (${eleg.visitas_semana}) na semana anterior`}
        />
      );
    }
    return (
      <PillView
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label="Presente · domingo (benefício)"
        tone="success"
      />
    );
  }

  // ===== Seg-Sex =====
  // Se está no horário útil de manhã/tarde, mostra o estado do turno atual.
  const turnoAgora = turnoAtualPresencial();

  // Noturna (18h+): mostra benefício se credenciado
  if (turnoAgora === null && horaDecimalBRT() >= 18) {
    if (credAprovadoNoturna) {
      return (
        <PillView
          icon={<Sparkles className="h-3.5 w-3.5" />}
          label="Presente · noturna (benefício)"
          tone="success"
        />
      );
    }
    // Consolidado do dia
    const consolidado = resumoDoDia(minhas);
    return <PillView {...consolidado} />;
  }

  if (turnoAgora === null) {
    // Antes das 7h → aguardando início
    return (
      <PillView
        icon={<Clock className="h-3.5 w-3.5" />}
        label="Aguardando início do turno"
        tone="muted"
      />
    );
  }

  const p = minhas.find((x) => x.turno === turnoAgora);
  const turnoLabel = turnoAgora === "manha" ? "Manhã" : "Tarde";

  const podeSair =
    p && p.status === "na_empresa"; // Só sai se o gerente já marcou presença
  const jaSaiu = p && p.status === "saiu";
  const faltou = p && p.status === "falta";

  const onSair = async () => {
    if (!authUserId || !turnoAgora) return;
    setSaindo(true);
    const { error } = await supabase.rpc("roleta_corretor_sair", { p_turno: turnoAgora });
    setSaindo(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(`Erro ao sair da roleta: ${error.message}`);
      return;
    }
    toast.success("Você saiu da roleta.");
  };

  let content;
  if (!p) {
    content = (
      <PillView
        icon={<Clock className="h-3.5 w-3.5" />}
        label={`Aguardando presença · ${turnoLabel}`}
        tone="muted"
        hint="Seu gerente ainda não marcou presença hoje"
      />
    );
  } else if (faltou) {
    content = (
      <PillView
        icon={<XCircle className="h-3.5 w-3.5" />}
        label={`Faltou · ${turnoLabel}`}
        tone="danger"
      />
    );
  } else if (jaSaiu) {
    content = (
      <PillView
        icon={<LogOut className="h-3.5 w-3.5" />}
        label={`Saiu · ${fmtHora(p.saiu_em)}`}
        tone="warning"
      />
    );
  } else {
    content = (
      <PillView
        icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        label={p.chegou_em ? `Presente · ${turnoLabel} ${fmtHora(p.chegou_em)}` : `Presente · ${turnoLabel}`}
        tone="success"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      {content}
      {podeSair && (
        <>
          <button
            onClick={() => setConfirmOpen(true)}
            className="text-xs font-medium px-2 py-1 rounded-lg border border-amber-500/40 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 transition-colors flex items-center gap-1"
            title="Sair da roleta agora"
          >
            <LogOut className="h-3 w-3" /> Sair
          </button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sair da roleta agora?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você deixa de receber leads hoje. Sua saída ficará registrada às {" "}
                  <strong>{fmtHora(new Date().toISOString())}</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={saindo}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onSair} disabled={saindo}>
                  {saindo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Confirmar saída
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

// ---------- View helpers ----------

type Tone = "success" | "warning" | "danger" | "muted";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-700 border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-400",
  danger: "bg-red-50 text-red-700 border-red-500/30 dark:bg-red-950/30 dark:text-red-400",
  muted: "bg-muted/40 text-muted-foreground border-border",
};

function PillView({
  icon,
  label,
  tone,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  tone: Tone;
  hint?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 border ${TONE_CLASSES[tone]}`}
      title={hint}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}

function resumoDoDia(minhas: { turno: string; status: string }[]): {
  icon: React.ReactNode;
  label: string;
  tone: Tone;
} {
  const manha = minhas.find((p) => p.turno === "manha");
  const tarde = minhas.find((p) => p.turno === "tarde");
  const anyPresente =
    manha?.status === "na_empresa" || tarde?.status === "na_empresa" ||
    manha?.status === "saiu" || tarde?.status === "saiu";
  if (anyPresente) {
    return { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Presente hoje", tone: "success" };
  }
  if (manha?.status === "falta" || tarde?.status === "falta") {
    return { icon: <XCircle className="h-3.5 w-3.5" />, label: "Faltou hoje", tone: "danger" };
  }
  return { icon: <Clock className="h-3.5 w-3.5" />, label: "Sem registro hoje", tone: "muted" };
}
