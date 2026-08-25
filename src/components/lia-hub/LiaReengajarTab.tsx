import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Play, Pause, Square, Power, Send, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRT } from "@/lib/brtTime";
import { produtoLabel } from "./useLiaHub";

// baldes recuperáveis (ordem = recomendação de ataque). "definitivo/nao_quer_contato" nunca entram (a view já exclui).
const BALDES: { valor: string; rotulo: string }[] = [
  { valor: "sem_interesse_momento", rotulo: "Sem interesse no momento" },
  { valor: "sem_motivo", rotulo: "Sem motivo escrito" },
  { valor: "nao_atende", rotulo: "Não atende" },
  { valor: "outro", rotulo: "Outro" },
  { valor: "sem_perfil", rotulo: "Sem perfil" },
  { valor: "desistiu_compra", rotulo: "Desistiu" },
  { valor: "lead_antigo", rotulo: "Lead antigo" },
];
const TEMPLATE_POR_MODO: Record<string, string> = { produto: "lia_reengajar_produto", cardapio: "lia_reengajar_cardapio" };

type ResumoRow = { balde: string; produto_slug: string | null; produto_ativo: boolean; n: number };
type Run = {
  id: string; nome: string | null; modo: string; produto_slug: string | null; template_key: string;
  cap_dia: number; lote_total: number; status: string; criado_em: string; iniciado_em: string | null;
};
type FilaCount = { run_id: string; status: string };

const STATUS_BADGE: Record<string, string> = {
  armado: "bg-muted text-foreground",
  ativo: "bg-emerald-100 text-emerald-700",
  pausado: "bg-amber-100 text-amber-700",
  concluido: "bg-sky-100 text-sky-700",
  cancelado: "bg-rose-100 text-rose-700",
};

export default function LiaReengajarTab() {
  const qc = useQueryClient();
  // As tabelas/views novas ainda não estão nos tipos gerados do Supabase; acesso destipado só aqui.
  const sb = supabase as any;

  // ----- dados -----
  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ["lia-reeng-resumo"],
    queryFn: async () => {
      const { data, error } = await sb.from("lia_reengajamento_resumo").select("balde, produto_slug, produto_ativo, n");
      if (error) throw error;
      return (data ?? []) as ResumoRow[];
    },
  });
  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ["lia-reeng-runs"],
    queryFn: async () => {
      const { data, error } = await sb.from("lia_reengajamento_runs").select("*").order("criado_em", { ascending: false }).limit(30);
      if (error) throw error;
      return (data ?? []) as Run[];
    },
    refetchInterval: 30000,
  });
  const { data: filaCounts } = useQuery({
    queryKey: ["lia-reeng-fila-counts"],
    queryFn: async () => {
      const { data, error } = await sb.from("lia_reengajamento_fila").select("run_id, status");
      if (error) throw error;
      return (data ?? []) as FilaCount[];
    },
    refetchInterval: 30000,
  });
  const { data: flag } = useQuery({
    queryKey: ["lia-reeng-flag"],
    queryFn: async () => {
      const { data } = await sb.from("system_flags").select("flag_value").eq("flag_name", "lia_reengajamento_enabled").maybeSingle();
      return !!data?.flag_value;
    },
  });

  // ----- form de novo lote -----
  const [modo, setModo] = useState<"produto" | "cardapio">("produto");
  const [produtoSlug, setProdutoSlug] = useState<string>("casa-tua-porto-alegre");
  const [balde, setBalde] = useState<string>("sem_interesse_momento");
  const [capDia, setCapDia] = useState<number>(25);
  const [lote, setLote] = useState<number>(100);

  const produtosDisponiveis = useMemo(() => {
    const s = new Set<string>();
    (resumo ?? []).forEach((r) => r.produto_slug && s.add(r.produto_slug));
    return Array.from(s).sort();
  }, [resumo]);

  // contagem de elegíveis pro filtro atual
  const elegiveis = useMemo(() => {
    return (resumo ?? [])
      .filter((r) => r.balde === balde)
      .filter((r) => (modo === "produto" ? r.produto_slug === produtoSlug : r.produto_slug === null))
      .reduce((s, r) => s + r.n, 0);
  }, [resumo, balde, modo, produtoSlug]);

  const contagemPorBalde = useMemo(() => {
    const m = new Map<string, number>();
    (resumo ?? []).forEach((r) => {
      const cabe = modo === "produto" ? r.produto_slug === produtoSlug : r.produto_slug === null;
      if (cabe) m.set(r.balde, (m.get(r.balde) ?? 0) + r.n);
    });
    return m;
  }, [resumo, modo, produtoSlug]);

  const countsPorRun = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    (filaCounts ?? []).forEach((f) => {
      const r = m.get(f.run_id) ?? {};
      r[f.status] = (r[f.status] ?? 0) + 1;
      m.set(f.run_id, r);
    });
    return m;
  }, [filaCounts]);

  // ----- mutations -----
  const armar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("lia-reengajar-arm", {
        body: { modo, produto_slug: modo === "produto" ? produtoSlug : null, template_key: TEMPLATE_POR_MODO[modo], balde, cap_dia: capDia, lote },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "falha ao armar");
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Lote armado (pausado): ${d.lote_total} leads na fila.`);
      qc.invalidateQueries({ queryKey: ["lia-reeng-runs"] });
      qc.invalidateQueries({ queryKey: ["lia-reeng-fila-counts"] });
    },
    onError: (e: any) => toast.error(`Não deu pra armar: ${e.message ?? e}`),
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "ativo") patch.iniciado_em = new Date().toISOString();
      const { error } = await sb.from("lia_reengajamento_runs").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lia-reeng-runs"] }); },
    onError: (e: any) => toast.error(`Não deu pra mudar o status: ${e.message ?? e}`),
  });

  const toggleFlag = useMutation({
    mutationFn: async (ligar: boolean) => {
      const { error } = await sb.from("system_flags")
        .update({ flag_value: ligar, updated_at: new Date().toISOString() })
        .eq("flag_name", "lia_reengajamento_enabled");
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lia-reeng-flag"] }); },
    onError: (e: any) => toast.error(`Não deu pra mudar o motor: ${e.message ?? e}`),
  });

  return (
    <div className="space-y-3">
      {/* MOTOR (kill switch) */}
      <Card className={flag ? "border-emerald-300" : "border-amber-300"}>
        <CardContent className="flex flex-wrap items-center gap-3 p-3.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${flag ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            <Power className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{flag ? "Motor LIGADO" : "Motor desligado"}</p>
            <p className="text-[11px] text-muted-foreground">
              {flag ? "Os lotes ATIVOS estão disparando (horário comercial, cap/dia, lotes pequenos)." : "Nada dispara. Ligue só quando tiver lote ativo e os templates aprovados."}
            </p>
          </div>
          <Button size="sm" variant={flag ? "outline" : "default"} onClick={() => toggleFlag.mutate(!flag)} disabled={toggleFlag.isPending}>
            {flag ? "Desligar motor" : "Ligar motor"}
          </Button>
        </CardContent>
      </Card>

      {/* ARMAR NOVO LOTE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Armar novo lote</CardTitle>
          <CardDescription className="text-[11px]">
            Monta a fila (pausada) a partir da base de descartados, já sem bloqueados, opt-outs e leads vivos. Não dispara nada até você iniciar o lote e ligar o motor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-[11px]">Modo</Label>
              <Select value={modo} onValueChange={(v) => setModo(v as "produto" | "cardapio")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto (direciona)</SelectItem>
                  <SelectItem value="cardapio">Cardápio (curadoria)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modo === "produto" && (
              <div className="space-y-1">
                <Label className="text-[11px]">Imóvel</Label>
                <Select value={produtoSlug} onValueChange={setProdutoSlug}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {produtosDisponiveis.map((p) => (
                      <SelectItem key={p} value={p}>{produtoLabel(p)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[11px]">Balde (motivo)</Label>
              <Select value={balde} onValueChange={setBalde}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BALDES.map((b) => (
                    <SelectItem key={b.valor} value={b.valor}>
                      {b.rotulo} ({contagemPorBalde.get(b.valor) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Cap por dia</Label>
              <Input type="number" min={1} max={500} className="h-9" value={capDia} onChange={(e) => setCapDia(Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tamanho do lote</Label>
              <Input type="number" min={1} max={500} className="h-9" value={lote} onChange={(e) => setLote(Number(e.target.value) || 0)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
            <span className="flex items-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <b>{loadingResumo ? "…" : elegiveis}</b> elegíveis nesse filtro
            </span>
            <span className="text-[11px] text-muted-foreground">Template: <code>{TEMPLATE_POR_MODO[modo]}</code></span>
            <div className="ml-auto">
              <Button size="sm" onClick={() => armar.mutate()} disabled={armar.isPending || elegiveis === 0}>
                <Send className="mr-1.5 h-4 w-4" /> Armar lote (pausado)
              </Button>
            </div>
          </div>
          {modo === "cardapio" && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> O cardápio depende do cérebro de curadoria (em construção). Por ora, use o modo Produto no piloto.
            </p>
          )}
        </CardContent>
      </Card>

      {/* LOTES / AO VIVO */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lotes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {loadingRuns ? (
            <Skeleton className="h-20 w-full" />
          ) : (runs ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lote ainda. Arme o primeiro acima.</p>
          ) : (
            (runs ?? []).map((run) => {
              const c = countsPorRun.get(run.id) ?? {};
              const enviados = c.enviado ?? 0;
              const pendentes = c.pendente ?? 0;
              const erros = c.erro ?? 0;
              return (
                <div key={run.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={STATUS_BADGE[run.status] ?? ""}>{run.status}</Badge>
                    <span className="text-sm font-medium">{run.nome ?? "Lote"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {run.modo === "produto" ? produtoLabel(run.produto_slug ?? "") : "Cardápio"} · cap {run.cap_dia}/dia · {formatBRT(run.criado_em, "dd/MM HH:mm")}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      {(run.status === "armado" || run.status === "pausado") && (
                        <Button size="sm" variant="default" className="h-8" onClick={() => mudarStatus.mutate({ id: run.id, status: "ativo" })}>
                          <Play className="mr-1 h-3.5 w-3.5" /> Iniciar
                        </Button>
                      )}
                      {run.status === "ativo" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => mudarStatus.mutate({ id: run.id, status: "pausado" })}>
                          <Pause className="mr-1 h-3.5 w-3.5" /> Pausar
                        </Button>
                      )}
                      {run.status !== "concluido" && run.status !== "cancelado" && (
                        <Button size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => mudarStatus.mutate({ id: run.id, status: "cancelado" })}>
                          <Square className="mr-1 h-3.5 w-3.5" /> Parar
                        </Button>
                      )}
                    </div>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                    <span>Lote: <b>{run.lote_total}</b></span>
                    <span className="text-emerald-700">Enviados: <b>{enviados}</b></span>
                    <span className="text-muted-foreground">Pendentes: <b>{pendentes}</b></span>
                    {erros > 0 && <span className="text-rose-600">Erros: <b>{erros}</b></span>}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
