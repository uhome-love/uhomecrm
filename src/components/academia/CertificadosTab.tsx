import { Award } from "lucide-react";
import { useAcademia } from "@/hooks/useAcademia";
import { formatBRT } from "@/lib/brtTime";

export function CertificadosTab() {
  const { certificados, trilhas } = useAcademia();

  if (certificados.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Award className="h-12 w-12 text-muted-foreground/30 mb-3" />
        <h3 className="text-foreground font-bold">Nenhum certificado ainda</h3>
        <p className="text-sm text-muted-foreground">Conclua uma trilha inteira para emitir seu certificado.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(certificados as any[]).map((c) => {
        const trilha = trilhas.find((t) => t.id === c.trilha_id);
        return (
          <div key={c.id} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 flex items-start gap-3">
            <Award className="h-6 w-6 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{trilha?.titulo || "Trilha"}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Código: {c.codigo}</div>
              {c.emitido_at && (
                <div className="text-xs text-muted-foreground">Emitido em {formatBRT(c.emitido_at, "dd/MM/yyyy")}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
