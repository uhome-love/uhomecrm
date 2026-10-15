/** Fechamento semanal das visitas válidas (gravado toda segunda 00h05). Gerente vê a equipe; admin/diretor veem todos. Só leitura. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Linha { corretor_id: string; visitas_validas: number; crm_pct: number | null; situacao: "apto" | "evolucao" | "retomada"; um_a_um_pendente: boolean; nome: string }

const SIT = {
  apto: { t: "Apto", c: "bg-success-600/10 text-success-600" },
  evolucao: { t: "Em evolução", c: "bg-warning/10 text-warning" },
  retomada: { t: "Plano de retomada", c: "bg-destructive/10 text-destructive" },
} as const;

const fmtSemana = (ini: string) => {
  const d = new Date(`${ini}T12:00:00`); const f = new Date(d); f.setDate(d.getDate() + 6);
  const p = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
  return `${p(d)} a ${p(f)}`;
};

export default function FechamentoSemanalCard() {
  const { data: semanas = [] } = useQuery({
    queryKey: ["fechamento-semanas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roleta_fechamento_semanal").select("semana_inicio").order("semana_inicio", { ascending: false }).limit(500);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.semana_inicio as string)));
    },
  });
  const [sel, setSel] = useState<string | null>(null);
  const semana = sel ?? semanas[0] ?? null;

  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["fechamento-semanal", semana],
    enabled: !!semana,
    queryFn: async (): Promise<Linha[]> => {
      const { data, error } = await supabase.from("roleta_fechamento_semanal")
        .select("corretor_id, visitas_validas, crm_pct, situacao, um_a_um_pendente").eq("semana_inicio", semana!);
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.corretor_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("user_id, nome").in("user_id", ids) : { data: [] };
      const nomes = new Map((profs ?? []).map((p) => [p.user_id as string, p.nome as string]));
      return (data ?? []).map((r) => ({ ...(r as Omit<Linha, "nome">), nome: nomes.get(r.corretor_id) ?? "—" }))
        .sort((a, b) => b.visitas_validas - a.visitas_validas || a.nome.localeCompare(b.nome));
    },
  });

  const tot = useMemo(() => ({
    apto: linhas.filter((l) => l.situacao === "apto").length,
    evolucao: linhas.filter((l) => l.situacao === "evolucao").length,
    retomada: linhas.filter((l) => l.situacao === "retomada").length,
  }), [linhas]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fechamento semanal · visitas válidas</span>
        {semanas.length > 0 && (
          <select value={semana ?? ""} onChange={(e) => setSel(e.target.value)} className="ml-auto h-7 rounded-md border border-border bg-background px-2 text-xs">
            {semanas.map((s) => <option key={s} value={s}>Semana {fmtSemana(s)}</option>)}
          </select>
        )}
      </div>

      {!semana ? (
        <p className="text-sm text-muted-foreground">O primeiro fechamento sai na segunda, 19/10, às 00h05 (semana de 12 a 18/10).</p>
      ) : isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(["apto", "evolucao", "retomada"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-border p-2.5">
                <p className="text-[11px] text-muted-foreground">{SIT[k].t}</p>
                <p className={cn("text-2xl font-black", SIT[k].c.split(" ")[1])}>{tot[k]}</p>
              </div>
            ))}
          </div>
          <div className="divide-y divide-border text-sm">
            {linhas.map((l) => (
              <div key={l.corretor_id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{l.nome}</span>
                <span className="w-20 text-right text-xs text-muted-foreground">{l.visitas_validas} visita{l.visitas_validas === 1 ? "" : "s"}</span>
                <span className="w-16 text-right text-xs text-muted-foreground">CRM {l.crm_pct != null ? `${String(l.crm_pct).replace(".", ",")}%` : "—"}</span>
                <span className={cn("w-32 rounded-full px-2 py-0.5 text-center text-xs font-semibold", SIT[l.situacao].c)}>{SIT[l.situacao].t}</span>
                <span className="w-20 text-right text-xs font-semibold text-destructive">{l.um_a_um_pendente ? "1:1 pendente" : ""}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
