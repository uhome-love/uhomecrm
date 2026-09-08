import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function PulseEmptyState() {
  const navigate = useNavigate();

  return (
    <div className="text-center py-8 px-4">
      <p className="text-2xl mb-2">⚡</p>
      <p className="text-sm font-semibold text-foreground">O Pulse está quieto...</p>
      <p className="text-xs text-muted-foreground mt-1">
        Faça a primeira ligação do dia e seja o primeiro no feed!
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 gap-1.5 text-xs"
        onClick={() => navigate("/oferta-ativa")}
      >
        🚀 Ir para Arena
      </Button>
    </div>
  );
}
