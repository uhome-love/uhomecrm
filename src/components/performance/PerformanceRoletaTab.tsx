/** Aba "Performance da Roleta" (CEO, diretora, gerente). Só leitura — não muda nenhuma regra. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { usePerformanceRoleta } from "@/hooks/usePerformanceRoleta";
import FechamentoSemanalCard from "@/components/gerente/FechamentoSemanalCard";
import { gerarPdfPerformance, type LinhaFechamento } from "@/lib/performancePdf";
import { kpis, foraDaRoleta, aptosAgora, evolucaoSemana } from "@/lib/performanceRoletaPresentation";
import { Kpi, ForaDaRoleta, AptosAgora, EvolucaoSemana, UltimasSemanas, type SemanaAgg } from "./roleta/Blocos";

const p2 = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const labelSemana = (ini: string) => { const d = new Date(`${ini}T12:00:00`); const f = new Date(d); f.setDate(d.getDate() + 6); return `${p2(d)} a ${p2(f)}`; };
const segundaBRT = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };

export default function PerformanceRoletaTab() {
  const { data = [], isLoading, error, dataUpdatedAt } = usePerformanceRoleta();
  const [equipe, setEquipe] = useState("todas");
  const [gerando, setGerando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const equipes = useMemo(() => Array.from(new Set(data.map((c) => c.equipe))).sort(), [data]);
  const lista = useMemo(() => (equipe === "todas" ? data : data.filter((c) => c.equipe === equipe)), [data, equipe]);
  const k = useMemo(() => kpis(lista), [lista]);
  const fora = useMemo(() => foraDaRoleta(lista), [lista]);
  const aptos = useMemo(() => aptosAgora(lista), [lista]);
  const evol = useMemo(() => evolucaoSemana(lista), [lista]);
  const seg = useMemo(segundaBRT, []);

  const { data: fech = [] } = useQuery({
    queryKey: ["roleta-ultimas-semanas"],
    queryFn: async () => {
      const desde = new Date(seg); desde.setDate(seg.getDate() - 42);
      const { data: rows, error: e } = await supabase.from("roleta_fechamento_semanal").select("semana_inicio, corretor_id, situacao, visitas_validas").gte("semana_inicio", desde.toISOString().slice(0, 10));
      if (e) throw e;
      return rows ?? [];
    },
  });
  const semanas = useMemo<SemanaAgg[]>(() => {
    const ids = new Set(lista.map((c) => c.user_id));
    const m = new Map<string, SemanaAgg>();
    fech.filter((r) => ids.has(r.corretor_id)).forEach((r) => {
      const ini = String(r.semana_inicio);
      const s = m.get(ini) ?? { ini, label: labelSemana(ini), aptos: 0, total: 0, visitas: 0 };
      s.total++; s.visitas += Number(r.visitas_validas ?? 0); if (r.situacao === "apto") s.aptos++;
      m.set(ini, s);
    });
    return Array.from(m.values()).sort((a, b) => b.ini.localeCompare(a.ini)).slice(0, 6);
  }, [fech, lista]);

  const baixarPdf = async () => {
    setGerando(true);
    try {
      const ini = semanas[0]?.ini;
      let fechamento: LinhaFechamento[] = [];
      if (ini) {
        const ids = new Set(lista.map((c) => c.user_id));
        const nomes = new Map(data.map((c) => [c.user_id, c.nome]));
        const { data: rows } = await supabase.from("roleta_fechamento_semanal").select("corretor_id, visitas_validas, crm_pct, situacao, um_a_um_pendente").eq("semana_inicio", ini);
        fechamento = (rows ?? []).filter((r) => ids.has(r.corretor_id))
          .map((r) => ({ ...r, nome: nomes.get(r.corretor_id) ?? "—" } as LinhaFechamento)).sort((a, b) => b.visitas_validas - a.visitas_validas);
      }
      gerarPdfPerformance({ equipe: equipe !== "todas" ? equipe : equipes.length === 1 ? equipes[0] : "Todas", semanaLabel: ini ? labelSemana(ini) : null, corretores: lista, fechamento });
    } finally { setGerando(false); }
  };

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="p-4 text-sm text-destructive">Não foi possível carregar a performance agora.</p>;

  const segIso = seg.toISOString().slice(0, 10);
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">Semana {labelSemana(segIso)} · atualizado às {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
        <div className="ml-auto flex flex-wrap gap-2">
          {equipes.length > 1 && (
            <select value={equipe} onChange={(e) => setEquipe(e.target.value)} className="h-9 rounded-lg border border-border bg-background px-3 text-sm">
              <option value="todas">Equipe: Todas</option>
              {equipes.map((e) => <option key={e} value={e}>Equipe: {e}</option>)}
            </select>
          )}
          <Button size="sm" variant="outline" className="gap-1.5" onClick={baixarPdf} disabled={gerando}>
            <Download className="h-4 w-4" /> {gerando ? "Gerando…" : "PDF"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Aptos agora" value={k.aptos} extra={`de ${k.total}`} sub={k.voltaram ? `${k.voltaram} voltaram nesta semana` : undefined} tone="text-success-500" />
        <Kpi label="Fora da roleta" value={k.fora} sub={`${k.foraVis} visitas · ${k.foraCrm} CRM${k.foraOutros ? ` · ${k.foraOutros} outros` : ""}`} tone="text-destructive" />
        <Kpi label="Perto de voltar" value={k.perto} sub="visita marcada completa as 2" tone="text-warning" />
        <Kpi label="Visitas na semana" value={Number(k.realizadas.toFixed(1))} sub={`+ ${k.marcadas} marcadas até domingo`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <ForaDaRoleta rows={fora} />
        <AptosAgora rows={aptos} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <EvolucaoSemana pontos={evol} total={k.total} seg={seg} />
        <UltimasSemanas semanas={semanas} aberto={aberto} onToggle={() => setAberto((v) => !v)}><FechamentoSemanalCard /></UltimasSemanas>
      </div>
    </div>
  );
}
