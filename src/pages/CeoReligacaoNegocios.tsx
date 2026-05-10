import { useEffect, useMemo, useState } from "react";
import { Link2, AlertTriangle, Check, X, Search, Loader2, Copy, UserSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { negociosRelinkService } from "@/services/negociosRelinkService";
import BuscaManualLeadDialog from "@/components/ceo/BuscaManualLeadDialog";

interface NegocioRelink {
  id: string;
  nome_cliente: string;
  telefone: string | null;
  empreendimento: string | null;
  vgv_estimado: number | null;
  vgv_final: number | null;
  fase: string;
  created_at: string;
  lead_id: string | null;
  lead_id_proposto: string | null;
  lead_id_match_metodo: string | null;
  lead_id_match_score: number | null;
  requer_aprovacao_ceo: boolean;
  corretor_id: string | null;
  corretor_nome?: string | null;
}

interface LeadCandidato {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empreendimento_interesse: string | null;
  created_at: string;
}

const METODO_LABEL: Record<string, { label: string; cor: string }> = {
  A_nome_telefone_corretor: { label: "Ouro · nome+telefone+corretor", cor: "bg-emerald-100 text-emerald-800" },
  B_nome_telefone: { label: "Prata · nome+telefone", cor: "bg-blue-100 text-blue-800" },
  C_telefone_corretor: { label: "Bronze · telefone+corretor", cor: "bg-amber-100 text-amber-800" },
  D_somente_telefone: { label: "Frágil · só telefone", cor: "bg-orange-100 text-orange-800" },
  E_fuzzy_nome_corretor: { label: "Fuzzy · nome similar+corretor", cor: "bg-cyan-100 text-cyan-800" },
  manual: { label: "Manual", cor: "bg-violet-100 text-violet-800" },
  aprovado_ceo: { label: "✅ Aprovado pelo CEO", cor: "bg-emerald-200 text-emerald-900" },
  aprovado_auto: { label: "🤖 Auto-aprovado (3 sinais)", cor: "bg-emerald-200 text-emerald-900" },
  aprovado_auto_fuzzy: { label: "🤖 Auto-aprovado (fuzzy)", cor: "bg-cyan-200 text-cyan-900" },
  rejeitado: { label: "❌ Rejeitado", cor: "bg-rose-100 text-rose-800" },
};

const fmtBRL = (v: number | null) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type FiltroAba = "todos" | "ouro" | "ambiguos" | "ceo" | "sem_match" | "resolvidos";

export default function CeoReligacaoNegocios() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [negocios, setNegocios] = useState<NegocioRelink[]>([]);
  const [leadsMap, setLeadsMap] = useState<Record<string, LeadCandidato>>({});
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<FiltroAba>("ouro");
  const [busca, setBusca] = useState("");
  const [agindo, setAgindo] = useState<Record<string, boolean>>({});
  const [buscaManualOpen, setBuscaManualOpen] = useState(false);
  const [negocioBusca, setNegocioBusca] = useState<NegocioRelink | null>(null);

  const loadAll = async () => {
    setLoading(true);
    const { data: negs, error } = await supabase
      .from("negocios")
      .select(
        "id, nome_cliente, telefone, empreendimento, vgv_estimado, vgv_final, fase, created_at, lead_id, lead_id_proposto, lead_id_match_metodo, lead_id_match_score, requer_aprovacao_ceo, corretor_id",
      )
      .or("lead_id.is.null,lead_id_match_metodo.in.(aprovado_ceo,aprovado_auto,aprovado_auto_fuzzy,rejeitado)")
      .order("requer_aprovacao_ceo", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      toast.error("Erro ao carregar negócios: " + error.message);
      setLoading(false);
      return;
    }
    let list = (negs || []) as NegocioRelink[];

    // Resolve corretor_nome via profiles (negocios.corretor_id = profiles.id)
    const corretorIds = Array.from(new Set(list.map((n) => n.corretor_id).filter(Boolean))) as string[];
    if (corretorIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, nome").in("id", corretorIds);
      const pmap: Record<string, string> = {};
      (profs || []).forEach((p: any) => (pmap[p.id] = p.nome));
      list = list.map((n) => ({ ...n, corretor_nome: n.corretor_id ? pmap[n.corretor_id] : null }));
    }
    setNegocios(list);

    const propostos = Array.from(new Set(list.map((n) => n.lead_id_proposto).filter(Boolean))) as string[];
    if (propostos.length > 0) {
      const { data: leads } = await supabase
        .from("pipeline_leads")
        .select("id, nome, telefone, email, empreendimento_interesse, created_at")
        .in("id", propostos);
      const map: Record<string, LeadCandidato> = {};
      (leads || []).forEach((l: any) => (map[l.id] = l));
      setLeadsMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!roleLoading) loadAll();
  }, [roleLoading]);

  const isResolvido = (m: string | null) =>
    m === "aprovado_ceo" || m === "aprovado_auto" || m === "aprovado_auto_fuzzy" || m === "rejeitado";

  const counts = useMemo(() => {
    const c = { todos: 0, ouro: 0, ambiguos: 0, ceo: 0, sem_match: 0, resolvidos: 0 };
    for (const n of negocios) {
      c.todos++;
      if (isResolvido(n.lead_id_match_metodo)) c.resolvidos++;
      else if (!n.lead_id_proposto) c.sem_match++;
      else if (n.requer_aprovacao_ceo) c.ceo++;
      else if (n.lead_id_match_score === 2) c.ambiguos++;
      else c.ouro++;
    }
    return c;
  }, [negocios]);

  const filtrados = useMemo(() => {
    let arr = negocios;
    if (aba === "ouro")
      arr = arr.filter(
        (n) => n.lead_id_proposto && !n.requer_aprovacao_ceo && n.lead_id_match_score === 1 && !isResolvido(n.lead_id_match_metodo),
      );
    else if (aba === "ambiguos") arr = arr.filter((n) => n.lead_id_match_score === 2 && !isResolvido(n.lead_id_match_metodo));
    else if (aba === "ceo") arr = arr.filter((n) => n.requer_aprovacao_ceo);
    else if (aba === "sem_match") arr = arr.filter((n) => !n.lead_id_proposto && !n.lead_id_match_metodo);
    else if (aba === "resolvidos") arr = arr.filter((n) => isResolvido(n.lead_id_match_metodo));

    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(
        (n) =>
          n.nome_cliente?.toLowerCase().includes(q) ||
          n.telefone?.includes(q) ||
          n.empreendimento?.toLowerCase().includes(q),
      );
    }
    return arr;
  }, [negocios, aba, busca]);

  const handleAprovar = async (n: NegocioRelink) => {
    if (!n.lead_id_proposto) return;
    setAgindo((s) => ({ ...s, [n.id]: true }));
    try {
      await negociosRelinkService.approve(n.id, n.lead_id_proposto);
      toast.success(`Religado: ${n.nome_cliente}`);
      setNegocios((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, lead_id: n.lead_id_proposto, lead_id_match_metodo: "aprovado_ceo", requer_aprovacao_ceo: false, lead_id_match_score: 1 }
            : x,
        ),
      );
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setAgindo((s) => ({ ...s, [n.id]: false }));
    }
  };

  const handleRejeitar = async (n: NegocioRelink) => {
    setAgindo((s) => ({ ...s, [n.id]: true }));
    try {
      await negociosRelinkService.reject(n.id);
      toast.success("Sugestão rejeitada");
      setNegocios((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, lead_id_proposto: null, lead_id_match_metodo: "rejeitado", lead_id_match_score: null, requer_aprovacao_ceo: false }
            : x,
        ),
      );
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || e));
    } finally {
      setAgindo((s) => ({ ...s, [n.id]: false }));
    }
  };

  const handleCopiarResumo = (n: NegocioRelink) => {
    const lead = n.lead_id_proposto ? leadsMap[n.lead_id_proposto] : null;
    const vgv = (n.vgv_final ?? n.vgv_estimado ?? 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
    const linhas = [
      `🔴 NEGÓCIO #${n.id.slice(0, 8)} · ${n.fase.toUpperCase()}`,
      `Cliente: ${n.nome_cliente}`,
      `Telefone: ${n.telefone || "—"}`,
      `Empreendimento: ${n.empreendimento || "—"}`,
      `VGV: ${vgv}`,
      `Corretor: ${n.corretor_nome || "—"}`,
      `Criado: ${new Date(n.created_at).toLocaleDateString("pt-BR")}`,
      ``,
      `🟡 LEAD CANDIDATO (${n.lead_id_match_metodo || "—"}, score ${n.lead_id_match_score ?? "—"})`,
      lead
        ? `Nome: ${lead.nome}\nTelefone: ${lead.telefone || "—"}\nEmail: ${lead.email || "—"}\nInteresse: ${
            lead.empreendimento_interesse || "—"
          }\nCriado: ${new Date(lead.created_at).toLocaleDateString("pt-BR")}`
        : `Sem candidato — busca manual necessária`,
    ];
    navigator.clipboard.writeText(linhas.join("\n"));
    toast.success("Resumo copiado para revisão");
  };

  const handleAbrirBuscaManual = (n: NegocioRelink) => {
    setNegocioBusca(n);
    setBuscaManualOpen(true);
  };

  const handleManualLinked = (negocioId: string, leadId: string) => {
    setNegocios((prev) =>
      prev.map((x) =>
        x.id === negocioId
          ? { ...x, lead_id: leadId, lead_id_proposto: leadId, lead_id_match_metodo: "manual", lead_id_match_score: 1, requer_aprovacao_ceo: false }
          : x,
      ),
    );
  };

  if (roleLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return (
      <div className="p-8 text-center text-muted-foreground">
        Acesso restrito ao CEO. Contate o administrador.
      </div>
    );

  return (
    <div className="bg-[#f0f0f5] dark:bg-[#0e1525] p-6 -m-6 min-h-full space-y-4">
      <PageHeader
        title="Religação de Negócios"
        subtitle="Onda 0 · Reconectar negócios órfãos aos leads que os originaram"
        icon={<Link2 size={18} strokeWidth={1.5} />}
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={aba} onValueChange={(v) => setAba(v as FiltroAba)}>
            <TabsList>
              <TabsTrigger value="ouro">Ouro ({counts.ouro})</TabsTrigger>
              <TabsTrigger value="ambiguos">Ambíguos ({counts.ambiguos})</TabsTrigger>
              <TabsTrigger value="ceo" className="data-[state=active]:bg-amber-100">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" /> CEO ({counts.ceo})
              </TabsTrigger>
              <TabsTrigger value="sem_match">Sem match ({counts.sem_match})</TabsTrigger>
              <TabsTrigger value="resolvidos">Resolvidos ({counts.resolvidos})</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, telefone, empreendimento…" className="pl-9" />
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-muted-foreground py-16">Nenhum negócio nesta categoria.</div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((n) => {
            const lead = n.lead_id_proposto ? leadsMap[n.lead_id_proposto] : null;
            const vgv = n.vgv_final ?? n.vgv_estimado ?? 0;
            const metodo = n.lead_id_match_metodo ? METODO_LABEL[n.lead_id_match_metodo] : null;
            const resolvido = isResolvido(n.lead_id_match_metodo);
            return (
              <Card key={n.id} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center">
                  {/* NEGÓCIO */}
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Negócio órfão</div>
                    <div className="font-semibold">{n.nome_cliente}</div>
                    <div className="text-sm text-muted-foreground">
                      📞 {n.telefone || "—"} · 🏢 {n.empreendimento || "—"}
                    </div>
                    <div className="text-sm font-medium text-emerald-700 mt-1">VGV {fmtBRL(vgv)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Fase: {n.fase} · Criado: {new Date(n.created_at).toLocaleDateString("pt-BR")}
                    </div>
                    <div className="text-xs mt-1">
                      <span className="text-muted-foreground">👤 Corretor:</span>{" "}
                      <span className="font-medium">{n.corretor_nome || "—"}</span>
                    </div>
                  </div>

                  {/* SETA */}
                  <div className="text-2xl text-muted-foreground hidden md:block">→</div>

                  {/* LEAD CANDIDATO */}
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1 flex items-center gap-2">
                      Lead candidato
                      {metodo && <Badge className={metodo.cor}>{metodo.label}</Badge>}
                      {n.requer_aprovacao_ceo && <Badge className="bg-amber-200 text-amber-900">⚠️ Requer CEO</Badge>}
                    </div>
                    {lead ? (
                      <>
                        <div className="font-semibold">{lead.nome}</div>
                        <div className="text-sm text-muted-foreground">
                          📞 {lead.telefone || "—"} · ✉️ {lead.email || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          🏢 {lead.empreendimento_interesse || "—"} · Criado:{" "}
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground italic">
                        Sem candidato automático — busca manual necessária
                      </div>
                    )}
                  </div>

                  {/* AÇÕES */}
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    {resolvido ? (
                      <Badge className={metodo?.cor + " justify-center py-2"}>{metodo?.label}</Badge>
                    ) : lead ? (
                      <>
                        <Button size="sm" onClick={() => handleAprovar(n)} disabled={!!agindo[n.id]}>
                          <Check className="w-4 h-4" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRejeitar(n)} disabled={!!agindo[n.id]}>
                          <X className="w-4 h-4" /> Rejeitar
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="justify-center py-2">
                        Sem ação automática
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
