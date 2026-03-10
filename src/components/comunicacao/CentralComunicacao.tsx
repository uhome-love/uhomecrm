import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Copy, Star, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useMarketplace,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  type MarketplaceCategory,
} from "@/hooks/useMarketplace";

interface CentralComunicacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  leadNome?: string;
  leadTelefone?: string | null;
  leadEmpreendimento?: string;
  leadScore?: number;
  leadFase?: string;
}

const CATEGORY_FILTERS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "script_ligacao", label: "📞 Ligação" },
  { value: "whatsapp", label: "💬 WhatsApp" },
  { value: "argumento_empreendimento", label: "🏠 Argumentos" },
  { value: "quebra_objecao", label: "🛡️ Objeções" },
  { value: "template_proposta", label: "📊 Proposta" },
];

export default function CentralComunicacao({
  open,
  onOpenChange,
  leadNome,
  leadEmpreendimento,
}: CentralComunicacaoProps) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("todos");

  const category = catFilter === "todos" ? undefined : (catFilter as MarketplaceCategory);
  const { items, isLoading, useItem } = useMarketplace(category, "mais_usados", search || undefined);

  const handleCopy = (item: any) => {
    let text = item.conteudo || "";
    // Replace variables if lead context available
    if (leadNome) text = text.replace(/\{\{nome\}\}/g, leadNome);
    if (leadEmpreendimento) text = text.replace(/\{\{empreendimento\}\}/g, leadEmpreendimento);
    navigator.clipboard.writeText(text);
    useItem(item.id);
    toast.success("Script copiado! 📋");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        {/* Header */}
        <SheetHeader className="shrink-0 px-5 pt-5 pb-3 border-b border-border/50">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-primary" />
            Marketplace — Scripts Prontos
          </SheetTitle>
          {(leadNome || leadEmpreendimento) && (
            <p className="text-xs text-muted-foreground">
              {leadNome}{leadEmpreendimento ? ` · ${leadEmpreendimento}` : ""}
            </p>
          )}
        </SheetHeader>

        {/* Search */}
        <div className="shrink-0 px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar scripts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-card text-sm"
            />
          </div>
        </div>

        {/* Category pills */}
        <div className="shrink-0 px-5 pb-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setCatFilter(cat.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  catFilter === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum script encontrado</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Tente ajustar os filtros ou busca</p>
            </div>
          ) : (
            items.map((item: any) => (
              <ScriptCard key={item.id} item={item} onCopy={() => handleCopy(item)} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScriptCard({ item, onCopy }: { item: any; onCopy: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = item.conteudo?.slice(0, 180) + (item.conteudo?.length > 180 ? "..." : "");
  const catLabel = CATEGORY_LABELS[item.categoria as MarketplaceCategory]?.replace(/^.\s/, "") || item.categoria;
  const catIcon = CATEGORY_ICONS[item.categoria as MarketplaceCategory] || "📄";

  return (
    <Card className="border-border hover:border-primary/30 transition-all hover:shadow-md">
      <CardContent className="p-4">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-base">{catIcon}</span>
            <h3 className="font-semibold text-sm text-foreground truncate">{item.titulo}</h3>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">{catLabel}</Badge>
        </div>

        {/* Tags */}
        {(item.tags || []).length > 0 && (
          <div className="flex gap-1 flex-wrap mb-2">
            {(item.tags || []).slice(0, 3).map((t: string) => (
              <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">{t}</Badge>
            ))}
          </div>
        )}

        {/* Content preview */}
        <div
          className="text-xs text-muted-foreground whitespace-pre-wrap cursor-pointer bg-muted/30 rounded-lg p-3 border border-border hover:border-primary/20 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? item.conteudo : preview}
          {item.conteudo?.length > 180 && (
            <span className="text-primary text-[10px] ml-1 font-medium">
              {expanded ? "ver menos ↑" : "ver mais →"}
            </span>
          )}
        </div>

        {/* Footer: rating + use button */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`h-3 w-3 ${n <= Number(item.media_avaliacao || 0) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-0.5">({item.total_avaliacoes || 0})</span>
            </div>
            <span className="text-[10px] text-muted-foreground">📋 {item.total_usos || 0}x</span>
          </div>
          <Button size="sm" onClick={onCopy} className="gap-1 text-xs h-7">
            <Copy className="h-3 w-3" /> Usar script
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
