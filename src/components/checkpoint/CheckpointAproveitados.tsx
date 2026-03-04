import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Loader2, User, Search, Filter, Phone, Mail, MessageCircle, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AproveitadoLead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento: string | null;
  campanha: string | null;
  origem: string | null;
  corretor_nome: string;
  corretor_id: string;
  data_lead: string | null;
  cadastrado_jetimob: boolean;
  created_at: string;
}

export default function CheckpointAproveitados() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<AproveitadoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("__all__");
  const [filterEmp, setFilterEmp] = useState("__all__");

  useEffect(() => {
    if (!user) return;
    loadAproveitados();
  }, [user]);

  const loadAproveitados = async () => {
    if (!user) return;
    setLoading(true);

    // Get team members
    const { data: team } = await supabase
      .from("team_members")
      .select("id, nome, user_id")
      .eq("gerente_id", user.id)
      .eq("status", "ativo")
      .not("user_id", "is", null);

    if (!team || team.length === 0) { setLeads([]); setLoading(false); return; }

    const userIds = team.filter(t => t.user_id).map(t => t.user_id!);
    const userNameMap = new Map(team.map(t => [t.user_id!, t.nome]));

    // Get approved leads for these corretores
    const { data: aproveitados } = await supabase
      .from("oferta_ativa_leads")
      .select("*")
      .eq("status", "aproveitado")
      .in("corretor_id", userIds)
      .order("updated_at", { ascending: false });

    const mapped: AproveitadoLead[] = (aproveitados || []).map(l => ({
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      email: l.email,
      empreendimento: l.empreendimento,
      campanha: l.campanha,
      origem: l.origem,
      corretor_nome: userNameMap.get(l.corretor_id!) || "Corretor",
      corretor_id: l.corretor_id!,
      data_lead: l.data_lead,
      cadastrado_jetimob: l.cadastrado_jetimob,
      created_at: l.created_at,
    }));

    setLeads(mapped);
    setLoading(false);
  };

  const corretores = useMemo(() =>
    [...new Set(leads.map(l => l.corretor_nome))].sort(),
    [leads]
  );

  const empreendimentos = useMemo(() =>
    [...new Set(leads.map(l => l.empreendimento).filter(Boolean))] as string[],
    [leads]
  );

  const filtered = useMemo(() => {
    return leads.filter(lead => {
      if (filterCorretor !== "__all__" && lead.corretor_nome !== filterCorretor) return false;
      if (filterEmp !== "__all__" && lead.empreendimento !== filterEmp) return false;
      if (search && !lead.nome.toLowerCase().includes(search.toLowerCase()) && !lead.telefone?.includes(search)) return false;
      return true;
    });
  }, [leads, filterCorretor, filterEmp, search]);

  const copyResumo = (lead: AproveitadoLead) => {
    const text = [
      `Nome: ${lead.nome}`,
      lead.telefone ? `Telefone: ${lead.telefone}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      `Empreendimento: ${lead.empreendimento || "N/A"}`,
      `Corretor: ${lead.corretor_nome}`,
      lead.campanha ? `Campanha: ${lead.campanha}` : "",
      lead.origem ? `Origem: ${lead.origem}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum lead aproveitado pelo time</p>
          <p className="text-sm mt-1">Leads aproveitados pelos corretores aparecerão aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-500" />
        Leads Aproveitados do Time ({filtered.length}{filtered.length !== leads.length ? ` de ${leads.length}` : ""})
      </h3>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 pl-8 text-xs" placeholder="Buscar por nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterCorretor} onValueChange={setFilterCorretor}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <User className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Corretor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos corretores</SelectItem>
            {corretores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Empreendimento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos empreendimentos</SelectItem>
            {empreendimentos.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.map(lead => (
        <Card key={lead.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <h4 className="font-semibold text-foreground">{lead.nome}</h4>
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                    Aproveitado
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {lead.corretor_nome}
                  </Badge>
                  {lead.cadastrado_jetimob && (
                    <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                      Jetimob ✓
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {lead.telefone && <p className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.telefone}</p>}
                  {lead.email && <p className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</p>}
                  <p>🏢 {lead.empreendimento || "N/A"} {lead.campanha ? `· ${lead.campanha}` : ""} {lead.origem ? `· ${lead.origem}` : ""}</p>
                  {lead.data_lead && <p className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lead de {lead.data_lead}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="gap-1 text-xs h-7 shrink-0" onClick={() => copyResumo(lead)}>
                <Copy className="h-3 w-3" /> Copiar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum resultado para os filtros selecionados.</div>
      )}
    </div>
  );
}
