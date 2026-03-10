import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle, Timer, User, Building2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Roletagem {
  id: string;
  nome: string;
  telefone: string | null;
  empreendimento: string | null;
  corretor_id: string | null;
  corretor_nome: string;
  aceite_status: string;
  distribuido_em: string | null;
  aceite_expira_em: string | null;
  aceito_em: string | null;
  segmento_nome: string;
}

interface LeadPerdido {
  id: string;
  pipeline_lead_id: string;
  corretor_id: string;
  corretor_nome: string;
  lead_nome: string;
  empreendimento: string | null;
  segmento_nome: string;
  created_at: string;
  tempo_resposta_seg: number | null;
}

function AceiteCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (remaining <= 0) return <span className="text-xs font-mono text-destructive font-bold">Expirado</span>;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const isUrgent = remaining < 120;

  return (
    <span className={`font-mono text-sm font-bold ${isUrgent ? "text-destructive animate-pulse" : "text-amber-600"}`}>
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

function getStatusConfig(status: string, expiresAt: string | null) {
  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  if (status === "aceito") {
    return { label: "Aceito ✅", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 };
  }
  if (status === "pendente" && isExpired) {
    return { label: "Expirado ⏰", color: "bg-destructive/10 text-destructive", icon: AlertTriangle };
  }
  if (status === "pendente") {
    return { label: "Aguardando aceite", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Timer };
  }
  if (status === "pendente_distribuicao") {
    return { label: "Na fila CEO", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: Clock };
  }
  if (status === "rejeitado") {
    return { label: "Rejeitado ❌", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle };
  }
  return { label: status, color: "bg-muted text-muted-foreground", icon: Clock };
}

export default function RoletagensTab() {
  const [roletagens, setRoletagens] = useState<Roletagem[]>([]);
  const [leadsPerdidos, setLeadsPerdidos] = useState<LeadPerdido[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoletagens = useCallback(async () => {
    setLoading(true);
    try {
      // Get leads that have been distributed (have distribuido_em set)
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, empreendimento, corretor_id, aceite_status, distribuido_em, aceite_expira_em, aceito_em, segmento_id")
        .not("distribuido_em", "is", null)
        .order("distribuido_em", { ascending: false })
        .limit(100);

      if (!leads || leads.length === 0) {
        setRoletagens([]);
      } else {
        // Resolve corretor names and segment names
        const corretorIds = [...new Set(leads.map(l => l.corretor_id).filter(Boolean))] as string[];
        const segmentoIds = [...new Set(leads.map(l => l.segmento_id).filter(Boolean))] as string[];

        const [profilesRes, segRes] = await Promise.all([
          corretorIds.length > 0 ? supabase.from("profiles").select("user_id, nome").in("user_id", corretorIds) : { data: [] },
          segmentoIds.length > 0 ? supabase.from("pipeline_segmentos").select("id, nome").in("id", segmentoIds) : { data: [] },
        ]);

        const profMap = new Map((profilesRes.data || []).map(p => [p.user_id, p.nome]));
        const segMap = new Map((segRes.data || []).map(s => [s.id, s.nome]));

        setRoletagens(leads.map(l => ({
          id: l.id,
          nome: l.nome || "Lead",
          telefone: l.telefone,
          empreendimento: l.empreendimento,
          corretor_id: l.corretor_id,
          corretor_nome: l.corretor_id ? profMap.get(l.corretor_id) || "Corretor" : "—",
          aceite_status: l.aceite_status || "pendente",
          distribuido_em: l.distribuido_em,
          aceite_expira_em: l.aceite_expira_em,
          aceito_em: l.aceito_em,
          segmento_nome: l.segmento_id ? segMap.get(l.segmento_id) || "—" : "—",
        })));
      }

      // Load expired/timeout leads from distribuicao_historico
      const { data: perdidos } = await supabase
        .from("distribuicao_historico")
        .select("id, pipeline_lead_id, corretor_id, segmento_id, tempo_resposta_seg, created_at")
        .eq("acao", "timeout")
        .order("created_at", { ascending: false })
        .limit(50);

      if (perdidos && perdidos.length > 0) {
        const pCorretorIds = [...new Set(perdidos.map(p => p.corretor_id).filter(Boolean))] as string[];
        const pLeadIds = [...new Set(perdidos.map(p => p.pipeline_lead_id).filter(Boolean))] as string[];
        const pSegIds = [...new Set(perdidos.map(p => p.segmento_id).filter(Boolean))] as string[];

        const [profs, leadsData, segs] = await Promise.all([
          pCorretorIds.length > 0 ? supabase.from("profiles").select("user_id, nome").in("user_id", pCorretorIds) : { data: [] },
          pLeadIds.length > 0 ? supabase.from("pipeline_leads").select("id, nome, empreendimento").in("id", pLeadIds) : { data: [] },
          pSegIds.length > 0 ? supabase.from("pipeline_segmentos").select("id, nome").in("id", pSegIds) : { data: [] },
        ]);

        const profMap2 = new Map((profs.data || []).map(p => [p.user_id, p.nome]));
        const leadMap = new Map((leadsData.data || []).map(l => [l.id, l]));
        const segMap2 = new Map((segs.data || []).map(s => [s.id, s.nome]));

        setLeadsPerdidos(perdidos.map(p => {
          const lead = leadMap.get(p.pipeline_lead_id);
          return {
            id: p.id,
            pipeline_lead_id: p.pipeline_lead_id,
            corretor_id: p.corretor_id,
            corretor_nome: profMap2.get(p.corretor_id) || "Corretor",
            lead_nome: lead?.nome || "Lead",
            empreendimento: lead?.empreendimento || null,
            segmento_nome: p.segmento_id ? segMap2.get(p.segmento_id) || "—" : "—",
            created_at: p.created_at,
            tempo_resposta_seg: p.tempo_resposta_seg,
          };
        }));
      } else {
        setLeadsPerdidos([]);
      }
    } catch (err) {
      console.error("Error loading roletagens:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoletagens();
  }, [loadRoletagens]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel("roletagens-live")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pipeline_leads",
      }, () => loadRoletagens())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadRoletagens]);

  const pendentes = roletagens.filter(r => r.aceite_status === "pendente");
  const aceitos = roletagens.filter(r => r.aceite_status === "aceito");
  const expiradosOuRejeitados = roletagens.filter(r => 
    r.aceite_status === "rejeitado" || 
    r.aceite_status === "pendente_distribuicao" ||
    (r.aceite_status === "pendente" && r.aceite_expira_em && new Date(r.aceite_expira_em) < new Date())
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{pendentes.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-amber-600/80 font-semibold">Aguardando aceite</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-300/50 bg-emerald-50/50 dark:bg-emerald-950/10">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{aceitos.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-emerald-600/80 font-semibold">Aceitos</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{expiradosOuRejeitados.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-destructive/80 font-semibold">Expirados / Rejeitados</p>
          </CardContent>
        </Card>
        <Card className="border-orange-300/50 bg-orange-50/50 dark:bg-orange-950/10">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">{leadsPerdidos.length}</p>
            <p className="text-[10px] uppercase tracking-wide text-orange-600/80 font-semibold">Leads Perdidos (Timeout)</p>
          </CardContent>
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadRoletagens} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Leads aguardando aceite (highlight) */}
      {pendentes.length > 0 && (
        <Card className="border-amber-400/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Timer className="h-4 w-4 text-amber-600" />
              Aguardando Aceite ({pendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendentes.map(r => {
                const isExpired = r.aceite_expira_em && new Date(r.aceite_expira_em) < new Date();
                return (
                  <div key={r.id} className={`flex items-center justify-between p-3 rounded-lg border ${isExpired ? "border-destructive/40 bg-destructive/5" : "border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10"}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          {r.corretor_nome.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.nome}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" /> {r.corretor_nome}
                          </span>
                          {r.empreendimento && (
                            <span className="flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" /> {r.empreendimento}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className="text-[10px]">{r.segmento_nome}</Badge>
                      {r.aceite_expira_em && !isExpired ? (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-amber-600" />
                          <AceiteCountdown expiresAt={r.aceite_expira_em} />
                        </div>
                      ) : isExpired ? (
                        <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leads Perdidos por Timeout */}
      {leadsPerdidos.length > 0 && (
        <Card className="border-orange-400/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Leads Perdidos por Timeout ({leadsPerdidos.length})
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">Corretores que não aceitaram o lead dentro do prazo de 10 minutos</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 font-medium">Lead</th>
                    <th className="pb-2 font-medium">Corretor que perdeu</th>
                    <th className="pb-2 font-medium">Segmento</th>
                    <th className="pb-2 font-medium">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsPerdidos.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5">
                        <div>
                          <p className="font-medium text-sm">{p.lead_nome}</p>
                          {p.empreendimento && (
                            <p className="text-[10px] text-muted-foreground">{p.empreendimento}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300">
                              {p.corretor_nome.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{p.corretor_nome}</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <Badge variant="outline" className="text-[10px]">{p.segmento_nome}</Badge>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All roletagens table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Histórico de Roletagens</CardTitle>
        </CardHeader>
        <CardContent>
          {roletagens.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma roletagem registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-xs">
                    <th className="pb-2 font-medium">Lead</th>
                    <th className="pb-2 font-medium">Corretor</th>
                    <th className="pb-2 font-medium">Segmento</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Timer</th>
                    <th className="pb-2 font-medium">Distribuído</th>
                  </tr>
                </thead>
                <tbody>
                  {roletagens.map(r => {
                    const statusConf = getStatusConfig(r.aceite_status, r.aceite_expira_em);
                    const StatusIcon = statusConf.icon;
                    const isLivePendente = r.aceite_status === "pendente" && r.aceite_expira_em && new Date(r.aceite_expira_em) > new Date();

                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5">
                          <div>
                            <p className="font-medium text-sm">{r.nome}</p>
                            {r.empreendimento && (
                              <p className="text-[10px] text-muted-foreground">{r.empreendimento}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px]">
                                {r.corretor_nome.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs">{r.corretor_nome}</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <Badge variant="outline" className="text-[10px]">{r.segmento_nome}</Badge>
                        </td>
                        <td className="py-2.5">
                          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConf.color}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConf.label}
                          </div>
                        </td>
                        <td className="py-2.5">
                          {isLivePendente && r.aceite_expira_em ? (
                            <AceiteCountdown expiresAt={r.aceite_expira_em} />
                          ) : r.aceite_status === "aceito" && r.aceito_em && r.distribuido_em ? (
                            <span className="text-xs text-emerald-600 font-medium">
                              {Math.round((new Date(r.aceito_em).getTime() - new Date(r.distribuido_em).getTime()) / 60000)}min
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {r.distribuido_em ? formatDistanceToNow(new Date(r.distribuido_em), { addSuffix: true, locale: ptBR }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}