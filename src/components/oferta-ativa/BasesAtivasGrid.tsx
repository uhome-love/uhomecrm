import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Search, Star, Users, Flame, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

type PotencialRow = {
  lista_id: string;
  nome: string;
  empreendimento: string | null;
  empreendimento_canonico_id: string | null;
  segmento_id: string | null;
  is_base_semana: boolean;
  total_leads: number;
  na_fila: number;
  ligados_hoje: number;
  tentativas_90d: number;
  aproveitados_90d: number;
  pct_aproveitamento_90d: number;
  potencial: "alto" | "bom" | "padrao";
};

const POTENCIAL_META: Record<
  PotencialRow["potencial"],
  { label: string; icon: string; bg: string; fg: string; border: string }
> = {
  alto:   { label: "Alto potencial", icon: "🎯", bg: "rgba(34,197,94,0.12)",  fg: "#22c55e", border: "rgba(34,197,94,0.35)" },
  bom:    { label: "Bom potencial",  icon: "⚡", bg: "rgba(59,130,246,0.12)", fg: "#60a5fa", border: "rgba(59,130,246,0.35)" },
  padrao: { label: "Padrão",         icon: "📞", bg: "rgba(148,163,184,0.10)", fg: "#94a3b8", border: "rgba(148,163,184,0.25)" },
};

export default function BasesAtivasGrid({
  onOpenLista,
}: {
  onOpenLista?: (listaId: string) => void;
}) {
  const { isAdmin, isGestor } = useUserRole();
  const canFlag = isAdmin || isGestor;
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["oa-bases-potencial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_oa_lista_potencial" as any)
        .select("*")
        .order("is_base_semana", { ascending: false })
        .order("na_fila", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as PotencialRow[];
    },
    staleTime: 60_000,
  });

  const toggleBaseSemana = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const { error } = await supabase
        .from("oferta_ativa_listas")
        .update({ is_base_semana: next })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_v, vars) => {
      qc.invalidateQueries({ queryKey: ["oa-bases-potencial"] });
      toast.success(vars.next ? "Marcada como Base da semana" : "Removida de Base da semana");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar"),
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter(
      (r) =>
        r.nome?.toLowerCase().includes(needle) ||
        r.empreendimento?.toLowerCase().includes(needle),
    );
  }, [data, q]);

  const totalNaFila = filtered.reduce((a, r) => a + (r.na_fila ?? 0), 0);
  const totalLigadosHoje = filtered.reduce((a, r) => a + (r.ligados_hoje ?? 0), 0);
  const totalAlto = filtered.filter((r) => r.potencial === "alto").length;

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile icon={<Users size={14} />} label="Bases ativas" value={filtered.length} />
        <SummaryTile icon={<Flame size={14} />} label="Leads na fila" value={totalNaFila} accent="#60a5fa" />
        <SummaryTile icon={<TrendingUp size={14} />} label="Ligações hoje" value={totalLigadosHoje} accent="#22c55e" />
        <SummaryTile icon={<Star size={14} />} label="Alto potencial" value={totalAlto} accent="#f59e0b" />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por empreendimento ou nome da base…"
          className="pl-9 h-10"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando bases…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhuma base encontrada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((row) => (
            <BaseCard
              key={row.lista_id}
              row={row}
              canFlag={canFlag}
              onToggleBaseSemana={(next) =>
                toggleBaseSemana.mutate({ id: row.lista_id, next })
              }
              onOpen={() => onOpenLista?.(row.lista_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  accent = "hsl(var(--foreground))",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1" style={{ color: accent }}>
        {value.toLocaleString("pt-BR")}
      </div>
    </div>
  );
}

function BaseCard({
  row,
  canFlag,
  onToggleBaseSemana,
  onOpen,
}: {
  row: PotencialRow;
  canFlag: boolean;
  onToggleBaseSemana: (next: boolean) => void;
  onOpen: () => void;
}) {
  const meta = POTENCIAL_META[row.potencial] ?? POTENCIAL_META.padrao;
  const semLeads = row.na_fila === 0;

  return (
    <div
      role="button"
      onClick={onOpen}
      className="group text-left rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5 relative flex flex-col gap-3 cursor-pointer"
      style={{ borderColor: row.is_base_semana ? "rgba(245,158,11,0.5)" : undefined }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {row.is_base_semana && (
              <span title="Base da semana" className="text-amber-500">
                <Star size={14} fill="currentColor" />
              </span>
            )}
            <h3 className="font-semibold text-sm truncate">
              {row.empreendimento || row.nome}
            </h3>
          </div>
          {row.empreendimento && row.nome && row.empreendimento !== row.nome && (
            <p className="text-[11px] text-muted-foreground truncate">{row.nome}</p>
          )}
        </div>

        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border"
          style={{ background: meta.bg, color: meta.fg, borderColor: meta.border }}
          title={meta.label}
        >
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat value={row.na_fila} label="na fila" color={semLeads ? "hsl(var(--muted-foreground))" : "#60a5fa"} />
        <Stat value={row.ligados_hoje} label="hoje" color="#22c55e" />
        <Stat
          value={`${row.pct_aproveitamento_90d}%`}
          label="aprov. 90d"
          color={row.pct_aproveitamento_90d >= 10 ? "#f59e0b" : "hsl(var(--muted-foreground))"}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-[11px] text-muted-foreground">
          {row.tentativas_90d} ligações em 90d
        </span>
        {canFlag && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBaseSemana(!row.is_base_semana);
            }}
            className="text-[11px] font-medium inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted"
            title={row.is_base_semana ? "Remover Base da semana" : "Marcar Base da semana"}
          >
            <Star size={12} className={row.is_base_semana ? "fill-amber-500 text-amber-500" : ""} />
            {row.is_base_semana ? "Base da semana" : "Marcar"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 py-1.5">
      <div className="text-base font-bold leading-none" style={{ color }}>
        {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
