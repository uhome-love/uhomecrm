import { useState, useCallback, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logSubstatusChange } from "@/lib/pipelineAudit";
import {
  QUALIFICACAO_SUBSTATUS,
  AQUECIMENTO_SUBSTATUS,
  VISITA_SUBSTATUS,
} from "@/lib/leadHelpers";

interface Props {
  leadId: string;
  stageTipo: string;
  flagStatus: Record<string, string> | null;
  onUpdate?: (flags: Record<string, string>) => void;
}

export default function LeadFlagControls({ leadId, stageTipo, flagStatus, onUpdate }: Props) {
  const { user } = useAuth();
  const [flags, setFlags] = useState<Record<string, string>>(flagStatus || {});

  useEffect(() => {
    setFlags(flagStatus || {});
  }, [flagStatus]);

  const save = useCallback(async (updated: Record<string, string>, changedKey?: string, oldValue?: string) => {
    setFlags(updated);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ flag_status: updated } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao salvar flag");
      return;
    }
    onUpdate?.(updated);
    // Auditoria: registra a alteração de substatus no Histórico do lead.
    if (changedKey && user?.id) {
      logSubstatusChange({
        pipelineLeadId: leadId,
        userId: user.id,
        field: changedKey,
        oldValue: oldValue ?? null,
        newValue: updated[changedKey] ?? null,
      });
    }
  }, [leadId, onUpdate, user?.id]);

  const setFlag = (key: string, value: string) => save({ ...flags, [key]: value }, key, flags[key]);
  const toggleFlag = (key: string) => {
    const oldValue = flags[key];
    const updated = { ...flags };
    updated[key] = updated[key] === "sim" ? "nao" : "sim";
    save(updated, key, oldValue);
  };

  const wrapper = (children: React.ReactNode) => (
    <div className="mx-5 my-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-primary mb-2">📋 Status da Etapa</p>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
      </div>
    </div>
  );

  // Etapa "Sem Contato": tentativas são controladas automaticamente pela cadência
  // do CRM (lead_cadencia_sem_contato). Não há seletor manual aqui para evitar
  // duplicação com o badge automático.
  if (stageTipo === "sem_contato") {
    return null;
  }

  if (stageTipo === "qualificacao") {
    return wrapper(
      <>
        <Label className="text-xs text-muted-foreground">Substatus:</Label>
        <Select value={flags.status_atendimento || ""} onValueChange={(v) => setFlag("status_atendimento", v)}>
          <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {QUALIFICACAO_SUBSTATUS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    );
  }

  if (stageTipo === "contato_inicial") {
    return wrapper(
      <>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Impressão:</Label>
          <Select value={flags.impressao || ""} onValueChange={(v) => setFlag("impressao", v)}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gostou" className="text-xs">👍 Gostou</SelectItem>
              <SelectItem value="nao_gostou" className="text-xs">👎 Não gostou</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Intenção:</Label>
          <Select value={flags.intencao || ""} onValueChange={(v) => setFlag("intencao", v)}>
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="morar" className="text-xs">🏠 Morar</SelectItem>
              <SelectItem value="investir" className="text-xs">💰 Investir</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (stageTipo === "busca") {
    return wrapper(
      <>
        <Label className="text-xs text-muted-foreground">Status:</Label>
        <Select value={flags.status_busca || ""} onValueChange={(v) => setFlag("status_busca", v)}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="busca_pendente" className="text-xs">🔍 Busca pendente</SelectItem>
            <SelectItem value="imoveis_enviados" className="text-xs">📨 Imóveis enviados</SelectItem>
          </SelectContent>
        </Select>
      </>
    );
  }

  if (stageTipo === "aquecimento") {
    return wrapper(
      <>
        <Label className="text-xs text-muted-foreground">Prazo recontato:</Label>
        <Select value={flags.prazo || ""} onValueChange={(v) => setFlag("prazo", v)}>
          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            {AQUECIMENTO_SUBSTATUS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    );
  }

  if (stageTipo === "visita") {
    // Sub-status da Visita é dirigido EXCLUSIVAMENTE pela Agenda de visitas
    // (marcar / no-show / resultado). Aqui é somente-leitura.
    const visitaLabelMap: Record<string, string> = {
      ...Object.fromEntries(VISITA_SUBSTATUS.map((o) => [o.value, o.label])),
      reagendada: "🔁 Reagendada",
    };
    const atual = flags.status_visita ? (visitaLabelMap[flags.status_visita] || flags.status_visita) : "—";
    return wrapper(
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status visita:</Label>
          <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 px-2 py-0.5 text-xs font-semibold">
            {atual}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground/70">Atualizado pela Agenda de visitas</span>
      </div>
    );
  }

  if (stageTipo === "pos_visita") {
    return wrapper(
      <>
        <div className="flex items-center gap-1.5">
          <Checkbox checked={flags.feedback_coletado === "sim"} onCheckedChange={() => toggleFlag("feedback_coletado")} className="h-3.5 w-3.5" />
          <Label className="text-[10px] text-muted-foreground cursor-pointer">Feedback</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox checked={flags.simulacao_enviada === "sim"} onCheckedChange={() => toggleFlag("simulacao_enviada")} className="h-3.5 w-3.5" />
          <Label className="text-[10px] text-muted-foreground cursor-pointer">Simulação</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Checkbox checked={flags.objecoes_mapeadas === "sim"} onCheckedChange={() => toggleFlag("objecoes_mapeadas")} className="h-3.5 w-3.5" />
          <Label className="text-[10px] text-muted-foreground cursor-pointer">Objeções</Label>
        </div>
        <Select value={flags.interesse || ""} onValueChange={(v) => setFlag("interesse", v)}>
          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Interesse" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alto" className="text-xs">🔥 Alto</SelectItem>
            <SelectItem value="medio" className="text-xs">🟡 Médio</SelectItem>
            <SelectItem value="baixo" className="text-xs">❄️ Baixo</SelectItem>
          </SelectContent>
        </Select>
      </>
    );
  }

  return null;
}
