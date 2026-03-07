import { useMemo } from "react";
import { type PdnEntry } from "@/hooks/usePdn";
import { Flame, Thermometer, Snowflake, FileText, CheckCircle, AlertTriangle, TrendingUp, Target, AlertCircle, Phone } from "lucide-react";
import { calcVgvProvavel, calcAlerts } from "@/lib/pdnScoring";

interface Props {
  total: number;
  quente: number;
  morno: number;
  frio: number;
  doc_completa: number;
  em_andamento: number;
  sem_docs: number;
  total_visitas: number;
  total_gerados: number;
  total_assinados: number;
  vgv_gerado: number;
  vgv_assinado: number;
  entries?: PdnEntry[];
}

function formatBRL(v: number) {
  if (!v) return "R$ 0";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function PdnStats({ total_visitas, total_gerados, total_assinados, quente, morno, frio, vgv_gerado, vgv_assinado, entries = [] }: Props) {
  const vgvProvavel = useMemo(() => calcVgvProvavel(entries), [entries]);
  const alerts = useMemo(() => calcAlerts(entries), [entries]);

  return (
    <div className="space-y-3">
      {/* Main stats */}
      <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
        <StatCard label="Negócios" value={total_visitas} icon="📋" />
        <StatCard label="Quente" value={quente} className="text-red-500" icon={<Flame className="h-3.5 w-3.5 text-red-500" />} />
        <StatCard label="Morno" value={morno} className="text-yellow-500" icon={<Thermometer className="h-3.5 w-3.5 text-yellow-500" />} />
        <StatCard label="Frio" value={frio} className="text-blue-500" icon={<Snowflake className="h-3.5 w-3.5 text-blue-500" />} />
        <StatCard label="Gerados" value={total_gerados} className="text-warning" icon={<FileText className="h-3.5 w-3.5 text-warning" />} subtitle={formatBRL(vgv_gerado)} />
        <StatCard label="Assinados" value={total_assinados} className="text-success" icon={<CheckCircle className="h-3.5 w-3.5 text-success" />} subtitle={formatBRL(vgv_assinado)} />
        <StatCard label="VGV Provável" value={0} className="text-primary" icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} subtitle={formatBRL(vgvProvavel)} hideValue />
        <StatCard label="VGV Assinado" value={0} className="text-success" icon="💰" subtitle={formatBRL(vgv_assinado)} hideValue />
      </div>

      {/* Alert badges */}
      {entries.length > 0 && (alerts.semProximaAcao > 0 || alerts.negociosParados > 0 || alerts.emRisco > 0 || alerts.proximosDeFecahr > 0) && (
        <div className="flex flex-wrap gap-2">
          {alerts.proximosDeFecahr > 0 && (
            <AlertBadge icon={<Target className="h-3 w-3" />} label={`${alerts.proximosDeFecahr} próximos de fechar`} variant="success" />
          )}
          {alerts.emRisco > 0 && (
            <AlertBadge icon={<AlertTriangle className="h-3 w-3" />} label={`${alerts.emRisco} em risco`} variant="danger" />
          )}
          {alerts.semProximaAcao > 0 && (
            <AlertBadge icon={<AlertCircle className="h-3 w-3" />} label={`${alerts.semProximaAcao} sem próxima ação`} variant="warning" />
          )}
          {alerts.negociosParados > 0 && (
            <AlertBadge icon={<Phone className="h-3 w-3" />} label={`${alerts.negociosParados} parados 5+ dias`} variant="danger" />
          )}
          {alerts.semDocs > 0 && (
            <AlertBadge icon="📄" label={`${alerts.semDocs} sem docs`} variant="muted" />
          )}
        </div>
      )}
    </div>
  );
}

function AlertBadge({ icon, label, variant }: { icon: React.ReactNode; label: string; variant: "success" | "danger" | "warning" | "muted" }) {
  const colors = {
    success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    danger: "bg-red-500/10 text-red-600 border-red-500/30",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    muted: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${colors[variant]}`}>
      {icon} {label}
    </span>
  );
}

function StatCard({ label, value, className, icon, subtitle, hideValue }: { label: string; value: number; className?: string; icon: React.ReactNode; subtitle?: string; hideValue?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      {!hideValue && <p className={`text-lg font-bold ${className || "text-foreground"}`}>{value}</p>}
      {subtitle && <p className={`text-xs font-semibold ${className || "text-foreground"}`}>{subtitle}</p>}
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
