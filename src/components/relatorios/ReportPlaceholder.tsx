import { Construction } from "lucide-react";

interface ReportPlaceholderProps {
  name: string;
}

export default function ReportPlaceholder({ name }: ReportPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-3">
      <Construction size={48} strokeWidth={1.2} />
      <p className="text-lg font-medium">Relatório {name} em construção</p>
      <p className="text-sm">Em breve estará disponível.</p>
    </div>
  );
}
