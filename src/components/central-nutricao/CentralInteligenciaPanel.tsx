import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, ShieldCheck, TrendingUp, RefreshCw } from "lucide-react";

type NumberHealth = {
  display_phone_number?: string | null;
  verified_name?: string | null;
  quality_rating?: string;
  messaging_limit_tier?: string | null;
  messaging_limit?: number | null;
  name_status?: string | null;
  throughput?: { level?: string } | null;
  fetched_at?: string;
  error?: string;
};

type ListaDeliverability = {
  lista_id: string;
  nome: string;
  empreendimento: string | null;
  total: number;
  limpos: number;
  em_cooldown: number;
  bloqueados: number;
  pipeline_ativos: number;
};

function qualityTone(rating?: string) {
  switch ((rating || "").toUpperCase()) {
    case "GREEN": return { label: "Verde", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
    case "YELLOW": return { label: "Amarelo", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" };
    case "RED": return { label: "Vermelho", cls: "bg-red-500/15 text-red-600 border-red-500/30" };
    default: return { label: "—", cls: "bg-muted text-muted-foreground border-border" };
  }
}

/**
 * Painel de inteligência da Central de Reengajamento:
 * - Saúde do número Meta (quality rating / tier)
 * - Recomendação da melhor lista para disparar agora (mais limpos elegíveis)
 */
export default function CentralInteligenciaPanel({
  onSelecionarLista,
}: {
  onSelecionarLista?: (listaId: string) => void;
}) {
  const { data: health, isFetching: loadingHealth, refetch: refetchHealth } = useQuery<NumberHealth>({
    queryKey: ["meta-number-quality"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-number-quality", { body: {} });
      if (error) throw error;
      return data as NumberHealth;
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60 * 1000,
  });

  const { data: listas, isFetching: loadingListas, refetch: refetchListas } = useQuery<ListaDeliverability[]>({
    queryKey: ["reengajamento-deliverability-listas"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("reengajamento_deliverability_listas");
      if (error) throw error;
      return (data || []) as ListaDeliverability[];
    },
    refetchInterval: 60 * 1000,
  });

  const tone = qualityTone(health?.quality_rating);
  const melhores = (listas || []).filter((l) => l.limpos > 0).slice(0, 5);
  const tierLabel = health?.messaging_limit === -1
    ? "Ilimitado"
    : health?.messaging_limit
      ? health.messaging_limit.toLocaleString("pt-BR")
      : (health?.messaging_limit_tier || "—");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Saúde do número */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Saúde do número
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchHealth()} disabled={loadingHealth}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingHealth ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {health?.error ? (
            <p className="text-sm text-muted-foreground">Não foi possível ler a saúde do número.</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{health?.verified_name || "—"}</span>
                <span className="text-xs text-muted-foreground">{health?.display_phone_number || ""}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={tone.cls}>Qualidade: {tone.label}</Badge>
                <Badge variant="outline">Limite/24h: {tierLabel}</Badge>
                {health?.throughput?.level && <Badge variant="outline">Throughput: {health.throughput.level}</Badge>}
              </div>
              {(health?.quality_rating || "").toUpperCase() === "GREEN" ? (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Número saudável. Falhas 131049 são limite de frequência por destinatário — respeite o cooldown e o aquecimento.
                </p>
              ) : (
                <p className="text-xs text-amber-600">Atenção: reduza o volume e priorize listas limpas até a qualidade voltar ao verde.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Melhor lista para disparar agora */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Melhor lista para disparar agora
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => refetchListas()} disabled={loadingListas}>
              <RefreshCw className={`h-3.5 w-3.5 ${loadingListas ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingListas && !listas ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calculando entregabilidade…</div>
          ) : melhores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma lista com contatos limpos elegíveis no momento.</p>
          ) : (
            melhores.map((l, i) => (
              <div key={l.lista_id} className={`rounded-lg border p-2.5 ${i === 0 ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="text-emerald-600 font-medium">{l.limpos.toLocaleString("pt-BR")} limpos</span>
                      {" · "}{l.em_cooldown} cooldown · {l.bloqueados} bloqueados · {l.pipeline_ativos} no pipeline
                    </p>
                  </div>
                  {onSelecionarLista && (
                    <Button size="sm" variant={i === 0 ? "default" : "outline"} onClick={() => onSelecionarLista(l.lista_id)}>
                      Selecionar
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
