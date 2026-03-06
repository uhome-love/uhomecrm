import { Flame, Thermometer, Snowflake, FileCheck, FileClock, FileX, FileText, CheckCircle } from "lucide-react";

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
}

function formatBRL(v: number) {
  if (!v) return "R$ 0";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function PdnStats({ total_visitas, total_gerados, total_assinados, quente, morno, frio, vgv_gerado, vgv_assinado }: Props) {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      <StatCard label="Negócios" value={total_visitas} icon="📋" />
      <StatCard label="Quente" value={quente} className="text-red-500" icon={<Flame className="h-3.5 w-3.5 text-red-500" />} />
      <StatCard label="Morno" value={morno} className="text-yellow-500" icon={<Thermometer className="h-3.5 w-3.5 text-yellow-500" />} />
      <StatCard label="Frio" value={frio} className="text-blue-500" icon={<Snowflake className="h-3.5 w-3.5 text-blue-500" />} />
      <StatCard label="Gerados" value={total_gerados} className="text-warning" icon={<FileText className="h-3.5 w-3.5 text-warning" />} subtitle={formatBRL(vgv_gerado)} />
      <StatCard label="Assinados" value={total_assinados} className="text-success" icon={<CheckCircle className="h-3.5 w-3.5 text-success" />} subtitle={formatBRL(vgv_assinado)} />
      <StatCard label="VGV Total" value={0} className="text-primary" icon="💰" subtitle={formatBRL(vgv_assinado)} hideValue />
      <StatCard label="VGV Projetado" value={0} className="text-accent-foreground" icon="📊" subtitle={formatBRL(vgv_gerado + vgv_assinado)} hideValue />
    </div>
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
