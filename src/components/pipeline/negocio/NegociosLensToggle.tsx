import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NegociosLens } from "./boardPresentation";

export function NegociosLensToggle({ value, onChange }: { value: NegociosLens; onChange: (value: NegociosLens) => void }) {
  return <div role="group" aria-label="De quem são os negócios" className="inline-flex shrink-0 rounded-lg bg-muted p-0.5">
    {(["meus", "equipe"] as const).map(lens => <Button key={lens} variant="ghost" aria-pressed={value === lens} onClick={() => onChange(lens)}
      className={cn("h-8 px-3 text-xs duration-short", value === lens ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
      {lens === "meus" ? "Meus" : "Equipe"}
    </Button>)}
  </div>;
}