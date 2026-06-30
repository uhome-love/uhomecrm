import { useQuery } from "@tanstack/react-query";
import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  leadId: string;
  stageTipo?: string | null;
}

interface EstagnacaoStatus {
  tem_config: boolean;
  dias_limite?: number;
  dias_sem_acao?: number;
  dias_para_estagnar?: number;
  categoria?: "tranquilo" | "atencao" | "em_aviso" | "estagnado";
  protegido?: boolean;
}

/**
 * Aviso compacto no modal do lead: quantos dias está sem atualização e
 * quantos faltam para estagnar. Não aparece na etapa "Sem Contato"
 * (que já tem o card de cadência) nem em descarte.
 */
export default function EstagnacaoStatusCard({ leadId, stageTipo }: Props) {
  const hidden = stageTipo === "sem_contato" || stageTipo === "descarte";

  const { data } = useQuery({
    queryKey: ["lead-estagnacao-status", leadId],
    queryFn: async (): Promise<EstagnacaoStatus> => {
      const { data, error } = await supabase.rpc("get_lead_estagnacao_status", {
        p_lead_id: leadId,
      });
      if (error) throw error;
      return (data ?? { tem_config: false }) as EstagnacaoStatus;
    },
    enabled: !hidden,
    staleTime: 60_000,
  });

  if (hidden || !data?.tem_config) return null;

  const diasSem = data.dias_sem_acao ?? 0;
  const diasPara = data.dias_para_estagnar ?? 0;
  const cat = data.categoria ?? "tranquilo";

  const semLabel = diasSem === 0 ? "Atualizado hoje" : `${diasSem} dia${diasSem > 1 ? "s" : ""} sem atualização`;

  let tone: { wrap: string; icon: string; badge: string };
  let Icon = Clock;
  let prazoLabel: string;

  if (data.protegido) {
    tone = {
      wrap: "border-success/30 bg-success/5",
      icon: "bg-success/15 text-success",
      badge: "bg-success/15 text-success",
    };
    Icon = CheckCircle2;
    prazoLabel = "Tarefa agendada — contagem pausada";
  } else if (cat === "estagnado") {
    tone = {
      wrap: "border-destructive/30 bg-destructive/5",
      icon: "bg-destructive/15 text-destructive",
      badge: "bg-destructive/15 text-destructive",
    };
    Icon = AlertTriangle;
    prazoLabel = "Lead estagnado";
  } else if (cat === "em_aviso") {
    tone = {
      wrap: "border-destructive/30 bg-destructive/5",
      icon: "bg-destructive/15 text-destructive",
      badge: "bg-destructive/15 text-destructive",
    };
    Icon = AlertTriangle;
    prazoLabel = "Aviso final · aja em 48h para não estagnar";
  } else if (cat === "atencao") {
    tone = {
      wrap: "border-warning/30 bg-warning/5",
      icon: "bg-warning/15 text-warning",
      badge: "bg-warning/15 text-warning",
    };
    Icon = AlertTriangle;
    prazoLabel =
      diasPara <= 0
        ? "Estagna a qualquer momento"
        : `Faltam ${diasPara} dia${diasPara > 1 ? "s" : ""} para estagnar`;
  } else {
    tone = {
      wrap: "border-border bg-muted/30",
      icon: "bg-primary/10 text-primary",
      badge: "bg-muted text-muted-foreground",
    };
    Icon = Clock;
    prazoLabel = `Faltam ${diasPara} dia${diasPara > 1 ? "s" : ""} para estagnar`;
  }

  return (
    <div className={`rounded-xl border p-3 ${tone.wrap}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground leading-tight">{semLabel}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{prazoLabel}</p>
        </div>
        {!data.protegido && cat !== "estagnado" && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.badge}`}>
            {diasPara <= 0 ? "agora" : `${diasPara}d`}
          </span>
        )}
      </div>
    </div>
  );
}
