import { useState, useCallback, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId: string;
  stageTipo: string;
  flagStatus: Record<string, string> | null;
  onUpdate?: (flags: Record<string, string>) => void;
}

export default function LeadFlagControls({ leadId, stageTipo, flagStatus, onUpdate }: Props) {
  const [flags, setFlags] = useState<Record<string, string>>(flagStatus || {});

  useEffect(() => {
    setFlags(flagStatus || {});
  }, [flagStatus]);

  const save = useCallback(async (updated: Record<string, string>) => {
    setFlags(updated);
    const { error } = await supabase
      .from("pipeline_leads")
      .update({ flag_status: updated } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao salvar flag");
    } else {
      onUpdate?.(updated);
    }
  }, [leadId, onUpdate]);

  const setFlag = (key: string, value: string) => save({ ...flags, [key]: value });
  const toggleFlag = (key: string) => {
    const updated = { ...flags };
    updated[key] = updated[key] === "sim" ? "nao" : "sim";
    save(updated);
  };

  const wrapper = (children: React.ReactNode) => (
    <div className="mx-5 my-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-primary mb-2">📋 Status da Etapa</p>
      <div className="flex items-center gap-3 flex-wrap">
        {children}
      </div>
    </div>
  );

  if (stageTipo === "sem_contato") {
    return wrapper(
      <>
        <Label className="text-xs font-medium text-muted-foreground">Tentativas:</Label>
        <Select value={flags.tentativas || "0"} onValueChange={(v) => setFlag("tentativas", v)}>
          <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[0,1,2,3,4,5,6,7].map(n => <SelectItem key={n} value={String(n)} className="text-xs">{n}/7</SelectItem>)}
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
          <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30" className="text-xs">30 dias</SelectItem>
            <SelectItem value="60" className="text-xs">60 dias</SelectItem>
            <SelectItem value="90" className="text-xs">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </>
    );
  }

  if (stageTipo === "visita") {
    return wrapper(
      <>
        <Label className="text-xs text-muted-foreground">Status visita:</Label>
        <Select value={flags.status_visita || ""} onValueChange={(v) => setFlag("status_visita", v)}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="marcada" className="text-xs">📅 Marcada</SelectItem>
            <SelectItem value="realizada" className="text-xs">✅ Realizada</SelectItem>
            <SelectItem value="no_show" className="text-xs">❌ No-show</SelectItem>
            <SelectItem value="reagendada" className="text-xs">🔁 Reagendada</SelectItem>
          </SelectContent>
        </Select>
      </>
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
