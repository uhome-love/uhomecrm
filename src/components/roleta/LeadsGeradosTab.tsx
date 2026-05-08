import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, RefreshCw, ArrowUpDown, ExternalLink, Phone, Mail } from "lucide-react";
import { formatBRT } from "@/lib/brtTime";

interface LeadEntry {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  origem: string | null;
  origem_detalhe: string | null;
  campanha: string | null;
  campanha_id: string | null;
  formulario: string | null;
  plataforma: string | null;
  anuncio: string | null;
  conjunto_anuncio: string | null;
  observacoes: string | null;
  corretor_id: string | null;
  aceite_status: string | null;
  stage_id: string;
  created_at: string;
  distribuido_em: string | null;
  aceito_em: string | null;
}

interface StageInfo {
  id: string;
  nome: string;
  cor: string;
}

const PAGE_SIZE = 50;

export default function LeadsGeradosTab() {
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [corretorNames, setCorretorNames] = useState<Record<string, string>>({});
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [filterOrigem, setFilterOrigem] = useState("todas");
  const [filterPeriodo, setFilterPeriodo] = useState("7d");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      // Date filter
      let dateFrom: string | null = null;
      const now = new Date();
      if (filterPeriodo === "hoje") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (filterPeriodo === "7d") {
        dateFrom = new Date(now.getTime() - 7 * 86400000).toISOString();
      } else if (filterPeriodo === "30d") {
        dateFrom = new Date(now.getTime() - 30 * 86400000).toISOString();
      }

      let query = supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento, origem, origem_detalhe, campanha, campanha_id, formulario, plataforma, anuncio, conjunto_anuncio, observacoes, corretor_id, aceite_status, stage_id, created_at, distribuido_em, aceito_em", { count: "exact" })
        .order("created_at", { ascending: sortOrder === "asc" })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }

      if (search) {
        query = query.or(`nome.ilike.%${search}%,telefone.ilike.%${search}%,empreendimento.ilike.%${search}%,campanha.ilike.%${search}%`);
      }

      if (filterOrigem === "meta_ads") {
        query = query.or("plataforma.ilike.%meta%,plataforma.ilike.%facebook%,origem.ilike.%meta%,origem.ilike.%facebook%");
      } else if (filterOrigem === "jetimob") {
        query = query.ilike("origem", "%jetimob%");
      } else if (filterOrigem === "landing") {
        query = query.ilike("origem", "%landing%");
      } else if (filterOrigem === "manual") {
        query = query.or("origem.ilike.%manual%,origem.is.null");
      }

      const { data, error, count } = await query;
      if (error) throw error;

      setLeads(data || []);
      setTotal(count || 0);

      // Fetch corretor names
      const corretorIds = [...new Set((data || []).map(l => l.corretor_id).filter(Boolean))] as string[];
      if (corretorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", corretorIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach(p => { map[p.user_id] = p.nome; });
        setCorretorNames(map);
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterOrigem, filterPeriodo, sortOrder, page]);

  // Load stages
  useEffect(() => {
    supabase.from("pipeline_stages").select("id, nome, cor").eq("ativo", true).order("ordem")
      .then(({ data }) => setStages(data || []));
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const stageMap = Object.fromEntries(stages.map(s => [s.id, s]));

  const getStatusBadge = (lead: LeadEntry) => {
    if (!lead.corretor_id) {
      return <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Sem corretor</Badge>;
    }
    if (lead.aceite_status === "pendente") {
      return <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600">Pendente aceite</Badge>;
    }
    if (lead.aceite_status === "aceito") {
      return <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600">Aceito</Badge>;
    }
    if (lead.aceite_status === "rejeitado") {
      return <Badge variant="outline" className="text-[10px] border-red-300 text-red-600">Rejeitado</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">{lead.aceite_status || "—"}</Badge>;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, telefone, empreendimento..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 h-9"
          />
        </div>

        <Select value={filterOrigem} onValueChange={(v) => { setFilterOrigem(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas origens</SelectItem>
            <SelectItem value="meta_ads">Meta Ads</SelectItem>
            <SelectItem value="jetimob">Jetimob</SelectItem>
            <SelectItem value="landing">Landing Page</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPeriodo} onValueChange={(v) => { setFilterPeriodo(v); setPage(0); }}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="ghost" size="sm" className="h-9 px-2" onClick={() => setSortOrder(s => s === "desc" ? "asc" : "desc")}>
          <ArrowUpDown className="h-4 w-4" />
        </Button>

        <Button variant="outline" size="sm" className="h-9" onClick={fetchLeads}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" /> Atualizar
        </Button>

        <span className="text-xs text-muted-foreground ml-auto">{total} leads</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">Nenhum lead encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <ScrollArea className="rounded-lg border border-border/50">
          <div className="min-w-[900px]">
            {/* Header */}
            <div className="grid grid-cols-[1fr_140px_120px_130px_140px_100px_90px] gap-2 px-4 py-2.5 bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
              <span>Lead</span>
              <span>Empreendimento</span>
              <span>Origem</span>
              <span>Campanha</span>
              <span>Corretor</span>
              <span>Status</span>
              <span>Data</span>
            </div>

            {/* Rows */}
            {leads.map((lead) => {
              const stage = stageMap[lead.stage_id];
              return (
                <div
                  key={lead.id}
                  className="grid grid-cols-[1fr_140px_120px_130px_140px_100px_90px] gap-2 px-4 py-2.5 border-b border-border/30 hover:bg-accent/30 transition-colors items-center text-sm"
                >
                  {/* Lead info */}
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{lead.nome}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {lead.telefone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" /> {lead.telefone}
                        </span>
                      )}
                      {lead.email && (
                        <span className="flex items-center gap-0.5 truncate">
                          <Mail className="h-3 w-3" /> {lead.email}
                        </span>
                      )}
                    </div>
                    {lead.observacoes && (
                      <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">💬 {lead.observacoes}</p>
                    )}
                  </div>

                  {/* Empreendimento */}
                  <span className="text-xs font-medium text-foreground/80 truncate">
                    {lead.empreendimento || "—"}
                  </span>

                  {/* Origem */}
                  <div className="space-y-0.5">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {lead.plataforma || lead.origem || "—"}
                    </Badge>
                    {lead.formulario && (
                      <p className="text-[10px] text-muted-foreground truncate">📋 {lead.formulario}</p>
                    )}
                  </div>

                  {/* Campanha */}
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-foreground/80 truncate">{lead.campanha || lead.origem_detalhe || "—"}</p>
                    {lead.campanha_id && (
                      <p className="text-[10px] text-muted-foreground">ID: {lead.campanha_id}</p>
                    )}
                    {lead.anuncio && (
                      <p className="text-[10px] text-muted-foreground truncate">📢 {lead.anuncio}</p>
                    )}
                  </div>

                  {/* Corretor */}
                  <div className="min-w-0">
                    {lead.corretor_id ? (
                      <span className="text-xs font-medium text-primary truncate block">
                        {corretorNames[lead.corretor_id] || "—"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem corretor</span>
                    )}
                    {lead.distribuido_em && (
                      <p className="text-[10px] text-muted-foreground">
                        Dist: {format(new Date(lead.distribuido_em), "HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="space-y-1">
                    {getStatusBadge(lead)}
                    {stage && (
                      <div className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: stage.cor }} />
                        <span className="text-[10px] text-muted-foreground truncate">{stage.nome}</span>
                      </div>
                    )}
                  </div>

                  {/* Data */}
                  <div className="text-[11px] text-muted-foreground">
                    <p>{format(new Date(lead.created_at), "dd/MM", { locale: ptBR })}</p>
                    <p>{format(new Date(lead.created_at), "HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
