import { useState, useEffect, useCallback } from "react";
import { Pencil, Check, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";

const EMPREENDIMENTOS = [
  "Alfa", "Orygem", "Las Casas", "Casa Tua", "Lake Eyre", "Open Bosque",
  "Casa Bastian", "Shift", "Seen Menino Deus", "Seen Três Figueiras", "Me Day",
  "Alto Lindóia", "Terrace", "Duetto", "Salzburg", "Melnick Day",
  "High Garden Iguatemi", "Boa Vista Country Club",
];

interface FichaData {
  entrada: string;
  metragens: string;
  entrega: string;
  desconto: string;
  localizacao: string;
  notas: string;
}

const EMPTY: FichaData = { entrada: "", metragens: "", entrega: "", desconto: "", localizacao: "", notas: "" };

const FIELDS: { key: keyof Omit<FichaData, "notas">; icon: string; label: string }[] = [
  { key: "entrada", icon: "💰", label: "Entrada" },
  { key: "metragens", icon: "📐", label: "Metragens" },
  { key: "entrega", icon: "🏗️", label: "Entrega" },
  { key: "desconto", icon: "🎯", label: "Desconto" },
  { key: "localizacao", icon: "📍", label: "Localização" },
];

interface Props {
  empreendimento: string;
  onEmpChange?: (emp: string) => void;
}

export default function FichaRapida({ empreendimento, onEmpChange }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<FichaData>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const debouncedNotas = useDebounce(data.notas, 1000);

  const hasAnyData = FIELDS.some(f => data[f.key].trim() !== "");

  useEffect(() => {
    if (!empreendimento) return;
    setLoaded(false);
    (async () => {
      const { data: row } = await supabase
        .from("empreendimento_fichas" as any)
        .select("*")
        .eq("empreendimento", empreendimento)
        .maybeSingle();
      if (row) {
        const r = row as any;
        setData({
          entrada: r.entrada || "",
          metragens: r.metragens || "",
          entrega: r.entrega || "",
          desconto: r.desconto || "",
          localizacao: r.localizacao || "",
          notas: r.notas || "",
        });
      } else {
        setData(EMPTY);
      }
      setLoaded(true);
    })();
  }, [empreendimento]);

  useEffect(() => {
    if (!loaded || !empreendimento) return;
    saveField("notas", debouncedNotas);
  }, [debouncedNotas]);

  const saveField = useCallback(async (field: string, value: string) => {
    if (!empreendimento || !user) return;
    await supabase
      .from("empreendimento_fichas" as any)
      .upsert(
        { empreendimento, [field]: value, atualizado_por: user.id, updated_at: new Date().toISOString() } as any,
        { onConflict: "empreendimento" }
      );
  }, [empreendimento, user]);

  const saveAll = async () => {
    if (!empreendimento || !user) return;
    setSaving(true);
    await supabase
      .from("empreendimento_fichas" as any)
      .upsert(
        {
          empreendimento,
          ...data,
          atualizado_por: user.id,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "empreendimento" }
      );
    setSaving(false);
    setEditing(false);
  };

  const updateField = (key: keyof FichaData, value: string) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{
        background: "var(--arena-card-bg)",
        border: "1px solid var(--arena-card-border)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span
            className="uppercase shrink-0"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#22D3EE" }}
          >
            📋 FICHA RÁPIDA
          </span>
          {onEmpChange ? (
            <select
              value={empreendimento}
              onChange={e => onEmpChange(e.target.value)}
              className="text-sm font-bold rounded-md px-1.5 ml-1 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 min-w-0"
              style={{
                background: "var(--arena-bg-from)",
                border: "1px solid var(--arena-card-border)",
                color: "var(--arena-text)",
                height: 26,
                maxWidth: 160,
              }}
            >
              <option value="" disabled>Selecionar...</option>
              {EMPREENDIMENTOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-bold" style={{ color: "var(--arena-text)" }}>· {empreendimento}</span>
          )}
        </div>
        <button
          onClick={() => {
            if (editing) saveAll();
            else setEditing(true);
          }}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          style={{ color: editing ? "#22D3EE" : "var(--arena-text-muted)" }}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : editing ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Pencil className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Empty state */}
      {!hasAnyData && !editing ? (
        <div className="py-3 text-center space-y-1">
          <p className="text-sm italic" style={{ color: "var(--arena-text-muted)" }}>
            📝 Nenhuma informação cadastrada ainda.
          </p>
          <p className="text-xs" style={{ color: "var(--arena-text-muted)" }}>
            Clique em{" "}
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-0.5 font-semibold"
              style={{ color: "#22D3EE" }}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>{" "}
            para adicionar dados do empreendimento como valores, metragens, descontos e dicas.
          </p>
        </div>
      ) : (
        /* Info fields */
        <div className="space-y-0.5">
          {FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-1.5 py-0.5">
              <span style={{ fontSize: 13 }}>{f.icon}</span>
              <span className="text-xs shrink-0" style={{ color: "var(--arena-text-muted)", minWidth: 76 }}>
                {f.label}:
              </span>
              {editing ? (
                <input
                  value={data[f.key]}
                  onChange={e => updateField(f.key, e.target.value)}
                  className="flex-1 text-sm bg-transparent border-b outline-none px-0.5 py-0"
                  style={{ color: "var(--arena-text)", borderColor: "var(--arena-card-border)" }}
                  placeholder="—"
                />
              ) : (
                <span className="text-sm" style={{ color: data[f.key] ? "var(--arena-text)" : "var(--arena-text-muted)" }}>
                  {data[f.key] || "—"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notas pessoais */}
      <div className="space-y-1">
        <span className="text-xs" style={{ color: "var(--arena-text-muted)" }}>
          📝 Notas pessoais:
        </span>
        <textarea
          value={data.notas}
          onChange={e => updateField("notas", e.target.value)}
          rows={2}
          placeholder="Anote pontos importantes pra não esquecer durante a ligação..."
          className="w-full text-sm rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          style={{
            background: "var(--arena-bg-from)",
            border: "1px solid var(--arena-card-border)",
            color: "var(--arena-text)",
            lineHeight: 1.5,
            scrollbarWidth: "thin",
          }}
        />
      </div>
    </div>
  );
}
