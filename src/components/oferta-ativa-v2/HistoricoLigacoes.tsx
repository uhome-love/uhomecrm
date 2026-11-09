/** Histórico de ligações do corretor (30 dias) com "Aproveitar" para cliente que respondeu depois. */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Search, History, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRT } from "@/lib/brtTime";
import { cn } from "@/lib/utils";
import { formatarFone } from "./tipos";

type Filtro = "todos" | "nao_atendeu" | "sem_interesse" | "com_interesse" | "numero_errado";
const ROTULO: Record<string, { txt: string; cls: string }> = {
  nao_atendeu: { txt: "Não atendeu", cls: "bg-muted text-muted-foreground" },
  sem_interesse: { txt: "Sem interesse", cls: "bg-destructive/10 text-destructive" },
  numero_errado: { txt: "Número errado", cls: "bg-muted text-muted-foreground" },
  com_interesse: { txt: "Aproveitado", cls: "bg-success/15 text-success-700" },
};
const FILTROS: { id: Filtro; txt: string }[] = [
  { id: "todos", txt: "Todas" }, { id: "nao_atendeu", txt: "Não atendeu" }, { id: "sem_interesse", txt: "Sem interesse" },
  { id: "com_interesse", txt: "Aproveitados" }, { id: "numero_errado", txt: "Número errado" },
];

interface Linha { id: string; lead_id: string; resultado: string; feedback: string | null; created_at: string; empreendimento: string | null; canal: string;
  lead: { nome: string | null; telefone: string | null; status: string | null; corretor_id: string | null } | null }

export default function HistoricoLigacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aproveitando, setAproveitando] = useState<string | null>(null);

  const { data = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["oa-historico", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data, error } = await supabase.from("oferta_ativa_tentativas")
        .select("id, lead_id, resultado, feedback, created_at, empreendimento, canal")
        .eq("corretor_id", user!.id).gte("created_at", desde).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((t) => t.lead_id).filter(Boolean))] as string[];
      const leads = new Map<string, Linha["lead"]>();
      for (let i = 0; i < ids.length; i += 100) {
        const { data: ls, error: e2 } = await supabase.from("oferta_ativa_leads").select("id, nome, telefone, status, corretor_id").in("id", ids.slice(i, i + 100));
        if (e2) throw e2;
        for (const l of ls ?? []) leads.set(l.id, { nome: l.nome, telefone: l.telefone, status: l.status, corretor_id: l.corretor_id });
      }
      return (data ?? []).filter((t) => leads.has(t.lead_id)).map((t) => ({ ...t, lead: leads.get(t.lead_id) ?? null })) as Linha[];
    },
  });

  // Uma linha por cliente (a ligação mais recente), para não repetir o mesmo nome.
  const linhas = useMemo(() => {
    const vistos = new Set<string>();
    const q = busca.trim().toLowerCase();
    const dig = q.replace(/\D/g, "");
    return data.filter((l) => {
      if (vistos.has(l.lead_id)) return false;
      vistos.add(l.lead_id);
      if (filtro !== "todos" && l.resultado !== filtro) return false;
      if (!q) return true;
      return (l.lead?.nome ?? "").toLowerCase().includes(q) || (dig.length >= 3 && (l.lead?.telefone ?? "").replace(/\D/g, "").includes(dig));
    });
  }, [data, filtro, busca]);

  const aproveitar = async (l: Linha) => {
    setAproveitando(l.lead_id);
    const { data: r, error } = await supabase.rpc("oa_historico_aproveitar", { p_lead_id: l.lead_id });
    setAproveitando(null);
    if (error) { toast.error("Não foi possível aproveitar agora. Tente de novo."); return; }
    const res = r as { ok: boolean; status: string; corretor_nome?: string; pipeline_lead_id?: string };
    if (res.ok) {
      toast.success(`${l.lead?.nome ?? "Cliente"} agora está no seu Pipeline! 🎉`);
      for (const k of ["oa-historico", "oa-ranking-ligacoes", "corretor-daily-stats", "oa-aproveitados", "pipeline", "oa-ranking"]) void qc.invalidateQueries({ queryKey: [k] });
      return;
    }
    if (res.status === "com_outro") toast.warning(`Este cliente já está com ${res.corretor_nome ?? "outro corretor"} no Pipeline.`);
    else if (res.status === "comigo") toast("Este cliente já está no seu Pipeline.", { action: { label: "Abrir", onClick: () => navigate("/pipeline-leads") } });
    else if (res.status === "bloqueado") toast.error("Este cliente pediu para não receber contato.");
    else toast.error("Não foi possível aproveitar este cliente.");
  };

  return (
    <section className="space-y-3" aria-label="Histórico de ligações">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {FILTROS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
              className={cn("shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-fast", filtro === f.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
              {f.txt}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome ou telefone" className="h-10 pl-9" aria-label="Buscar no histórico" />
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" aria-hidden /> O cliente respondeu depois? Toque em Aproveitar para trazer ele pro seu Pipeline.</p>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden /></div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-10 text-center">
          <p className="text-sm text-muted-foreground">Não foi possível carregar o histórico agora.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar de novo</Button>
        </div>
      ) : linhas.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card py-12 text-center">
          <History className="h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Nenhuma ligação {filtro === "todos" ? "nos últimos 30 dias" : "com esse resultado"}.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {linhas.map((l) => {
            const rot = ROTULO[l.resultado] ?? { txt: l.resultado, cls: "bg-muted" };
            const meu = l.lead?.status === "aproveitado" && l.lead?.corretor_id === user?.id;
            const duracao = l.feedback?.match(/Ligação de ([\dmins]+)/)?.[1];
            return (
              <li key={l.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.lead?.nome || "Cliente sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground tabular-nums">
                    {formatarFone(l.lead?.telefone ?? null)}{l.empreendimento ? ` · ${l.empreendimento}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("rounded-full px-2 py-0.5 font-semibold", rot.cls)}>{rot.txt}</span>
                    {formatBRT(l.created_at, "dd/MM HH:mm")}{duracao ? ` · ${duracao}` : ""}
                  </p>
                </div>
                {meu ? (
                  <span className="shrink-0 text-xs font-semibold text-success-700">No seu Pipeline</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => void aproveitar(l)} disabled={aproveitando !== null} className="shrink-0 gap-1">
                    {aproveitando === l.lead_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />} Aproveitar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
