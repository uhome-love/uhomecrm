/** Blocos visuais da aba Performance da Roleta (só leitura). */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtVisitas } from "@/lib/visitasRoleta";
import { META_VISITAS, type ForaRow, type AptoRow, type Selo } from "@/lib/performanceRoletaPresentation";

export function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return <section className={cn("min-w-0 rounded-xl border border-border bg-card p-4", className)}>{title && <h3 className="mb-3 text-sm font-semibold">{title}</h3>}{children}</section>;
}

export function Kpi({ label, value, extra, sub, tone }: { label: string; value: string | number; extra?: string; sub?: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold sm:text-3xl", tone)}>{value}{extra && <span className="ml-1 text-xs font-medium text-muted-foreground">{extra}</span>}</p>
      {sub && <p className="text-xs text-muted-foreground break-words">{sub}</p>}
    </div>
  );
}

const SELO: Record<Selo, { t: string; c: string }> = {
  perto: { t: "Perto", c: "bg-warning/15 text-warning" },
  sem_agenda: { t: "Sem agenda", c: "bg-destructive/10 text-destructive" },
  crm: { t: "CRM", c: "bg-destructive/10 text-destructive" },
  descartes: { t: "Descartes", c: "bg-muted text-muted-foreground" },
  outro: { t: "Outro", c: "bg-muted text-muted-foreground" },
};
const Pill = ({ t, c }: { t: string; c: string }) => <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", c)}>{t}</span>;

function Barra({ r, m }: { r: number; m: number }) {
  const w = (x: number) => `${Math.min(100, (x / META_VISITAS) * 100)}%`;
  return <span className="relative inline-block h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
    <i className="absolute inset-y-0 left-0 bg-warning/40" style={{ width: w(r + m) }} />
    <i className="absolute inset-y-0 left-0 bg-warning" style={{ width: w(r) }} />
  </span>;
}

function useVerTodos<T>(rows: T[], n = 6) {
  const [all, set] = useState(false);
  return { vis: all ? rows : rows.slice(0, n), btn: rows.length > n ? <button onClick={() => set(!all)} className="mt-2 text-xs font-medium text-primary">{all ? "Mostrar menos" : `Ver todos (${rows.length}) →`}</button> : null };
}

export function ForaDaRoleta({ rows }: { rows: ForaRow[] }) {
  const { vis, btn } = useVerTodos(rows);
  return (
    <Card title="Fora da roleta — o que falta para voltar">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Todo mundo está apto agora.</p> : (
        <div className="divide-y divide-border text-sm">
          {vis.map((f) => (
            <div key={f.c.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{f.c.nome}</p><p className="truncate text-xs text-muted-foreground">{f.c.equipe}</p></div>
              <div className="min-w-0 text-right sm:w-56 sm:text-left">
                <p className="text-xs font-semibold">Falta {f.falta}</p>
                <p className="flex items-center justify-end gap-2 text-xs text-muted-foreground sm:justify-start">
                  {(f.selo === "perto" || f.selo === "sem_agenda") && <Barra r={Number(f.c.visitas_semana_atual)} m={f.c.visitas_marcadas_semana} />}
                  <span className="truncate">{f.detalhe}</span>
                </p>
              </div>
              <Pill {...SELO[f.selo]} />
            </div>
          ))}
        </div>
      )}
      {btn}
    </Card>
  );
}

export function AptosAgora({ rows }: { rows: AptoRow[] }) {
  const { vis, btn } = useVerTodos(rows);
  return (
    <Card title="Aptos agora">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ninguém apto agora.</p> : (
        <div className="divide-y divide-border text-sm">
          {vis.map((a) => (
            <div key={a.c.user_id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{a.c.nome}</p><p className="truncate text-xs text-muted-foreground">{a.porque}</p></div>
              {a.voltouHoje ? <Pill t="voltou hoje" c="bg-success-500/15 text-success-500" /> : a.voltouNaSemana ? <Pill t="voltou na semana" c="bg-success-500/10 text-success-500" /> : null}
            </div>
          ))}
        </div>
      )}
      {btn}
    </Card>
  );
}

const DIAS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
export function EvolucaoSemana({ pontos, total, seg }: { pontos: { i: number; valor: number; previsao: boolean; hoje: boolean }[]; total: number; seg: Date }) {
  const max = Math.max(1, total);
  return (
    <Card title="Evolução da semana — aptos por dia">
      <div className="flex h-36 items-end justify-between gap-1.5 sm:gap-3">
        {pontos.map((p) => {
          const d = new Date(seg); d.setDate(seg.getDate() + p.i);
          return (
            <div key={p.i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className={cn("text-xs font-semibold", p.previsao && "text-muted-foreground")}>{p.valor}</span>
              <div className={cn("w-full max-w-10 rounded-md", p.previsao ? "border-2 border-dashed border-border" : p.hoje ? "bg-primary" : "bg-primary/40")} style={{ height: `${Math.max(6, (p.valor / max) * 90)}px` }} />
              <span className="text-[10px] text-muted-foreground">{DIAS[p.i]} {d.getDate()}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Tracejado = previsão se as visitas marcadas acontecerem. Usa o CRM de hoje.</p>
    </Card>
  );
}

export interface SemanaAgg { ini: string; label: string; aptos: number; total: number; visitas: number }
export function UltimasSemanas({ semanas, aberto, onToggle, children }: { semanas: SemanaAgg[]; aberto: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <Card title="Últimas semanas">
      {semanas.length === 0 ? <p className="text-sm text-muted-foreground">Sem fechamentos ainda.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-muted-foreground"><th className="pb-2 font-medium">Semana</th><th className="pb-2 font-medium">Aptos</th><th className="pb-2 font-medium">Visitas</th><th className="pb-2 font-medium">Média</th></tr></thead>
          <tbody className="divide-y divide-border">
            {semanas.map((s) => (
              <tr key={s.ini}><td className="py-2">{s.label}</td><td className="py-2">{s.aptos} <span className="text-xs text-muted-foreground">de {s.total}</span></td><td className="py-2">{fmtVisitas(s.visitas)}</td><td className="py-2">{s.total ? fmtVisitas(Math.round((s.visitas / s.total) * 10) / 10) : "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <button onClick={onToggle} className="mt-2 text-xs font-medium text-primary">{aberto ? "Fechar corretor por corretor" : "Ver corretor por corretor →"}</button>
      {aberto && <div className="mt-3">{children}</div>}
    </Card>
  );
}
