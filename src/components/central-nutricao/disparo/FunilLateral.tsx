import { Loader2, Send, TrendingUp, Timer, Building2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FunilData {
  por_fonte?: Record<string, number>;
  total_bruto?: number;
  total_em_descarte?: number;
  count_pre_dedup?: number;
  duplicados_removidos?: number;
  telefones_invalidos?: number;
  suprimidos_meta?: number;
  removidos_pipeline_ativo?: number;
  removidos_frequencia?: number;
  em_cooldown?: number;
  cooldown_dias?: number;
  inativados_definitivos?: number;
  sem_telefone?: number;
  arquivados?: number;
  elegiveis?: number;
}

interface Props {
  loading: boolean;
  count: number | null;
  funil?: FunilData | null;
  breakdownEmpreendimento?: Array<{ empreendimento: string; total: number }>;
  ultimoDisparoTemplate?: { template: string; quantos: number; quando: string } | null;
  canal: "meta" | "evolution";
  templateName?: string;
  onDisparar: () => void;
  firing: boolean;
  onFocusEmpreendimento?: (nome: string) => void;
}

function formatDuracao(nLeads: number): string {
  const seconds = nLeads * 4.5;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `~${m} min`;
  return `~${h}h ${m}min`;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "há menos de 1h";
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export default function FunilLateral({
  loading,
  count,
  funil,
  breakdownEmpreendimento,
  ultimoDisparoTemplate,
  canal,
  templateName,
  onDisparar,
  firing,
  onFocusEmpreendimento,
}: Props) {
  const elegiveis = funil?.elegiveis ?? count ?? 0;
  const bruto = funil?.total_bruto ?? funil?.total_em_descarte ?? funil?.count_pre_dedup ?? null;

  return (
    <div className="rounded-lg border bg-background/60 backdrop-blur p-3 sticky top-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">
        <TrendingUp className="h-3.5 w-3.5" /> Funil ao vivo
        {loading && <Loader2 className="h-3 w-3 animate-spin ml-auto text-muted-foreground" />}
      </div>

      {/* Elegíveis destaque */}
      <div className="rounded-md border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-950/40 p-3 text-center">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Elegíveis para disparo</div>
        <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
          {loading && count === null ? "—" : elegiveis.toLocaleString("pt-BR")}
        </div>
        {elegiveis > 0 && (
          <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <Timer className="h-3 w-3" /> {formatDuracao(elegiveis)}
          </div>
        )}
      </div>

      {/* Funil cascata */}
      {funil && (
        <div className="text-[11px] space-y-0.5 font-mono">
          {bruto != null && (
            <FunilRow label="Total bruto" value={bruto} tone="neutral" />
          )}
          {funil.por_fonte && Object.entries(funil.por_fonte).map(([k, v]) => (
            <FunilRow key={k} label={`  · ${k.replace(/_/g, " ")}`} value={v as number} tone="muted" indent />
          ))}
          {(funil.duplicados_removidos ?? 0) > 0 && (
            <FunilRow label="− Duplicados" value={-(funil.duplicados_removidos ?? 0)} tone="warn" />
          )}
          {(funil.inativados_definitivos ?? 0) > 0 && (
            <FunilRow label="− Inativados definitivos" value={-(funil.inativados_definitivos ?? 0)} tone="warn" />
          )}
          {(funil.sem_telefone ?? 0) > 0 && (
            <FunilRow label="− Sem telefone" value={-(funil.sem_telefone ?? 0)} tone="warn" />
          )}
          {(funil.telefones_invalidos ?? 0) > 0 && (
            <FunilRow label="− Telefones inválidos" value={-(funil.telefones_invalidos ?? 0)} tone="warn" />
          )}
          {(funil.arquivados ?? 0) > 0 && (
            <FunilRow label={`− Arquivados`} value={-(funil.arquivados ?? 0)} tone="muted" />
          )}
          {(funil.suprimidos_meta ?? 0) > 0 && (
            <FunilRow label="− Suprimidos Meta" value={-(funil.suprimidos_meta ?? 0)} tone="warn" />
          )}
          {(funil.removidos_pipeline_ativo ?? 0) > 0 && (
            <FunilRow label="− Já ativos no pipeline" value={-(funil.removidos_pipeline_ativo ?? 0)} tone="warn" />
          )}
          {(funil.em_cooldown ?? 0) > 0 && (
            <FunilRow
              label={`− Cooldown ${funil.cooldown_dias ?? 7}d`}
              value={-(funil.em_cooldown ?? 0)}
              tone="warn"
            />
          )}
          {(funil.removidos_frequencia ?? 0) > 0 && (
            <FunilRow label="− Anti-fadiga" value={-(funil.removidos_frequencia ?? 0)} tone="warn" />
          )}
          <div className="flex justify-between border-t pt-1 mt-1">
            <span className="font-semibold">= Elegíveis</span>
            <span className="font-bold text-indigo-700 dark:text-indigo-300">{elegiveis.toLocaleString("pt-BR")}</span>
          </div>
        </div>
      )}

      {/* Breakdown por empreendimento */}
      {breakdownEmpreendimento && breakdownEmpreendimento.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
            <Building2 className="h-3 w-3" /> Por empreendimento (top {Math.min(6, breakdownEmpreendimento.length)})
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {breakdownEmpreendimento.slice(0, 6).map((e) => (
              <li key={e.empreendimento}>
                <button
                  type="button"
                  onClick={() => onFocusEmpreendimento?.(e.empreendimento)}
                  className="w-full flex justify-between hover:bg-muted rounded px-1 -mx-1 group text-left"
                  title="Filtrar apenas este empreendimento"
                >
                  <span className="truncate text-muted-foreground group-hover:text-foreground">{e.empreendimento}</span>
                  <span className="font-mono tabular-nums">{e.total.toLocaleString("pt-BR")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Alerta último disparo */}
      {ultimoDisparoTemplate && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-2 text-[10px] flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-amber-800 dark:text-amber-300">
              Template já disparado {relTime(ultimoDisparoTemplate.quando)}
            </div>
            <div className="text-muted-foreground">
              {ultimoDisparoTemplate.quantos.toLocaleString("pt-BR")} envios nas últimas 24h de <span className="font-mono">{ultimoDisparoTemplate.template}</span>
            </div>
          </div>
        </div>
      )}

      {/* Info template selecionado */}
      {canal === "meta" && templateName && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <span>🎯 Meta</span>
          <Badge variant="outline" className="text-[9px] font-mono truncate max-w-full">{templateName}</Badge>
        </div>
      )}

      {/* Disparar */}
      <Button
        className="w-full h-11 text-sm font-semibold"
        onClick={onDisparar}
        disabled={firing || loading || elegiveis === 0}
      >
        {firing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
        {elegiveis > 0 ? `Disparar ${elegiveis.toLocaleString("pt-BR")}` : "Disparar"}
      </Button>
    </div>
  );
}

function FunilRow({
  label, value, tone, indent,
}: { label: string; value: number; tone: "neutral" | "warn" | "muted"; indent?: boolean }) {
  const color = tone === "warn" ? "text-amber-600 dark:text-amber-400" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className={`flex justify-between ${indent ? "pl-2" : ""}`}>
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`tabular-nums ${color}`}>{value.toLocaleString("pt-BR")}</span>
    </div>
  );
}
