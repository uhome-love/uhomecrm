/**
 * LeadMatchesWidget — Shows top auto-matched properties for a lead.
 * Used inside the lead detail tabs (Radar Imóveis).
 * // v2 - layout compacto horizontal
 */
import { useState } from "react";
import { useLeadPropertyMatches } from "@/hooks/useLeadPropertyMatches";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, Star, Eye, Send, X, ExternalLink, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  leadId: string;
  leadNome: string;
  leadTelefone?: string | null;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

function scoreBadge(score: number) {
  if (score >= 80) return { label: `${score}%`, cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
  if (score >= 60) return { label: `${score}%`, cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
  if (score >= 40) return { label: `${score}%`, cls: "bg-orange-500/15 text-orange-700 border-orange-500/30" };
  return { label: `${score}%`, cls: "bg-muted text-muted-foreground border-border" };
}

const STATUS_ICONS: Record<string, { icon: typeof Star; cls: string }> = {
  favorito: { icon: Star, cls: "text-amber-500" },
  enviado: { icon: Send, cls: "text-primary" },
  descartado: { icon: X, cls: "text-destructive" },
};

export default function LeadMatchesWidget({ leadId, leadNome, leadTelefone }: Props) {
  const { matches, isLoading, refreshMatches, isRefreshing, updateMatchStatus } = useLeadPropertyMatches(leadId);
  const [filter, setFilter] = useState<"all" | "novo" | "favorito" | "enviado">("all");

  const filtered = matches.filter(m => {
    if (filter === "all") return m.status !== "descartado";
    return m.status === filter;
  });

  const handleRefresh = async () => {
    try {
      await refreshMatches();
      toast.success("Matches atualizados com sucesso!");
    } catch {
      toast.error("Erro ao atualizar matches");
    }
  };

  const handleCopyWhatsApp = (m: typeof matches[0]) => {
    if (!m.property) return;
    const p = m.property;
    const text = [
      `🏠 *${p.titulo || p.empreendimento || "Imóvel"}*`,
      `📍 ${p.bairro}`,
      `🛏 ${p.dormitorios} dorm${p.suites ? ` (${p.suites} suíte${p.suites > 1 ? "s" : ""})` : ""} · 🚗 ${p.vagas} vaga${p.vagas !== 1 ? "s" : ""}`,
      p.area_privativa ? `📐 ${p.area_privativa}m²` : "",
      p.valor_venda ? `💰 ${formatCurrency(p.valor_venda)}` : "",
      `\n🔗 ${window.location.origin}/imovel/${p.codigo}`,
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Copiado para WhatsApp!");
    updateMatchStatus({ matchId: m.id, status: "enviado" });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Matches Automáticos</h3>
          {matches.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{matches.length}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] gap-1"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Atualizar
        </Button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-1">
        {([
          { value: "all" as const, label: "Todos" },
          { value: "novo" as const, label: "🆕 Novos" },
          { value: "favorito" as const, label: "⭐ Favoritos" },
          { value: "enviado" as const, label: "📨 Enviados" },
        ]).map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-md border transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border hover:border-primary/50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-6 space-y-2">
          <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-xs text-muted-foreground">
            {matches.length === 0
              ? "Nenhum match encontrado. Preencha o perfil de interesse e clique em Atualizar."
              : "Nenhum resultado com este filtro."}
          </p>
        </div>
      )}

      {/* Match cards — lista compacta */}
      <div style={{ border: "0.5px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }} className="max-h-[400px] overflow-y-auto">
        {filtered.map((m, idx) => {
          const p = m.property;
          if (!p) return null;
          const badge = scoreBadge(m.score);

          return (
            <div
              key={m.id}
              className={cn(
                "transition-all",
                m.status === "descartado" && "opacity-40",
                m.status === "favorito" && "bg-amber-500/5",
              )}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                borderBottom: idx < filtered.length - 1 ? "0.5px solid hsl(var(--border))" : "none",
                background: "hsl(var(--background))",
              }}
            >
              {/* Foto */}
              <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                {p.fotos?.[0] ? (
                  <img src={p.fotos[0]} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", display: "block" }} />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: 8, background: "hsl(var(--muted))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sparkles className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                )}
                <span style={{
                  position: "absolute", bottom: 4, right: 4,
                  fontSize: 9, padding: "1px 4px", borderRadius: 4,
                  background: "#16a34a", color: "white", fontWeight: 700,
                }}>
                  {badge.label}
                </span>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <p style={{
                  fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", lineHeight: 1.3,
                  margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.titulo || p.empreendimento || `Cód. ${p.codigo}`}
                </p>
                {p.valor_venda && (
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", margin: 0 }}>
                    {formatCurrency(Number(p.valor_venda))}
                  </p>
                )}
                <p style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.bairro} · {p.dormitorios}d{p.suites ? `/${p.suites}s` : ""} · {p.vagas}v
                  {p.area_privativa ? ` · ${p.area_privativa}m²` : ""}
                </p>
                {(m as any).motivos?.includes("mesmo_empreendimento") && (
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "#FAEEDA", color: "#854F0B", alignSelf: "flex-start" }}>
                    Mesmo empreendimento
                  </span>
                )}
              </div>

              {/* Botões */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <button
                    onClick={() => handleCopyWhatsApp(m)}
                    style={{ fontSize: 10, color: "#16a34a", fontWeight: 500, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <Send style={{ width: 12, height: 12 }} /> WhatsApp
                  </button>
                  <button
                    onClick={() => window.open(`/imovel/${p.codigo}`, "_blank")}
                    style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <ExternalLink style={{ width: 12, height: 12 }} /> Ver
                  </button>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <button
                    onClick={() => updateMatchStatus({ matchId: m.id, status: m.status === "favorito" ? "novo" : "favorito" })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                  >
                    <Star style={{ width: 13, height: 13 }} className={cn("text-muted-foreground", m.status === "favorito" && "text-amber-500 fill-amber-500")} />
                  </button>
                  <button
                    onClick={() => updateMatchStatus({ matchId: m.id, status: "descartado" })}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}
                  >
                    <X style={{ width: 13, height: 13 }} className="text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
