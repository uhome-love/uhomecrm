import { fmtVisitas } from "@/lib/visitasRoleta";
/** Aba "Performance da Roleta" (CEO, diretora, gerente). Só leitura — não muda nenhuma regra. */
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePerformanceRoleta, MOTIVO_GRUPO, type CorretorPerf } from "@/hooks/usePerformanceRoleta";
import FechamentoSemanalCard from "@/components/gerente/FechamentoSemanalCard";
import { gerarPdfPerformance, type LinhaFechamento } from "@/lib/performancePdf";
import { cn } from "@/lib/utils";

const Dot = ({ c, n }: { c: string; n: number }) => (
  <span className="inline-flex items-center gap-1 text-xs"><i className={cn("h-2 w-2 rounded-full", c)} />{n}</span>
);

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold", tone)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function PerformanceRoletaTab() {
  const { data = [], isLoading, error } = usePerformanceRoleta();
  const [equipe, setEquipe] = useState("todas");
  const [verTodos, setVerTodos] = useState(false);
  const [gerando, setGerando] = useState(false);

  const equipes = useMemo(() => Array.from(new Set(data.map((c) => c.equipe))).sort(), [data]);
  const lista = useMemo(() => (equipe === "todas" ? data : data.filter((c) => c.equipe === equipe)), [data, equipe]);

  const k = useMemo(() => {
    const g = (x: string) => lista.filter((c) => c.motivo?.bloqueado && MOTIVO_GRUPO(c.motivo.codigo) === x).length;
    return { aptos: lista.filter((c) => !c.motivo?.bloqueado).length, crm: g("crm"), vis: g("visitas"), desc: g("descartes"), outro: g("outro") };
  }, [lista]);

  const porEquipe = useMemo(() => {
    const m = new Map<string, CorretorPerf[]>();
    lista.forEach((c) => m.set(c.equipe, [...(m.get(c.equipe) ?? []), c]));
    return Array.from(m.entries()).map(([nome, cs]) => {
      const sum = (f: (c: CorretorPerf) => number) => cs.reduce((a, c) => a + Number(f(c) ?? 0), 0);
      const verde = sum((c) => c.crm?.em_dia ?? 0), ambar = sum((c) => c.crm?.ambar ?? 0), verm = sum((c) => c.crm?.vermelho ?? 0);
      const tot = verde + ambar + verm;
      return { nome, n: cs.length, pct: tot ? Math.round((verde / tot) * 100) : null, verde, ambar, verm,
        visAnt: sum((c) => c.visitas_semana_passada), visAtual: sum((c) => c.visitas_semana_atual) };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lista]);

  const bloqueados = useMemo(() => lista.filter((c) => c.motivo?.bloqueado).sort((a, b) => (a.crm?.pct ?? 0) - (b.crm?.pct ?? 0)), [lista]);

  const baixarPdf = async () => {
    setGerando(true);
    try {
      const { data: sem } = await supabase.from("roleta_fechamento_semanal").select("semana_inicio").order("semana_inicio", { ascending: false }).limit(1);
      const ini = sem?.[0]?.semana_inicio as string | undefined;
      let fechamento: LinhaFechamento[] = []; let label: string | null = null;
      if (ini) {
        const ids = new Set(lista.map((c) => c.user_id));
        const nomes = new Map(data.map((c) => [c.user_id, c.nome]));
        const { data: rows } = await supabase.from("roleta_fechamento_semanal").select("corretor_id, visitas_validas, crm_pct, situacao, um_a_um_pendente").eq("semana_inicio", ini);
        fechamento = (rows ?? []).filter((r) => equipe === "todas" || ids.has(r.corretor_id))
          .map((r) => ({ ...r, nome: nomes.get(r.corretor_id) ?? "—" } as LinhaFechamento)).sort((a, b) => b.visitas_validas - a.visitas_validas);
        const d = new Date(`${ini}T12:00:00`); const f = new Date(d); f.setDate(d.getDate() + 6);
        const p = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        label = `${p(d)} a ${p(f)}`;
      }
      gerarPdfPerformance({ equipe: equipe !== "todas" ? equipe : equipes.length === 1 ? equipes[0] : "Todas", semanaLabel: label, corretores: lista, fechamento });
    } finally { setGerando(false); }
  };

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="p-4 text-sm text-destructive">Não foi possível carregar a performance agora.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {equipes.length > 1 && (
          <select value={equipe} onChange={(e) => setEquipe(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
            <option value="todas">Equipe: Todas</option>
            {equipes.map((e) => <option key={e} value={e}>Equipe: {e}</option>)}
          </select>
        )}
        <Button size="sm" className="ml-auto gap-1.5" onClick={baixarPdf} disabled={gerando}>
          <Download className="h-4 w-4" /> {gerando ? "Gerando…" : "Baixar PDF da semana"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Aptos agora" value={k.aptos} sub={`de ${lista.length} corretores`} tone="text-success-500" />
        <Kpi label="Bloqueados · CRM abaixo de 80%" value={k.crm} tone="text-destructive" />
        <Kpi label="Bloqueados · menos de 2 visitas" value={k.vis} sub="vale a partir de 19/10" tone="text-warning" />
        <Kpi label="Bloqueados · descartes e outros" value={k.desc + k.outro} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Saúde do CRM e visitas por equipe</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Equipe</th><th className="pb-2 font-medium">Saúde</th><th className="pb-2 font-medium">Clientes</th><th className="pb-2 font-medium">Sem. passada</th><th className="pb-2 font-medium">Esta semana</th></tr></thead>
            <tbody className="divide-y divide-border">
              {porEquipe.map((e) => (
                <tr key={e.nome}>
                  <td className="py-2 font-semibold">{e.nome}</td>
                  <td className="py-2">{e.pct != null ? `${e.pct}%` : "—"}<div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${e.pct ?? 0}%` }} /></div></td>
                  <td className="py-2"><span className="flex gap-2"><Dot c="bg-success-500" n={e.verde} /><Dot c="bg-warning" n={e.ambar} /><Dot c="bg-destructive" n={e.verm} /></span></td>
                  <td className="py-2">{fmtVisitas(e.visAnt)} / {e.n * 2}</td>
                  <td className="py-2">{fmtVisitas(e.visAtual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Quem está bloqueado agora e por quê</h3>
          {bloqueados.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém bloqueado agora.</p> : (
            <div className="divide-y divide-border text-sm">
              {(verTodos ? bloqueados : bloqueados.slice(0, 6)).map((c) => (
                <div key={c.user_id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                  <span className={cn("text-xs", MOTIVO_GRUPO(c.motivo.codigo) === "crm" ? "text-destructive" : "text-warning")}>
                    {MOTIVO_GRUPO(c.motivo.codigo) === "crm" ? `CRM ${c.crm?.pct ?? 0}% · atualizar ${c.crm?.a_atualizar ?? 0}` : c.motivo.titulo}
                  </span>
                </div>
              ))}
            </div>
          )}
          {bloqueados.length > 6 && (
            <button onClick={() => setVerTodos((v) => !v)} className="mt-2 text-xs font-medium text-primary">
              {verTodos ? "Mostrar menos" : `Ver todos (${bloqueados.length}) →`}
            </button>
          )}
        </section>
      </div>

      <FechamentoSemanalCard />
    </div>
  );
}
