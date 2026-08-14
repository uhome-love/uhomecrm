import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brtRangeToUTC } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisitaRow {
  id: string;
  nome_cliente: string | null;
  empreendimento: string | null;
  data_visita: string | null;
  hora_visita: string | null;
  status: string | null;
  corretor_id: string | null;
  gerente_id: string | null;
  pipeline_lead_id: string | null;
}

interface Props {
  dateRange: { start: string; end: string };
  onOpenLead: (leadId: string) => void;
}

const SEM_EQUIPE = "Sem equipe";

function fmtData(d?: string | null) {
  if (!d) return "—";
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}`;
}

function fmtHora(h?: string | null) {
  if (!h) return "—";
  return h.slice(0, 5);
}

export default function VisitasPorEquipeList({ dateRange, onOpenLead }: Props) {
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState<VisitaRow[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [equipePorCorretor, setEquipePorCorretor] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { startUtc, endUtc } = brtRangeToUTC(dateRange);
      const { data } = await supabase
        .from("visitas_unicas" as any)
        .select("id, nome_cliente, empreendimento, data_visita, hora_visita, status, corretor_id, gerente_id, pipeline_lead_id")
        .gte("created_at", startUtc)
        .lt("created_at", endUtc)
        .order("data_visita", { ascending: true })
        .limit(500);

      const rows = ((data as unknown as VisitaRow[]) || []);

      const ids = Array.from(
        new Set(
          rows.flatMap((v) => [v.corretor_id, v.gerente_id]).filter((x): x is string => !!x)
        )
      );
      const corretorIds = Array.from(new Set(rows.map((v) => v.corretor_id).filter((x): x is string => !!x)));

      const [{ data: profiles }, { data: members }] = await Promise.all([
        ids.length
          ? supabase.from("profiles").select("user_id, nome").in("user_id", ids)
          : Promise.resolve({ data: [] as { user_id: string; nome: string | null }[] }),
        corretorIds.length
          ? supabase.from("team_members").select("user_id, gerente_id").in("user_id", corretorIds)
          : Promise.resolve({ data: [] as { user_id: string; gerente_id: string | null }[] }),
      ]);

      const nomeMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { if (p.user_id) nomeMap[p.user_id] = p.nome || ""; });

      const gerenteDoCorretor: Record<string, string> = {};
      (members || []).forEach((m: any) => { if (m.user_id && m.gerente_id) gerenteDoCorretor[m.user_id] = m.gerente_id; });

      // Nomes dos gerentes vindos do fallback team_members
      const faltando = Array.from(new Set(Object.values(gerenteDoCorretor))).filter((g) => !nomeMap[g]);
      if (faltando.length) {
        const { data: gp } = await supabase.from("profiles").select("user_id, nome").in("user_id", faltando);
        (gp || []).forEach((p: any) => { if (p.user_id) nomeMap[p.user_id] = p.nome || ""; });
      }

      if (cancelled) return;
      setVisitas(rows);
      setNomes(nomeMap);
      setEquipePorCorretor(gerenteDoCorretor);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.start, dateRange.end]);

  const grupos = useMemo(() => {
    const map = new Map<string, Map<string, VisitaRow[]>>();
    visitas.forEach((v) => {
      const gerenteId = v.gerente_id || (v.corretor_id ? equipePorCorretor[v.corretor_id] : null);
      const equipe = gerenteId ? (nomes[gerenteId] || "Equipe") : SEM_EQUIPE;
      const corretor = v.corretor_id ? (nomes[v.corretor_id] || "Corretor") : "Sem corretor";
      if (!map.has(equipe)) map.set(equipe, new Map());
      const byCorretor = map.get(equipe)!;
      if (!byCorretor.has(corretor)) byCorretor.set(corretor, []);
      byCorretor.get(corretor)!.push(v);
    });

    return Array.from(map.entries())
      .map(([equipe, byCorretor]) => ({
        equipe,
        total: Array.from(byCorretor.values()).reduce((a, b) => a + b.length, 0),
        corretores: Array.from(byCorretor.entries())
          .map(([corretor, itens]) => ({
            corretor,
            itens: itens.sort((a, b) =>
              `${a.data_visita ?? ""}${a.hora_visita ?? ""}`.localeCompare(`${b.data_visita ?? ""}${b.hora_visita ?? ""}`)
            ),
          }))
          .sort((a, b) => b.itens.length - a.itens.length || a.corretor.localeCompare(b.corretor)),
      }))
      .sort((a, b) => b.total - a.total || a.equipe.localeCompare(b.equipe));
  }, [visitas, nomes, equipePorCorretor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (visitas.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma visita criada no período.</p>;
  }

  return (
    <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-2">
      <p className="text-xs text-muted-foreground">{visitas.length} visita(s) criada(s) no período</p>
      {grupos.map((g) => {
        const isClosed = !!closed[g.equipe];
        return (
          <div key={g.equipe} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setClosed((c) => ({ ...c, [g.equipe]: !c[g.equipe] }))}
              className="w-full flex items-center gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
            >
              {isClosed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="text-sm font-semibold flex-1 truncate">
                {g.equipe === SEM_EQUIPE ? SEM_EQUIPE : `Equipe ${g.equipe}`}
              </span>
              <span className="text-xs text-muted-foreground">{g.total} visita{g.total !== 1 ? "s" : ""}</span>
            </button>

            {!isClosed && (
              <div className="divide-y divide-border">
                {g.corretores.map((c) => (
                  <div key={c.corretor} className="px-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{c.corretor}</span>
                      <span className="text-[10px] text-muted-foreground">{c.itens.length}</span>
                    </div>
                    <div className="space-y-1">
                      {c.itens.map((v) => (
                        <div
                          key={v.id}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-2 py-1.5 group",
                            "hover:bg-muted/50"
                          )}
                        >
                          <span className="text-[11px] tabular-nums text-muted-foreground whitespace-nowrap w-20">
                            {fmtData(v.data_visita)} · {fmtHora(v.hora_visita)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{v.nome_cliente || "Sem nome"}</p>
                            {v.empreendimento && (
                              <p className="text-[10px] text-muted-foreground truncate">{v.empreendimento}</p>
                            )}
                          </div>
                          {v.status && <Badge variant="outline" className="text-[10px] shrink-0">{v.status}</Badge>}
                          {v.pipeline_lead_id && (
                            <button
                              onClick={() => onOpenLead(v.pipeline_lead_id!)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary/80 shrink-0"
                              title="Abrir no pipeline"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
