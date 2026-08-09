import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";
import { formatBRT } from "@/lib/brtTime";

type Audience = {
  id: string;
  segmento_chave: string;
  nome: string;
  meta_custom_audience_id: string | null;
  ultima_sync_at: string | null;
  ultimo_total_elegivel: number | null;
  ultimo_total_enviado: number | null;
  auto_sync: boolean;
  ativo: boolean;
};

type Run = {
  id: string;
  segmento_chave: string | null;
  dry_run: boolean;
  total_elegivel: number | null;
  enviados: number | null;
  invalidos: number | null;
  erro: string | null;
  created_at: string;
};

function fmtDate(v: string | null) {
  if (!v) return "—";
  try {
    return formatBRT(v, "dd/MM HH:mm");
  } catch {
    return new Date(v).toLocaleString("pt-BR");
  }
}

/**
 * Card "Públicos do Meta (Custom Audiences)" — Configurações → Integrações.
 * Admin/diretor: liga/desliga o sync diário e dispara sync manual por segmento.
 */
export default function MetaAudiencesCard() {
  const qc = useQueryClient();
  const [syncing, setSyncing] = useState<string | null>(null);

  const { data: audiences, isLoading } = useQuery({
    queryKey: ["meta-audiences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_audiences")
        .select("id, segmento_chave, nome, meta_custom_audience_id, ultima_sync_at, ultimo_total_elegivel, ultimo_total_enviado, auto_sync, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Audience[];
    },
  });

  const { data: runs } = useQuery({
    queryKey: ["meta-audience-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meta_audience_runs")
        .select("id, segmento_chave, dry_run, total_elegivel, enviados, invalidos, erro, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as unknown as Run[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from("meta_audiences").update({ auto_sync: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta-audiences"] });
      toast.success("Sincronização automática atualizada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  async function syncNow(seg: string) {
    setSyncing(seg);
    try {
      const { data: session } = await (supabase.auth as any).getSession();
      const { data, error } = await supabase.functions.invoke("meta-audience-sync", {
        body: { segmento_chave: seg, dry_run: false },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error?.message || data?.error || "Falha no envio");
      toast.success(`Público sincronizado: ${data?.enviados ?? data?.total_elegivel ?? 0} contatos`);
      qc.invalidateQueries({ queryKey: ["meta-audiences"] });
      qc.invalidateQueries({ queryKey: ["meta-audience-runs"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar público");
    }
    setSyncing(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Públicos do Meta (Custom Audiences)
        </CardTitle>
        <CardDescription>
          Atualiza a lista de contatos dos públicos no Meta. Não cria campanha nem altera anúncios.
          Sincronização automática diária às 06:00 (BRT).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {(audiences ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{a.nome}</p>
                    {a.meta_custom_audience_id ? (
                      <Badge variant="secondary" className="text-[10px]">ID {a.meta_custom_audience_id}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">nunca enviado</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {a.segmento_chave} · elegíveis: {a.ultimo_total_elegivel ?? "—"} · enviados:{" "}
                    {a.ultimo_total_enviado ?? "—"} · última sync: {fmtDate(a.ultima_sync_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">Auto</span>
                    <Switch
                      checked={a.auto_sync}
                      onCheckedChange={(v) => toggle.mutate({ id: a.id, value: v })}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    disabled={syncing === a.segmento_chave}
                    onClick={() => syncNow(a.segmento_chave)}
                  >
                    {syncing === a.segmento_chave ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Sincronizar agora
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Últimas execuções</p>
          {(runs ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma execução registrada.</p>
          ) : (
            <div className="space-y-1">
              {(runs ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-1.5">
                  <span className="text-[11px] truncate">
                    {fmtDate(r.created_at)} · {r.segmento_chave ?? "—"} {r.dry_run ? "(simulação)" : ""}
                  </span>
                  <span className={`text-[11px] ${r.erro ? "text-destructive" : "text-muted-foreground"}`}>
                    {r.erro ? r.erro : `${r.enviados ?? 0} enviados · ${r.invalidos ?? 0} inválidos`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
