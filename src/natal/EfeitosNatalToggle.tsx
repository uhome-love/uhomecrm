import { Switch } from "@/components/ui/switch";
import { setEfeitos } from "./config";
import { useNatal } from "./useNatal";

/** Botão discreto em Configurações. Só aparece no período de Natal. */
export function EfeitosNatalToggle() {
  const { ativo, efeitos } = useNatal();
  if (!ativo) return null;
  return (
    <div className="flex items-center justify-between rounded-xl border bg-card p-4">
      <div>
        <p className="text-sm font-semibold">🎄 Efeitos de Natal: {efeitos ? "ligado" : "desligado"}</p>
        <p className="text-xs text-muted-foreground">Luzes, gorro e neve. Vale só neste aparelho.</p>
      </div>
      <Switch checked={efeitos} onCheckedChange={setEfeitos} aria-label="Efeitos de Natal" />
    </div>
  );
}
