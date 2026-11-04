import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Clock, Filter, Hourglass, Brain, ShieldCheck, Send, MessageCircle, Flame, CalendarCheck, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BALDE_ROTULO, CADENCIA, RECUPERA_CONFIG, grupoDoBalde } from "@/lia/recupera";

type ResumoRow = { balde: string; produto_slug: string | null; n: number };
const DESCARTE_STAGE = "1dd66c25-3848-4053-9f66-82e902989b4d";

function useResumo() {
  return useQuery({
    queryKey: ["lia-hub", "recupera-resumo"],
    queryFn: async () => {
      // view da base da Lia, ainda fora dos tipos gerados
      const sb = supabase as unknown as { from: (t: string) => { select: (c: string) => Promise<{ data: ResumoRow[] | null; error: Error | null }> } };
      const { data, error } = await sb.from("lia_reengajamento_resumo").select("balde, produto_slug, n");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAguardando24h() {
  return useQuery({
    queryKey: ["lia-hub", "recupera-24h"],
    queryFn: async () => {
      const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { count, error } = await supabase
        .from("pipeline_leads")
        .select("id", { count: "exact", head: true })
        .eq("stage_id", DESCARTE_STAGE)
        .gte("stage_changed_at", desde);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

const FUNIL = [
  { rotulo: "Enviados", icon: Send },
  { rotulo: "Responderam", icon: MessageCircle },
  { rotulo: "Quentes → Roleta", icon: Flame },
  { rotulo: "Visitas", icon: CalendarCheck },
  { rotulo: "Vendas", icon: Trophy },
];

export default function LiaRecuperaTab() {
  const { data: resumo, isLoading } = useResumo();
  const { data: aguardando } = useAguardando24h();

  const porBalde = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of resumo ?? []) m.set(r.balde, (m.get(r.balde) ?? 0) + Number(r.n || 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [resumo]);
  const elegiveis = porBalde.filter(([b]) => grupoDoBalde(b) === "entra").reduce((s, [, n]) => s + n, 0);
  const espera90 = porBalde.filter(([b]) => grupoDoBalde(b) === "espera_90").reduce((s, [, n]) => s + n, 0);
  const max = porBalde[0]?.[1] ?? 1;

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Recuperação automática de descartados</p>
            <p className="text-xs text-muted-foreground">
              A Lia chama o cliente {RECUPERA_CONFIG.esperaHoras}h depois do descarte, entende o momento e devolve à Roleta só quem reaquecer.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">Em preparação · liga após validar o cérebro</Badge>
          <Switch checked={false} disabled aria-label="Recuperação automática (desligada)" />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi titulo="Prontos para receber" valor={isLoading ? null : elegiveis} dica="Descartados que entram na recuperação" icon={Filter} />
        <Kpi titulo="Aguardando 24h" valor={aguardando ?? null} dica="Descartados nas últimas 24 horas" icon={Hourglass} />
        <Kpi titulo="Esperam 90 dias" valor={isLoading ? null : espera90} dica="Sem condição financeira ou desistiu" icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Funil da recuperação</CardTitle>
              <CardDescription className="text-xs">Começa a contar quando o piloto for ligado.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {FUNIL.map(({ rotulo, icon: Icon }) => (
                <div key={rotulo} className="rounded-xl bg-muted/50 p-3 text-center">
                  <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
                  <p className="text-xl font-bold tabular-nums text-foreground">0</p>
                  <p className="text-[11px] text-muted-foreground">{rotulo}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">De onde vêm os descartados</CardTitle>
              <CardDescription className="text-xs">Por motivo do descarte, já sem duplicados, bloqueados e clientes ativos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading && <Skeleton className="h-40 w-full" />}
              {porBalde.map(([balde, n]) => {
                const g = grupoDoBalde(balde);
                return (
                  <div key={balde} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{BALDE_ROTULO[balde] ?? balde}</span>
                      <span className="flex items-center gap-2">
                        {g === "espera_90" && <Badge variant="secondary" className="text-[10px]">espera 90 dias</Badge>}
                        <b className="tabular-nums">{n.toLocaleString("pt-BR")}</b>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={g === "entra" ? "h-full bg-primary" : "h-full bg-muted-foreground/40"} style={{ width: `${(n / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Configuração do piloto</CardTitle></CardHeader>
            <CardContent className="divide-y divide-border text-xs">
              <Linha rotulo="Limite por dia" valor={`${RECUPERA_CONFIG.limiteDia} envios`} />
              <Linha rotulo="Dias e horário" valor={`${RECUPERA_CONFIG.dias} · ${RECUPERA_CONFIG.janela}`} />
              <Linha rotulo="Espera após descarte" valor={`${RECUPERA_CONFIG.esperaHoras}h`} />
              <Linha rotulo="Número" valor="WhatsApp da Lia" />
              <Linha rotulo="Quem descartou" valor="Não recebe de volta" />
              <Linha rotulo="Cérebro" valor={`${RECUPERA_CONFIG.modeloConversa} · ${RECUPERA_CONFIG.modeloDecisao} na decisão`} icon={Brain} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Cadência</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-3 border-l border-border pl-4">
                {CADENCIA.map((c) => (
                  <li key={c.dia}>
                    <span className="absolute -left-[5px] mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <p className="text-xs font-semibold text-foreground">{c.dia} · {c.titulo}</p>
                    <p className="text-[11px] text-muted-foreground">{c.texto}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex gap-2 p-4 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
              Nunca recebem: quem pediu para sair, já comprou, telefone inválido, cliente ativo com corretor ou quem já disse "não" à Lia.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ titulo, valor, dica, icon: Icon }: { titulo: string; valor: number | null; dica: string; icon: typeof Filter }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <div>
          <p className="text-[11px] text-muted-foreground">{titulo}</p>
          {valor === null ? <Skeleton className="h-6 w-14" /> : <p className="text-xl font-bold tabular-nums text-foreground">{valor.toLocaleString("pt-BR")}</p>}
          <p className="text-[10px] text-muted-foreground">{dica}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Linha({ rotulo, valor, icon: Icon }: { rotulo: string; valor: string; icon?: typeof Brain }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="flex items-center gap-1 text-muted-foreground">{Icon && <Icon className="h-3.5 w-3.5" />}{rotulo}</span>
      <b className="text-right text-foreground">{valor}</b>
    </div>
  );
}
