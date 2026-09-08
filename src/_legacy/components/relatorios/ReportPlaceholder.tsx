import { Construction } from "lucide-react";

interface ReportPlaceholderProps {
  tabName: string;
}

export default function ReportPlaceholder({ tabName }: ReportPlaceholderProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "#9ca3af",
        gap: 12,
      }}
    >
      <Construction size={48} strokeWidth={1.5} />
      <p style={{ fontSize: 18, fontWeight: 500, margin: 0 }}>Relatório {tabName}</p>
      <p style={{ fontSize: 14, margin: 0 }}>Em construção — disponível em breve</p>
    </div>
  );
}
