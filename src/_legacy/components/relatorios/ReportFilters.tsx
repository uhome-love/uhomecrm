import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const PERIOD_CHIPS = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "custom", label: "Personalizado" },
];

const SEGMENTOS = [
  { value: "", label: "Todos os segmentos" },
  { value: "mcmv", label: "MCMV" },
  { value: "medio-alto", label: "Médio-Alto" },
  { value: "altissimo", label: "Altíssimo" },
  { value: "investimento", label: "Investimento" },
];

interface Filters {
  periodo: string;
  dataInicio?: string;
  dataFim?: string;
  equipe: string;
  corretor: string;
  segmento: string;
}

interface ReportFiltersProps {
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  userRole: "admin" | "gestor" | "corretor";
  onExport?: () => void;
}

const chipBase: React.CSSProperties = {
  border: "0.5px solid #d1d5db",
  color: "#6b7280",
  backgroundColor: "#fff",
  borderRadius: 20,
  padding: "5px 14px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const chipActive: React.CSSProperties = {
  ...chipBase,
  backgroundColor: "#EEF2FF",
  color: "#4F46E5",
  borderColor: "#C7D2FE",
  fontWeight: 500,
};

const selectStyle: React.CSSProperties = {
  ...chipBase,
  appearance: "none" as const,
  paddingRight: 24,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
};

interface EquipeOption { auth_user_id: string; nome: string }
interface CorretorOption { auth_user_id: string; nome: string }

export default function ReportFilters({ filters, onFiltersChange, userRole, onExport }: ReportFiltersProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [equipes, setEquipes] = useState<EquipeOption[]>([]);
  const [corretores, setCorretores] = useState<CorretorOption[]>([]);

  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  // Load equipes (gerentes) — admin only
  useEffect(() => {
    if (userRole !== "admin") return;
    let cancelled = false;
    (async () => {
      const { data: members } = await supabase
        .from("team_members")
        .select("gerente_id")
        .eq("status", "ativo")
        .not("gerente_id", "is", null);
      const gerenteIds = [...new Set((members || []).map((m) => m.gerente_id).filter(Boolean) as string[])];
      if (gerenteIds.length === 0) { if (!cancelled) setEquipes([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", gerenteIds);
      const list = (profs || [])
        .filter((p) => p.user_id)
        .map((p) => ({ auth_user_id: p.user_id as string, nome: p.nome || "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      if (!cancelled) setEquipes(list);
    })();
    return () => { cancelled = true; };
  }, [userRole]);

  // Load corretores — filtered by equipe if selected
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let userIds: string[] | null = null;
      if (filters.equipe) {
        const { data: members } = await supabase
          .from("team_members")
          .select("user_id")
          .eq("gerente_id", filters.equipe)
          .eq("status", "ativo");
        userIds = [...new Set((members || []).map((m) => m.user_id).filter(Boolean) as string[])];
        if (userIds.length === 0) { if (!cancelled) setCorretores([]); return; }
      } else if (userRole === "gestor") {
        // Gestor sees only their team — resolved server-side via RLS in most queries; here we still try to scope
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: members } = await supabase
            .from("team_members")
            .select("user_id")
            .eq("gerente_id", user.id)
            .eq("status", "ativo");
          userIds = [...new Set((members || []).map((m) => m.user_id).filter(Boolean) as string[])];
          if (userIds.length === 0) { if (!cancelled) setCorretores([]); return; }
        }
      }
      let q = supabase.from("profiles").select("user_id, nome").eq("cargo", "corretor");
      if (userIds) q = q.in("user_id", userIds);
      const { data: profs } = await q;
      const list = (profs || [])
        .filter((p) => p.user_id)
        .map((p) => ({ auth_user_id: p.user_id as string, nome: p.nome || "—" }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
      if (!cancelled) setCorretores(list);
    })();
    return () => { cancelled = true; };
  }, [filters.equipe, userRole]);

  return (
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "0.5px solid #e5e7eb",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      {PERIOD_CHIPS.map((chip) => (
        <button
          key={chip.key}
          onClick={() => set({ periodo: chip.key })}
          style={filters.periodo === chip.key ? chipActive : chipBase}
        >
          {chip.label}
        </button>
      ))}

      {filters.periodo === "custom" && (
        <>
          <input
            type="date"
            value={filters.dataInicio || ""}
            onChange={(e) => set({ dataInicio: e.target.value })}
            style={{ ...chipBase, padding: "4px 10px" }}
          />
          <input
            type="date"
            value={filters.dataFim || ""}
            onChange={(e) => set({ dataFim: e.target.value })}
            style={{ ...chipBase, padding: "4px 10px" }}
          />
        </>
      )}

      <div style={{ width: 1, height: 20, backgroundColor: "#e5e7eb", margin: "0 4px" }} />

      {userRole === "admin" && (
        <select
          value={filters.equipe}
          onChange={(e) => set({ equipe: e.target.value, corretor: "" })}
          style={selectStyle}
        >
          <option value="">Todas as equipes</option>
          {equipes.map((eq) => (
            <option key={eq.auth_user_id} value={eq.auth_user_id}>{eq.nome}</option>
          ))}
        </select>
      )}

      <select
        value={filters.corretor}
        onChange={(e) => set({ corretor: e.target.value })}
        style={selectStyle}
      >
        <option value="">Todos os corretores</option>
        {corretores.map((c) => (
          <option key={c.auth_user_id} value={c.auth_user_id}>{c.nome}</option>
        ))}
      </select>

      <select
        value={filters.segmento}
        onChange={(e) => set({ segmento: e.target.value })}
        style={selectStyle}
      >
        {SEGMENTOS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onExport?.()}
          style={{
            backgroundColor: "#4F46E5",
            color: "#fff",
            borderRadius: 20,
            padding: "5px 16px",
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Download size={13} strokeWidth={1.5} />
          Exportar PDF
        </button>
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast({ title: "Link copiado!" });
          }}
          style={{
            ...chipBase,
            border: copied ? "0.5px solid #C7D2FE" : "0.5px solid #d1d5db",
            color: copied ? "#4F46E5" : "#6b7280",
          }}
        >
          {copied ? "✓ Copiado!" : "🔗 Link"}
        </button>
      </div>
    </div>
  );
}
