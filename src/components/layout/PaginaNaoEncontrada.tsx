import { Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EmptyState } from "@/components/ui/EmptyState";

/** Mostrada dentro do CRM quando o endereço digitado não existe. */
export default function PaginaNaoEncontrada() {
  const navigate = useNavigate();
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center shell-canvas p-6">
      <EmptyState
        icon={<Compass className="h-6 w-6" />}
        title="Página não encontrada"
        description="Esse endereço não existe ou mudou de lugar. Use a busca no topo ou volte para o início."
        action={{ label: "Voltar para o início", onClick: () => navigate("/") }}
      />
    </div>
  );
}
