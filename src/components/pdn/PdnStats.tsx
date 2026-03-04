import { Flame, Thermometer, Snowflake, FileCheck, FileClock, FileX } from "lucide-react";

interface Props {
  total: number;
  quente: number;
  morno: number;
  frio: number;
  doc_completa: number;
  em_andamento: number;
  sem_docs: number;
}

export default function PdnStats({ total, quente, morno, frio, doc_completa, em_andamento, sem_docs }: Props) {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
      <StatCard label="Total Visitas" value={total} icon="📊" />
      <StatCard label="Quente" value={quente} className="text-red-500" icon={<Flame className="h-3.5 w-3.5 text-red-500" />} />
      <StatCard label="Morno" value={morno} className="text-yellow-500" icon={<Thermometer className="h-3.5 w-3.5 text-yellow-500" />} />
      <StatCard label="Frio" value={frio} className="text-blue-500" icon={<Snowflake className="h-3.5 w-3.5 text-blue-500" />} />
      <StatCard label="Doc Completa" value={doc_completa} className="text-green-500" icon={<FileCheck className="h-3.5 w-3.5 text-green-500" />} />
      <StatCard label="Em Andamento" value={em_andamento} className="text-orange-500" icon={<FileClock className="h-3.5 w-3.5 text-orange-500" />} />
      <StatCard label="Sem Docs" value={sem_docs} className="text-muted-foreground" icon={<FileX className="h-3.5 w-3.5 text-muted-foreground" />} />
    </div>
  );
}

function StatCard({ label, value, className, icon }: { label: string; value: number; className?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <p className={`text-lg font-bold ${className || "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
