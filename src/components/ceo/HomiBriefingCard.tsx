import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { RefreshCw, Target, TrendingUp, AlertTriangle, CheckCircle2, Brain, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface BriefingData {
  status_geral: string;
  frase_do_dia: string;
  destaques: string[];
  alertas: string[];
  acao_prioritaria: string;
  previsao: string;
  gerado_em?: string;
}

interface Props {
  dashboardData: Record<string, any>;
}

const STORAGE_KEY = "homi-briefing-collapsed";

export default function HomiBriefingCard({ dashboardData }: Props) {
  const { user, session } = useAuth();
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isOpen, setIsOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "open"; } catch { return false; }
  });

  const handleToggle = (open: boolean) => {
    setIsOpen(open);
    try { localStorage.setItem(STORAGE_KEY, open ? "open" : "closed"); } catch {}
  };

  const today = new Date().toISOString().slice(0, 10);

  // Load existing briefing
  const loadBriefing = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("homi_briefing_diario")
      .select("*")
      .eq("data", today)
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setBriefing({
        status_geral: data.status_geral || "🟡 Atenção",
        frase_do_dia: data.frase_do_dia || "",
        destaques: (data.destaques as string[]) || [],
        alertas: (data.alertas as string[]) || [],
        acao_prioritaria: data.acao_prioritaria || "",
        previsao: data.previsao || "",
        gerado_em: data.gerado_em,
      });
      setLoading(false);
      return true;
    }
    setLoading(false);
    return false;
  }, [user, today]);

  const generateBriefing = useCallback(async () => {
    if (!session?.access_token) return;
    setGenerating(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/homi-briefing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ dashboardData }),
        }
      );

      if (!resp.ok) {
        if (resp.status === 429) { toast.error("Rate limit. Tente novamente em instantes."); return; }
        if (resp.status === 402) { toast.error("Créditos insuficientes."); return; }
        throw new Error("Erro ao gerar briefing");
      }

      const data = await resp.json();
      if (data.briefing) {
        setBriefing({ ...data.briefing, gerado_em: new Date().toISOString() });
        toast.success("Briefing gerado!");
      }
    } catch {
      toast.error("Erro ao gerar briefing");
    } finally {
      setGenerating(false);
    }
  }, [session, dashboardData]);

  // Auto-load on mount, auto-generate if none exists
  useEffect(() => {
    loadBriefing().then(exists => {
      if (!exists && Object.keys(dashboardData).length > 0) {
        generateBriefing();
      }
    });
  }, [loadBriefing]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusColor = briefing?.status_geral?.includes("🟢")
    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
    : briefing?.status_geral?.includes("🔴")
      ? "bg-red-100 text-red-800 border-red-300"
      : "bg-amber-100 text-amber-800 border-amber-300";

  if (loading || generating) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20">
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            <span className="text-sm font-semibold">
              {generating ? "🧠 HOMI está analisando..." : "Carregando briefing..."}
            </span>
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card className="border-primary/20">
        <CardContent className="pt-4 flex flex-col items-center gap-3 py-6">
          <Brain className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Briefing diário não disponível</p>
          <Button size="sm" onClick={generateBriefing} disabled={generating}>
            <Brain className="h-3.5 w-3.5 mr-1" /> Gerar Briefing
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={handleToggle}>
      <Card className="border-primary/20 bg-gradient-to-br from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between px-6 pt-4 pb-3 cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Brain className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-bold truncate">🧠 HOMI · Briefing de hoje</span>
              {briefing.gerado_em && (
                <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
                  {format(new Date(briefing.gerado_em), "HH:mm")}
                </span>
              )}
              <Badge className={`text-[10px] shrink-0 border ${statusColor}`}>
                {briefing.status_geral}
              </Badge>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="text-xs gap-1"
                onClick={(e) => { e.stopPropagation(); generateBriefing(); }}
                disabled={generating}
              >
                <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Regenerar</span>
              </Button>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
          <CardContent className="pt-0 pb-4 space-y-3">
            {/* Frase do dia */}
            {briefing.frase_do_dia && (
              <p className="text-xs italic text-muted-foreground border-l-2 border-primary/30 pl-2">
                "{briefing.frase_do_dia}"
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Destaques */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Destaques
                </p>
                {briefing.destaques.map((d, i) => (
                  <div key={i} className="text-[11px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-md px-2.5 py-1.5 border border-emerald-200/50 dark:border-emerald-800/30">
                    {d}
                  </div>
                ))}
              </div>

              {/* Alertas */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold flex items-center gap-1 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alertas
                </p>
                {briefing.alertas.map((a, i) => (
                  <div key={i} className="text-[11px] bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-md px-2.5 py-1.5 border border-amber-200/50 dark:border-amber-800/30">
                    {a}
                  </div>
                ))}
              </div>
            </div>

            {/* Ação prioritária */}
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/30 rounded-lg p-3">
              <p className="text-xs font-semibold flex items-center gap-1 text-blue-700 dark:text-blue-400 mb-1">
                <Target className="h-3.5 w-3.5" /> Ação Prioritária
              </p>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-200">{briefing.acao_prioritaria}</p>
            </div>

            {/* Previsão */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
              <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{briefing.previsao}</span>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
