import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBRT } from "@/lib/brtTime";
import { Loader2, History, CheckCircle2, CalendarCheck2, PhoneOff, SkipForward, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RESULTADO_META: Record<string, { label: string; icon: any; className: string }> = {
  aproveitado:      { label: "Aproveitado",   icon: CheckCircle2,   className: "text-success-500" },
  visita_agendada:  { label: "Visita",        icon: CalendarCheck2, className: "text-warning-500" },
  nao_atendeu:      { label: "Não atendeu",   icon: PhoneOff,       className: "text-warning-500" },
  pulado:           { label: "Pulado",        icon: SkipForward,    className: "text-muted-foreground" },
  sem_interesse:    { label: "Sem interesse", icon: XCircle,        className: "text-destructive" },
};

interface HistoricoItem {
  ligacao_id: string;
  pipeline_lead_id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  motivo_descarte: string | null;
  resultado: string;
  observacao: string | null;
  ligacao_em: string;
  pode_aproveitar: boolean;
  motivo_indisponivel: string | null;
}

export function HistoricoPanel({ sessaoId, paused }: { sessaoId: string | null; paused?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["mutirao", "historico", sessaoId],
    enabled: !!sessaoId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "oferta-ativa-historico-reaproveitar",
        { body: { sessao_id: sessaoId, action: "list" } },
      );
      if (error) throw error;
      return data as { ok: boolean; itens: HistoricoItem[] };
    },
    refetchInterval: paused ? false : 60_000,
  });

  const aproveitarM = useMutation({
    mutationFn: async (pipeline_lead_id: string) => {
      const { data, error } = await supabase.functions.invoke(
        "oferta-ativa-historico-reaproveitar",
        { body: { sessao_id: sessaoId, action: "aproveitar", pipeline_lead_id } },
      );
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      if (data?.error === "DUPLICATE_ACTIVE") {
        toast.error("Este lead já foi aproveitado por outro corretor.");
      } else if (data?.ok) {
        const stage = data?.target_stage_name ?? "Novo Lead";
        toast.success(`Lead aproveitado — foi para o seu pipeline na etapa ${stage}`, {
          description: "Localize-o no pipeline para dar sequência.",
          duration: 6000,
        });
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["mutirao", "ranking"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao aproveitar"),
  });

  const itens = data?.itens ?? [];

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
        <History className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Histórico</p>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">Últimas 24h</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center px-4 py-8">
          Nada registrado nesta sessão ainda.
        </p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1.5">
          {itens.map((it) => {
            const meta = RESULTADO_META[it.resultado] ?? RESULTADO_META.pulado;
            const Icon = meta.icon;
            const jaAproveitado = it.resultado === "aproveitado" || it.resultado === "visita_agendada";
            const showAproveitar = !jaAproveitado;
            return (
              <div key={it.ligacao_id} className="px-3 py-2 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-foreground truncate">{it.nome}</p>
                      <Badge variant="outline" className={cn("h-4 gap-1 text-[10px]", meta.className)}>
                        <Icon className="w-2.5 h-2.5" />{meta.label}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      {it.telefone} · {formatBRT(it.ligacao_em, "HH:mm")}
                    </p>
                    {it.empreendimento && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{it.empreendimento}</p>
                    )}
                  </div>
                  {showAproveitar && (
                    <Button
                      size="sm"
                      variant={it.pode_aproveitar ? "default" : "outline"}
                      disabled={!it.pode_aproveitar || aproveitarM.isPending}
                      onClick={() => aproveitarM.mutate(it.pipeline_lead_id)}
                      className="shrink-0 h-7 text-xs"
                      title={it.pode_aproveitar ? "Reativar para o meu pipeline" : "Já atribuído a outro corretor"}
                    >
                      {aproveitarM.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : it.pode_aproveitar ? "Aproveitar" : "Já atribuído"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
