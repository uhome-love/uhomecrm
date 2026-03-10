import { useOAAproveitados } from "@/hooks/useOfertaAtiva";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Loader2, User, Search, UserPlus, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function AproveitadosPanel() {
  const { aproveitados, isLoading } = useOAAproveitados();
  const { user } = useAuth();
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [search, setSearch] = useState("");
  const [addingToPlId, setAddingToPlId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<Record<string, "exists" | "added">>({});

  const empreendimentos = useMemo(() =>
    [...new Set(aproveitados.map(a => a.empreendimento).filter(Boolean))] as string[],
    [aproveitados]
  );

  const filtered = useMemo(() => {
    return aproveitados.filter(lead => {
      if (filterEmp !== "__all__" && lead.empreendimento !== filterEmp) return false;
      if (search && !lead.nome.toLowerCase().includes(search.toLowerCase()) && !lead.telefone?.includes(search)) return false;
      return true;
    });
  }, [aproveitados, filterEmp, search]);

  const copyResumo = (lead: typeof aproveitados[0]) => {
    const text = [
      `Nome: ${lead.nome}`,
      lead.telefone ? `Telefone: ${lead.telefone}` : "",
      lead.email ? `Email: ${lead.email}` : "",
      `Empreendimento: ${lead.empreendimento || "N/A"}`,
      lead.campanha ? `Campanha: ${lead.campanha}` : "",
      lead.origem ? `Origem: ${lead.origem}` : "",
      lead.observacoes ? `Obs: ${lead.observacoes}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado!");
  };

  const addToPipeline = useCallback(async (lead: typeof aproveitados[0]) => {
    if (!user) return;
    setAddingToPlId(lead.id);
    try {
      // Check if already in pipeline by phone
      if (lead.telefone) {
        const { data: existing } = await supabase
          .from("pipeline_leads")
          .select("id")
          .or(`telefone.eq.${lead.telefone},telefone.eq.${lead.telefone?.replace(/\D/g, "")}`)
          .limit(1);
        if (existing && existing.length > 0) {
          setPipelineStatus(prev => ({ ...prev, [lead.id]: "exists" }));
          toast.info("Este lead já existe no Pipeline de Leads");
          setAddingToPlId(null);
          return;
        }
      }

      // Get first stage
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_tipo", "leads")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1);
      const stageId = stages?.[0]?.id;
      if (!stageId) {
        toast.error("Nenhum estágio configurado");
        setAddingToPlId(null);
        return;
      }

      const { error } = await supabase.from("pipeline_leads").insert({
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        empreendimento: lead.empreendimento,
        origem: "Oferta Ativa",
        origem_detalhe: lead.campanha || lead.origem || "Aproveitado OA",
        corretor_id: user.id,
        stage_id: stageId,
        aceite_status: "aceito",
        aceito_em: new Date().toISOString(),
        observacoes: `Lead aproveitado na Oferta Ativa. Tentativas: ${lead.tentativas_count || 0}`,
        created_by: user.id,
      });

      if (error) throw error;
      setPipelineStatus(prev => ({ ...prev, [lead.id]: "added" }));
      toast.success("✅ Lead incluído no seu Pipeline!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao incluir no pipeline");
    }
    setAddingToPlId(null);
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" style={{ background: "#0A0F1E" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#22C55E" }} />
      </div>
    );
  }

  if (aproveitados.length === 0) {
    return (
      <div
        className="py-12 text-center rounded-2xl"
        style={{ background: "#1C2128", border: "1px solid rgba(34,197,94,0.2)" }}
      >
        <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-40" style={{ color: "#22C55E" }} />
        <p className="font-medium" style={{ color: "#E5E7EB" }}>Nenhum lead aproveitado ainda</p>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Leads com interesse aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" style={{ background: "#0A0F1E", minHeight: "100%" }}>
      {/* Header */}
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "#4ADE80" }}>
        <CheckCircle className="h-4 w-4" style={{ color: "#4ADE80" }} />
        ✅ Leads Aproveitados ({filtered.length}{filtered.length !== aproveitados.length ? ` de ${aproveitados.length}` : ""})
      </h3>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5" style={{ color: "#6B7280" }} />
          <input
            className="h-8 w-full pl-8 text-xs rounded-lg outline-none"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: "#1C2128",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              borderRadius: 8,
            }}
          />
        </div>
        <select
          value={filterEmp}
          onChange={e => setFilterEmp(e.target.value)}
          className="h-8 text-xs px-3 rounded-lg outline-none cursor-pointer"
          style={{
            background: "#1C2128",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: 8,
            minWidth: 160,
          }}
        >
          <option value="__all__">Todos empreendimentos</option>
          {empreendimentos.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Lead cards */}
      {filtered.map(lead => {
        const plStatus = pipelineStatus[lead.id];
        return (
          <div
            key={lead.id}
            className="rounded-2xl"
            style={{
              background: "#1C2128",
              border: "1px solid rgba(34,197,94,0.2)",
              borderRadius: 16,
              padding: 20,
              boxShadow: "0 0 16px rgba(34,197,94,0.05)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <User className="h-4 w-4 shrink-0" style={{ color: "#4ADE80" }} />
                  <h4 className="font-bold text-lg" style={{ color: "#fff" }}>{lead.nome}</h4>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(34,197,94,0.2)",
                      color: "#4ADE80",
                      border: "1px solid rgba(34,197,94,0.3)",
                    }}
                  >
                    Aproveitado
                  </span>
                </div>
                <div className="space-y-0.5">
                  {lead.telefone && <p className="text-sm" style={{ color: "#D1D5DB" }}>📞 {lead.telefone}</p>}
                  {lead.email && <p className="text-sm" style={{ color: "#9CA3AF" }}>✉️ {lead.email}</p>}
                  <p className="text-xs" style={{ color: "#6B7280" }}>
                    🏢 {lead.empreendimento || "N/A"} {lead.campanha ? `· ${lead.campanha}` : ""}
                  </p>
                </div>
              </div>

              <button
                className="flex items-center gap-1 text-xs h-7 px-3 rounded-lg shrink-0 transition-colors"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#9CA3AF",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.3)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#fff";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.color = "#9CA3AF";
                }}
                onClick={() => copyResumo(lead)}
              >
                <Copy className="h-3 w-3" /> Copiar
              </button>
            </div>

            {/* Pipeline action */}
            <div
              className="mt-4 pt-4 flex items-center gap-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              {plStatus === "added" ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#4ADE80" }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="font-semibold">Incluído no Pipeline</span>
                  <a href="/pipeline" className="flex items-center gap-1 ml-2 underline" style={{ color: "#60A5FA" }}>
                    <ExternalLink className="h-3 w-3" /> Ver Pipeline
                  </a>
                </div>
              ) : plStatus === "exists" ? (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#60A5FA" }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Já existe no Pipeline</span>
                  <a href="/pipeline" className="flex items-center gap-1 ml-2 underline" style={{ color: "#60A5FA" }}>
                    <ExternalLink className="h-3 w-3" /> Ver Pipeline
                  </a>
                </div>
              ) : (
                <button
                  className="h-8 text-xs gap-1.5 px-4 rounded-lg font-semibold flex items-center transition-shadow disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6, #6366F1)",
                    color: "#fff",
                    borderRadius: 8,
                    border: "none",
                  }}
                  disabled={addingToPlId === lead.id}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(99,102,241,0.4)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                  onClick={() => addToPipeline(lead)}
                >
                  {addingToPlId === lead.id ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Incluindo...</>
                  ) : (
                    <><UserPlus className="h-3.5 w-3.5" /> Incluir no Pipeline de Leads</>
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: "#6B7280" }}>
          Nenhum resultado para os filtros selecionados.
        </div>
      )}
    </div>
  );
}
