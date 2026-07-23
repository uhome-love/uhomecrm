import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Copy, Phone, MessageSquare, SkipForward, PhoneOff, CheckCircle2,
  CalendarPlus, XCircle, Loader2, Sparkles, Building2, Tag, Clock,
} from "lucide-react";
import type { useMutiraoSession } from "@/hooks/useMutiraoSession";
import { supabase } from "@/integrations/supabase/client";

const BALDE_META: Record<string, { label: string; className: string }> = {
  verde_hot: { label: "🔥 Verde Quente", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  verde: { label: "🟢 Verde", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  amarelo: { label: "🟡 Amarelo", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
};

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function LeadCard({
  ms,
  onSemInteresse,
  onAgendarVisita,
  onOpenFilters,
}: {
  ms: ReturnType<typeof useMutiraoSession>;
  onSemInteresse: () => void;
  onAgendarVisita: () => void;
  onOpenFilters?: () => void;
}) {
  const [dossie, setDossie] = useState<string | null>(null);
  const [dossieLoading, setDossieLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => { setDossie(null); }, [ms.current?.lead.id]);

  const lead = ms.current?.lead;

  const callSeconds = ms.callStart
    ? Math.floor(((ms.callEnd ?? Date.now()) - ms.callStart) / 1000)
    : 0;

  async function gerarDossie() {
    if (!lead) return;
    setDossieLoading(true);
    try {
      // Reusa homi-copilot / generate-script para insight rápido
      const { data, error } = await supabase.functions.invoke("homi-copilot", {
        body: { mode: "dossie_oferta", pipeline_lead_id: lead.id },
      });
      if (error) throw error;
      const texto = (data as any)?.texto || (data as any)?.mensagem || "Sem insights disponíveis.";
      setDossie(texto);
    } catch (e: any) {
      setDossie("Não consegui gerar o dossiê agora. Use o script como base.");
    } finally {
      setDossieLoading(false);
    }
  }

  const copyPhone = () => {
    if (!lead?.telefone) return;
    navigator.clipboard.writeText(lead.telefone);
    toast.success("Telefone copiado");
  };
  const openWhats = () => {
    if (!lead?.telefone_normalizado) return toast.info("Sem telefone válido");
    window.open(`https://wa.me/${lead.telefone_normalizado}`, "_blank");
  };

  if (!ms.current || !lead) {
    const noLeads = !!ms.noLeadsReason;
    const hasFilters = (ms.filters.empreendimento_ids.length + ms.filters.segmento_ids.length) > 0;
    return (
      <div className="rounded-2xl border border-border p-8 text-center bg-card">
        <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary" />
        {noLeads ? (
          <>
            <p className="text-lg font-semibold mb-2">Sem leads disponíveis com esses filtros</p>
            <p className="text-sm text-muted-foreground mb-4">
              {hasFilters
                ? "Nenhum lead na fila corresponde aos empreendimentos/segmentos escolhidos ou já estão em cooldown."
                : "A fila está temporariamente vazia. Tente novamente em instantes."}
            </p>
            <div className="flex items-center justify-center gap-2">
              {onOpenFilters && (
                <Button size="lg" onClick={onOpenFilters}>
                  Trocar seleção
                </Button>
              )}
              <Button size="lg" variant="outline" onClick={() => { ms.clearNoLeads(); ms.proximoLead(undefined); }} disabled={ms.proximoLeadPending}>
                {ms.proximoLeadPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Tentar de novo
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold mb-3">Pronto para começar?</p>
            <p className="text-sm text-muted-foreground mb-4">
              Vamos pescar um lead descartado com alta chance de reativação.
            </p>
            <Button size="lg" onClick={() => ms.proximoLead(undefined)} disabled={ms.proximoLeadPending}>
              {ms.proximoLeadPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Puxar próximo lead
            </Button>
          </>
        )}
      </div>
    );
  }

  const balde = BALDE_META[ms.current.balde] ?? BALDE_META.verde;
  const resultBtnsDisabled = ms.callState !== "ended";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className={`px-4 py-2 text-xs font-semibold border-b flex items-center justify-between ${balde.className}`}>
        <span>{balde.label}</span>
        {lead.dias_desde_descarte != null && (
          <span className="text-xs opacity-80">Descartado há {lead.dias_desde_descarte}d</span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Nome + telefone */}
        <div>
          <h2 className="text-2xl font-bold leading-tight">{lead.nome || "Sem nome"}</h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-lg font-mono text-muted-foreground">{lead.telefone || "—"}</span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copyPhone}>
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={openWhats}>
              <MessageSquare className="w-3.5 h-3.5 mr-1" /> WhatsApp
            </Button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {lead.empreendimento_canonico?.nome && (
            <Badge variant="outline" className="gap-1"><Building2 className="w-3 h-3" />{lead.empreendimento_canonico.nome}</Badge>
          )}
          {lead.segmento?.nome && <Badge variant="outline" className="gap-1"><Tag className="w-3 h-3" />{lead.segmento.nome}</Badge>}
          {lead.motivo_descarte && (
            <Badge variant="outline" className="max-w-[280px] truncate" title={lead.motivo_descarte}>
              Motivo: {lead.motivo_descarte}
            </Badge>
          )}
          {lead.campanha && <Badge variant="outline" className="max-w-[220px] truncate" title={lead.campanha}>Campanha: {lead.campanha}</Badge>}
        </div>

        {/* Dossiê IA */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-primary" /> Dossiê rápido</p>
            {!dossie && (
              <Button size="sm" variant="ghost" onClick={gerarDossie} disabled={dossieLoading}>
                {dossieLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Gerar com IA"}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {dossie ?? "Clique em 'Gerar com IA' para um resumo do lead e a melhor abordagem."}
          </p>
        </div>

        {/* Botão ligar / cronômetro */}
        <div className="flex items-center gap-3">
          {ms.callState === "idle" && (
            <Button size="lg" className="flex-1" onClick={ms.startCall}>
              <Phone className="w-5 h-5 mr-2" /> Ligar agora
            </Button>
          )}
          {ms.callState === "in_call" && (
            <div className="flex-1 flex items-center gap-3 rounded-lg border-2 border-primary bg-primary/5 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">Em ligação — {fmtDuration(callSeconds)}</span>
              <Button size="sm" variant="destructive" className="ml-auto" onClick={ms.endCall}>
                <PhoneOff className="w-4 h-4 mr-1" /> Encerrar ligação
              </Button>
            </div>
          )}
          {ms.callState === "ended" && (
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm">Ligação encerrada ({fmtDuration(callSeconds)}) — registre o resultado</span>
            </div>
          )}
          <Button size="lg" variant="outline" onClick={() => ms.pular()} disabled={ms.registrarPending}>
            <SkipForward className="w-4 h-4 mr-1" /> Pular
          </Button>
        </div>

        {/* Botões de resultado — bloqueados até encerrar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
          <Button
            variant="default"
            disabled={resultBtnsDisabled || ms.registrarPending}
            onClick={() => ms.registrar({ resultado: "aproveitado", observacao: "Aproveitado no mutirão" })}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" /> Aproveitar (+4)
          </Button>
          <Button
            variant="default"
            disabled={resultBtnsDisabled || ms.registrarPending}
            onClick={onAgendarVisita}
            className="bg-primary"
          >
            <CalendarPlus className="w-4 h-4 mr-1" /> Agendar visita (+10)
          </Button>
          <Button
            variant="outline"
            disabled={resultBtnsDisabled || ms.registrarPending}
            onClick={() => ms.registrar({ resultado: "nao_atendeu" })}
            className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
          >
            <Clock className="w-4 h-4 mr-1" /> Não atendeu (+1)
          </Button>
          <Button
            variant="outline"
            disabled={resultBtnsDisabled || ms.registrarPending}
            onClick={onSemInteresse}
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <XCircle className="w-4 h-4 mr-1" /> Sem interesse (+1)
          </Button>
        </div>
      </div>
    </div>
  );
}
