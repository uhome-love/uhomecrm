import { fmtVisitas } from "@/lib/visitasRoleta";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoletaRequisitos } from "@/hooks/useRoletaRequisitos";
import type { RoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";

export interface JanelaOpcao {
  value: string;
  label: string;
  disabled: boolean;
}

interface Alocacao {
  empreendimento_id: string;
  empreendimento_nome: string;
  segmento_nome?: string | null;
}

interface Props {
  subtitulo: string;
  opcoes: JanelaOpcao[];
  janela: string;
  onJanela: (v: string) => void;
  perf: RoletaPerformanceStatus | null | undefined;
  leadsDesatualizados: number | null;
  limiteDesatualizados: number | null;
  carregandoAlocacao: boolean;
  alocacao: Alocacao[];
  avisoAlocacao: ReactNode;
  avisos: ReactNode;
  onAtualizarAlocacao: () => void;
  onEntrar: () => void;
  entrando: boolean;
  desabilitado: boolean;
}

const NOME_TURNO: Record<string, string> = { manha: "da manhã", tarde: "da tarde", noturna: "da noite", dia_todo: "de hoje" };

function Linha({ label, valor, ok }: { label: string; valor: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 text-[15px]">
      <span>{label}</span>
      <span className={cn("font-semibold", ok === true && "text-emerald-600 dark:text-emerald-400", ok === false && "text-destructive", ok === null && "text-muted-foreground")}>
        {valor}
      </span>
    </div>
  );
}

export function RoletaEntrarMobile(p: Props) {
  const { data: vis } = useRoletaRequisitos();
  const crmPct = p.perf?.crm?.estado === "calculado" && p.perf.crm.pct != null ? Math.round(p.perf.crm.pct) : null;
  const crmMin = p.perf?.crm_minimo_pct ?? 80;
  const melhorVis = vis ? Math.max(vis.semanaPassada, vis.semanaAtual) : null;
  const visOk = vis ? melhorVis! >= vis.meta : null;

  return (
    <div className="pb-40">
      <h1 className="text-[30px] font-bold tracking-tight">Roleta</h1>
      <p className="text-sm text-muted-foreground">{p.subtitulo}</p>

      <p className="mt-5 mb-1.5 px-1 text-xs uppercase tracking-wide text-muted-foreground">Turno</p>
      <div className="flex rounded-xl bg-muted p-1">
        {p.opcoes.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={o.disabled}
            onClick={() => p.onJanela(o.value)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm transition-all",
              p.janela === o.value ? "bg-card font-semibold text-foreground shadow-sm" : "text-muted-foreground",
              o.disabled && "opacity-40"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <p className="mt-5 mb-1.5 px-1 text-xs uppercase tracking-wide text-muted-foreground">Seus requisitos</p>
      <div className="rounded-2xl bg-card px-4 shadow-sm">
        <Linha
          label="Visitas realizadas"
          valor={vis ? `${fmtVisitas(melhorVis)} de ${vis.meta} ${visOk ? "✓" : "✗"}` : "—"}
          ok={visOk}
        />
        <Linha
          label="CRM em dia"
          valor={crmPct != null ? `${crmPct}% ${crmPct >= crmMin ? "✓" : "✗"}` : "—"}
          ok={crmPct != null ? crmPct >= crmMin : null}
        />
        <Linha
          label="Leads desatualizados"
          valor={p.leadsDesatualizados != null ? `${p.leadsDesatualizados}` : "—"}
          ok={p.leadsDesatualizados != null && p.limiteDesatualizados != null ? p.leadsDesatualizados < p.limiteDesatualizados : null}
        />
      </div>
      {vis && (
        <p className="mt-1.5 px-1 text-xs text-muted-foreground">
          Semana passada: {fmtVisitas(vis.semanaPassada)} · Esta semana: {fmtVisitas(vis.semanaAtual)}. Vale a maior.
        </p>
      )}

      <div className="mt-5 mb-1.5 flex items-center justify-between px-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Seus empreendimentos hoje</p>
        <button type="button" onClick={p.onAtualizarAlocacao} className="text-xs font-medium text-primary">Atualizar</button>
      </div>
      {p.carregandoAlocacao ? (
        <div className="flex items-center gap-2 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : p.avisoAlocacao ? (
        p.avisoAlocacao
      ) : (
        <div className="rounded-2xl bg-card px-4 shadow-sm">
          {p.alocacao.map((a) => (
            <div key={a.empreendimento_id} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 text-[15px]">
              <span className="truncate">🏢 {a.empreendimento_nome}</span>
              {a.segmento_nome && <span className="ml-2 shrink-0 text-xs text-muted-foreground">{a.segmento_nome}</span>}
            </div>
          ))}
          <p className="py-2 text-xs text-muted-foreground">Definido pelo seu gestor.</p>
        </div>
      )}

      <div className="mt-4 space-y-2">{p.avisos}</div>

      <div className="fixed inset-x-0 z-30 px-4" style={{ bottom: "calc(64px + var(--sab, 0px))" }}>
        <button
          type="button"
          onClick={p.onEntrar}
          disabled={p.desabilitado}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-[17px] font-bold text-primary-foreground shadow-lg disabled:opacity-50"
        >
          {p.entrando && <Loader2 className="h-5 w-5 animate-spin" />}
          Entrar na Roleta {NOME_TURNO[p.janela] ?? ""}
        </button>
      </div>
    </div>
  );
}
