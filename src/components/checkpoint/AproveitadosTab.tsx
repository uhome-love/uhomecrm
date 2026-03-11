import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Copy, Search, Phone, Clock, Building2, Tag } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Props {
  teamUserIds: string[];
  teamNameMap: Record<string, string>;
}

interface Aproveitado {
  id: string;
  lead_nome: string;
  lead_telefone: string;
  corretor_id: string;
  corretor_nome: string;
  created_at: string;
  origem: string;
  empreendimento: string;
  lista_nome: string;
  tempo_ate_contato: string;
}

export default function AproveitadosTab({ teamUserIds, teamNameMap }: Props) {
  const [aproveitados, setAproveitados] = useState<Aproveitado[]>([]);
  const [search, setSearch] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("todos");
  const [filterPeriodo, setFilterPeriodo] = useState<"hoje" | "semana" | "mes">("mes");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (teamUserIds.length === 0) return;
    setLoading(true);

    const hoje = new Date();
    let inicioStr: string;
    if (filterPeriodo === "hoje") inicioStr = format(hoje, "yyyy-MM-dd");
    else if (filterPeriodo === "semana") inicioStr = format(new Date(hoje.getTime() - 7 * 86400000), "yyyy-MM-dd");
    else inicioStr = format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), "yyyy-MM-dd");

    const { data } = await supabase
      .from("oferta_ativa_tentativas")
      .select("id, corretor_id, created_at, lead_id, oferta_ativa_leads(nome, telefone, empreendimento, origem, lista_id)")
      .in("corretor_id", teamUserIds)
      .eq("resultado", "com_interesse")
      .gte("created_at", `${inicioStr}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(200);

    // Get lista names
    const listaIds = [...new Set((data || []).map((d: any) => d.oferta_ativa_leads?.lista_id).filter(Boolean))];
    let listaMap: Record<string, string> = {};
    if (listaIds.length > 0) {
      const { data: listas } = await supabase.from("oferta_ativa_listas").select("id, nome").in("id", listaIds);
      (listas || []).forEach((l: any) => { listaMap[l.id] = l.nome; });
    }

    // Get first tentativa per lead to calculate tempo até contato
    const leadIds = [...new Set((data || []).map((d: any) => d.lead_id).filter(Boolean))];
    let firstTentativaMap: Record<string, string> = {};
    if (leadIds.length > 0) {
      const { data: firsts } = await supabase
        .from("oferta_ativa_tentativas")
        .select("lead_id, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: true })
        .limit(1000);
      (firsts || []).forEach((f: any) => {
        if (!firstTentativaMap[f.lead_id]) firstTentativaMap[f.lead_id] = f.created_at;
      });
    }

    setAproveitados((data || []).map((d: any) => {
      const lead = d.oferta_ativa_leads;
      const firstContact = firstTentativaMap[d.lead_id];
      let tempo = "—";
      if (firstContact && d.created_at) {
        const diff = new Date(d.created_at).getTime() - new Date(firstContact).getTime();
        if (diff < 60000) tempo = "< 1min";
        else if (diff < 3600000) tempo = `${Math.round(diff / 60000)}min`;
        else tempo = `${Math.round(diff / 3600000)}h`;
      }

      return {
        id: d.id,
        lead_nome: lead?.nome || "Sem nome",
        lead_telefone: lead?.telefone || "",
        corretor_id: d.corretor_id,
        corretor_nome: teamNameMap[d.corretor_id] || "Corretor",
        created_at: d.created_at,
        origem: lead?.origem || "—",
        empreendimento: lead?.empreendimento || "—",
        lista_nome: lead?.lista_id ? (listaMap[lead.lista_id] || "Lista") : "—",
        tempo_ate_contato: tempo,
      };
    }));
    setLoading(false);
  }, [teamUserIds, teamNameMap, filterPeriodo]);

  useEffect(() => { load(); }, [load]);

  const filtered = aproveitados.filter(a => {
    const matchSearch = !search || a.lead_nome?.toLowerCase().includes(search.toLowerCase()) || a.lead_telefone?.includes(search);
    const matchCorretor = filterCorretor === "todos" || a.corretor_id === filterCorretor;
    return matchSearch && matchCorretor;
  });

  // Stats by corretor
  const statsByCorretor: Record<string, number> = {};
  filtered.forEach(a => { statsByCorretor[a.corretor_nome] = (statsByCorretor[a.corretor_nome] || 0) + 1; });
  const sortedCorretores = Object.entries(statsByCorretor).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" /> Leads Aproveitados ({filtered.length})
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {sortedCorretores.slice(0, 3).map(([nome, count]) => (
            <span key={nome} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-medium">
              {nome.split(" ")[0]}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" placeholder="Buscar por nome ou telefone..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full text-sm border border-border rounded-lg pl-9 pr-3 py-2 bg-background text-foreground focus:outline-none focus:border-primary/50"
          />
        </div>
        <select
          value={filterCorretor} onChange={e => setFilterCorretor(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:border-primary/50"
        >
          <option value="todos">Todos corretores</option>
          {teamUserIds.map(id => <option key={id} value={id}>{teamNameMap[id] || id}</option>)}
        </select>
        <select
          value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value as any)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:border-primary/50"
        >
          <option value="hoje">Hoje</option>
          <option value="semana">Última Semana</option>
          <option value="mes">Este Mês</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full mr-2" />
          Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">Nenhum lead aproveitado encontrado.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-start justify-between border border-border rounded-xl px-4 py-3 hover:bg-accent/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground text-sm">{a.lead_nome}</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-500/5">Aproveitado</Badge>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    👤 {a.corretor_nome}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                  {a.lead_telefone && (
                    <span className="flex items-center gap-1"><Phone size={10} />{a.lead_telefone}</span>
                  )}
                  {a.empreendimento !== "—" && (
                    <span className="flex items-center gap-1"><Building2 size={10} />{a.empreendimento}</span>
                  )}
                  {a.origem !== "—" && (
                    <span className="flex items-center gap-1"><Tag size={10} />{a.origem}</span>
                  )}
                  {a.lista_nome !== "—" && (
                    <span className="text-muted-foreground/70">Lista: {a.lista_nome}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock size={10} />Tempo: {a.tempo_ate_contato}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              <Button
                variant="ghost" size="sm"
                className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => { navigator.clipboard.writeText(`${a.lead_nome}\n${a.lead_telefone ?? ""}`); toast.success("Copiado!"); }}
              >
                <Copy size={12} /> Copiar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
