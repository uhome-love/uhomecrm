import { Link } from "react-router-dom";
import { CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomiAvatar } from "@/components/brand/HomiAvatar";
import { type Tone, toneDot, toneText } from "./tones";

/** Fala do Homi: no máximo uma por tela, sempre com próximo passo. */
export function HomiInsight({
  children,
  items,
  action,
  onAction,
  alert,
}: {
  children?: React.ReactNode;
  items?: string[];
  action: string;
  onAction?: () => void;
  alert?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-homi-border bg-homi-soft p-4">
      <HomiAvatar size={36} circle ring={alert} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-homi-text">Homi</p>
        {children && <p className="text-sm text-foreground">{children}</p>}
        {items && (
          <ul className="mt-1 space-y-0.5 text-sm text-foreground">
            {items.slice(0, 3).map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
        )}
      </div>
      <button
        onClick={onAction}
        className="shrink-0 rounded-[9px] border border-border bg-card px-3 py-1.5 text-sm font-semibold text-primary hover:bg-muted"
      >
        {action}
      </button>
    </div>
  );
}

interface Acao {
  label: string;
  href?: string;
}

function Rodape({ action }: { action?: Acao }) {
  if (!action) return null;
  return action.href ? (
    <Link to={action.href} className="mt-3 inline-block text-xs font-medium text-primary hover:underline">
      {action.label}
    </Link>
  ) : (
    <span className="mt-3 inline-block text-xs text-muted-foreground">{action.label}</span>
  );
}

/** Lista de indicadores com link para o destino. */
export function MetricList({
  title,
  icon: Icon,
  items,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  items: { label: string; value: string | number; tone?: Tone }[];
  action?: Acao;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
        {title}
      </h4>
      <dl className="divide-y divide-border/60">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between py-2 text-sm">
            <dt className="text-muted-foreground">{it.label}</dt>
            <dd className={cn("font-semibold tabular-nums", it.tone ? toneText[it.tone] : "text-foreground")}>
              {typeof it.value === "number" ? it.value.toLocaleString("pt-BR") : it.value}
            </dd>
          </div>
        ))}
      </dl>
      <Rodape action={action} />
    </div>
  );
}

/** Alertas com tom e palavra; estado vazio diz a regra checada. */
export function AlertList({
  title,
  icon: Icon,
  items,
  emptyText = "Tudo em dia",
  emptySub,
  action,
}: {
  title: string;
  icon?: LucideIcon;
  items: { tone: Tone; text: string; sub?: string }[];
  emptyText?: string;
  emptySub?: string;
  action?: Acao;
}) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
        {title}
      </h4>
      {items.length === 0 ? (
        <div className="flex items-start gap-2 rounded-lg bg-success-50 p-3 text-sm dark:bg-success/15">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
          <div>
            <p className="font-medium text-success-700 dark:text-success-500">{emptyText}</p>
            {emptySub && <p className="text-xs text-muted-foreground">{emptySub}</p>}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", toneDot[it.tone])} />
              <span>
                <span className="text-foreground">{it.text}</span>
                {it.sub && <span className="block text-xs text-muted-foreground">{it.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Rodape action={action} />
    </div>
  );
}
