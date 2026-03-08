import { useOAAproveitados } from "@/hooks/useOfertaAtiva";
import { Button } from "@/components/ui/button";
import { CheckCircle, Copy, Loader2, User, Filter, Search } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function AproveitadosPanel() {
  const { aproveitados, isLoading, marcarCadastrado } = useOAAproveitados();
  const [jetimobIds, setJetimobIds] = useState<Record<string, string>>({});
  const [filterEmp, setFilterEmp] = useState("__all__");
  const [filterJetimob, setFilterJetimob] = useState("__all__");
  const [search, setSearch] = useState("");

  const empreendimentos = useMemo(() =>
    [...new Set(aproveitados.map(a => a.empreendimento).filter(Boolean))] as string[],
    [aproveitados]
  );

  const filtered = useMemo(() => {
    return aproveitados.filter(lead => {
      if (filterEmp !== "__all__" && lead.empreendimento !== filterEmp) return false;
      if (filterJetimob === "cadastrado" && !lead.cadastrado_jetimob) return false;
      if (filterJetimob === "pendente" && lead.cadastrado_jetimob) return false;
      if (search && !lead.nome.toLowerCase().includes(search.toLowerCase()) && !lead.telefone?.includes(search)) return false;
      return true;
    });
  }, [aproveitados, filterEmp, filterJetimob, search]);

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
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Leads com interesse aparecerão aqui para cadastro no Jetimob.</p>
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
        <select
          value={filterJetimob}
          onChange={e => setFilterJetimob(e.target.value)}
          className="h-8 text-xs px-3 rounded-lg outline-none cursor-pointer"
          style={{
            background: "#1C2128",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff",
            borderRadius: 8,
            minWidth: 140,
          }}
        >
          <option value="__all__">Todos</option>
          <option value="pendente">Pendente cadastro</option>
          <option value="cadastrado">Já cadastrado</option>
        </select>
      </div>

      {/* Lead cards */}
      {filtered.map(lead => (
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
                  {lead.cadastrado_jetimob ? "Cadastrado" : "Aproveitado"}
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
              <Copy className="h-3 w-3" /> Copiar resumo
            </button>
          </div>

          {/* Jetimob registration */}
          {!lead.cadastrado_jetimob && (
            <div
              className="mt-4 pt-4 flex items-center gap-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                className="h-8 text-xs flex-1 px-3 rounded-lg outline-none transition-colors"
                placeholder="ID do lead no Jetimob (opcional)"
                value={jetimobIds[lead.id] || ""}
                onChange={e => setJetimobIds(prev => ({ ...prev, [lead.id]: e.target.value }))}
                style={{
                  background: "#0A0F1E",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                  borderRadius: 8,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(34,197,94,0.4)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              />
              <button
                className="h-8 text-xs gap-1 px-4 rounded-lg font-semibold flex items-center transition-shadow"
                style={{
                  background: "#22C55E",
                  color: "#fff",
                  borderRadius: 8,
                  border: "none",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(34,197,94,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                onClick={() => marcarCadastrado(lead.id, jetimobIds[lead.id])}
              >
                <CheckCircle className="h-3 w-3" /> Cadastrado no Jetimob
              </button>
            </div>
          )}
          {lead.cadastrado_jetimob && (
            <div
              className="mt-4 pt-4 text-xs flex items-center gap-2"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "#6B7280" }}
            >
              <CheckCircle className="h-3.5 w-3.5" style={{ color: "#22C55E" }} />
              Cadastrado no Jetimob {lead.jetimob_id && <span className="font-mono" style={{ color: "#9CA3AF" }}>(ID: {lead.jetimob_id})</span>}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm" style={{ color: "#6B7280" }}>
          Nenhum resultado para os filtros selecionados.
        </div>
      )}
    </div>
  );
}
