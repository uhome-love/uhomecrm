import { useState, useMemo, useCallback, useRef } from "react";
import { useNegocios, NEGOCIOS_FASES, type Negocio, type CorretorInfo } from "@/hooks/useNegocios";
import { useLeadProgression } from "@/hooks/useLeadProgression";
import { useLeadsParados } from "@/hooks/useLeadsParados";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import JornadaLead from "@/components/pipeline/JornadaLead";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, RefreshCw, Briefcase, X, SlidersHorizontal, LayoutGrid, ChevronLeft, ChevronRight, TrendingUp, Clock, MessageCircle, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import AddNegocioDialog from "@/components/pipeline/AddNegocioDialog";

function formatVGV(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2).replace(".", ",")}M`;
  if (value >= 1_000) return `R$ ${value.toLocaleString("pt-BR")}`;
  return `R$ ${value}`;
}

const TEAM_COLORS: Record<string, string> = {
  "gabrielle": "bg-pink-500/15 text-pink-600 border-pink-500/30",
  "bruno": "bg-blue-500/15 text-blue-600 border-blue-500/30",
  "gabriel": "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

function getTeamColorClass(equipe: string | null) {
  if (!equipe) return "bg-muted text-muted-foreground";
  const key = equipe.toLowerCase().replace("equipe ", "").trim();
  return TEAM_COLORS[key] || "bg-muted text-muted-foreground";
}

function NegocioCard({ negocio, corretorNome, corretorInfo, showCorretor, paradoInfo, onDragStart, onClick }: {
  negocio: Negocio;
  corretorNome?: string;
  corretorInfo?: CorretorInfo;
  showCorretor?: boolean;
  paradoInfo?: { diasParado: number; severity: "warning" | "danger" };
  onDragStart: () => void;
  onClick: () => void;
}) {
  const faseInfo = NEGOCIOS_FASES.find(f => f.key === negocio.fase);
  const daysInFase = differenceInDays(new Date(), new Date(negocio.fase_changed_at || negocio.created_at));
  const [comunicacaoOpen, setComunicacaoOpen] = useState(false);

  return (
    <>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        onClick={onClick}
        className="group rounded-lg border bg-card cursor-pointer active:cursor-grabbing hover:bg-accent/40 transition-all duration-150 select-none overflow-hidden"
        style={{ borderLeftWidth: 3, borderLeftColor: faseInfo?.cor || "#6B7280" }}
      >
        <div className="px-3 pt-2.5 pb-2 space-y-1.5">
          {/* Header: JornadaLead + parado badge */}
          <div className="flex items-center justify-between">
            <JornadaLead moduloAtual="negocios" size="sm" />
            <div className="flex items-center gap-1">
              {paradoInfo && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  paradoInfo.severity === "danger"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-amber-500/10 text-amber-600"
                }`}>
                  {paradoInfo.severity === "danger" ? "🔥" : "⚠️"} {paradoInfo.diasParado}d
                </span>
              )}
              <span className={`text-[10px] font-bold ${
                daysInFase <= 3 ? "text-emerald-600" : daysInFase <= 7 ? "text-amber-600" : "text-red-600"
              }`}>
                {daysInFase}d
              </span>
            </div>
          </div>

          {/* Name */}
          <p className="text-[13px] font-bold text-foreground truncate">{negocio.nome_cliente}</p>

          {/* Empreendimento */}
          {negocio.empreendimento && (
            <p className="text-[11px] text-muted-foreground truncate">{negocio.empreendimento}</p>
          )}

          {/* VGV */}
          <div className="flex items-center justify-between text-[10px]">
            {negocio.vgv_estimado ? (
              <span className="font-semibold text-foreground flex items-center gap-0.5">
                <TrendingUp className="h-2.5 w-2.5 text-primary" />
                {formatVGV(negocio.vgv_estimado)}
              </span>
            ) : (
              <span className="text-muted-foreground italic">Sem VGV</span>
            )}
          </div>

          {/* Data de criação */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Criado em {new Date(negocio.created_at).toLocaleDateString("pt-BR")}</span>
          </div>

          {/* Corretor info for CEO/Gerente */}
          {showCorretor && corretorInfo && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Avatar className="h-5 w-5">
                <AvatarImage src={corretorInfo.avatar_gamificado_url || corretorInfo.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-[8px] bg-muted">{(corretorInfo.nome || "?")[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{corretorInfo.nome?.split(" ")[0]}</span>
              {corretorInfo.equipe && (
                <Badge variant="outline" className={`text-[8px] px-1 py-0 h-3.5 border ${getTeamColorClass(corretorInfo.equipe)}`}>
                  {corretorInfo.equipe}
                </Badge>
              )}
            </div>
          )}
          {!showCorretor && corretorNome && (
            <div className="text-[10px] text-muted-foreground truncate">👤 {corretorNome}</div>
          )}

          {/* Comunicar button */}
          <div className="pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 gap-1 text-primary hover:text-primary/80"
              onClick={(e) => { e.stopPropagation(); setComunicacaoOpen(true); }}
            >
              <MessageCircle className="h-3 w-3" /> 💬 Comunicar
            </Button>
          </div>
        </div>
      </div>
      <CentralComunicacao
        open={comunicacaoOpen}
        onOpenChange={setComunicacaoOpen}
        leadNome={negocio.nome_cliente}
        leadEmpreendimento={negocio.empreendimento}
      />
    </>
  );
}

export default function MeusNegocios() {
  const { negocios, corretorNomes, corretorInfoMap, loading, moveFase, reload } = useNegocios();
  const { onNegocioAssinado } = useLeadProgression();
  const { user } = useAuth();
  const { isGestor, isAdmin } = useUserRole();
  const { paradoMap } = useLeadsParados(negocios.map(n => ({
    id: n.id,
    ultima_acao_at: n.fase_changed_at || n.updated_at,
    modulo_atual: "negocios",
    corretor_id: n.corretor_id,
  })), isGestor || isAdmin ? undefined : user?.id);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterCorretor, setFilterCorretor] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [addNegocioOpen, setAddNegocioOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const dragNegocioId = useRef<string | null>(null);
  const [dragOverFase, setDragOverFase] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const filteredNegocios = useMemo(() => {
    let result = negocios;
    if (filterCorretor !== "all") result = result.filter(n => n.corretor_id === filterCorretor);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(n =>
        n.nome_cliente.toLowerCase().includes(q) ||
        n.empreendimento?.toLowerCase().includes(q) ||
        n.telefone?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [negocios, filterCorretor, searchQuery]);

  const corretorList = useMemo(() => {
    return Object.entries(corretorNomes).sort((a, b) => a[1].localeCompare(b[1]));
  }, [corretorNomes]);

  const totalVGV = useMemo(() =>
    filteredNegocios.reduce((sum, n) => sum + (n.vgv_estimado || 0), 0),
    [filteredNegocios]
  );

  const negociosByFase = useMemo(() => {
    const map = new Map<string, Negocio[]>();
    NEGOCIOS_FASES.forEach(f => map.set(f.key, []));
    for (const n of filteredNegocios) {
      const arr = map.get(n.fase);
      if (arr) arr.push(n);
    }
    return map;
  }, [filteredNegocios]);

  const handleMoveFase = useCallback(async (negocioId: string, novaFase: string) => {
    const negocio = negocios.find(n => n.id === negocioId);
    if (!negocio) return;

    await moveFase(negocioId, novaFase);

    // GATILHO 5: If moved to "assinado", trigger pos-vendas
    if (novaFase === "assinado") {
      await onNegocioAssinado({
        negocioId,
        pipelineLeadId: negocio.pipeline_lead_id || negocio.lead_id || undefined,
        nomeCliente: negocio.nome_cliente,
        empreendimento: negocio.empreendimento || undefined,
        corretorId: negocio.corretor_id || user?.id || "",
        vgvFinal: negocio.vgv_estimado || undefined,
      });
      // Confetti
      spawnConfetti();
    }
  }, [negocios, moveFase, onNegocioAssinado, user]);

  const handleDrop = (e: React.DragEvent, fase: string) => {
    e.preventDefault();
    setDragOverFase(null);
    if (!dragNegocioId.current) return;
    const id = dragNegocioId.current;
    dragNegocioId.current = null;
    handleMoveFase(id, fase);
  };

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  const scrollTo = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -312 : 312, behavior: "smooth" });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando negócios...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-full min-w-0 overflow-hidden" style={{ height: "calc(100vh - 56px - 2rem)" }}>
      {/* Header */}
      <div className="shrink-0 space-y-3 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Pipeline Negócios</h1>
            <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setAddNegocioOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>

          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar negócio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-card"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-lg border border-border bg-card animate-fade-in">
            <Select value={filterCorretor} onValueChange={setFilterCorretor}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
                <SelectValue placeholder="Corretor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos corretores</SelectItem>
                {corretorList.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Summary */}
        <div className="flex items-center gap-2 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs sm:text-sm font-bold text-foreground">
              {filteredNegocios.length} negócios
            </span>
          </div>
          {totalVGV > 0 && (
            <span className="text-sm text-muted-foreground font-medium">
              • {formatVGV(totalVGV)} em VGV
            </span>
          )}
        </div>
      </div>

      {/* Kanban */}
      <div className="relative flex-1 min-h-0">
        {canScrollLeft && (
          <button
            onClick={() => scrollTo("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollTo("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full bg-card/95 border border-border shadow-lg hover:bg-primary hover:text-primary-foreground transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-3 h-full overflow-x-auto overflow-y-hidden scroll-smooth scrollbar-none"
          style={{ scrollSnapType: "x proximity" }}
        >
          {NEGOCIOS_FASES.map((fase) => {
            const faseNegocios = negociosByFase.get(fase.key) || [];
            const isDragOver = dragOverFase === fase.key;
            const totalFaseVGV = faseNegocios.reduce((sum, n) => sum + (n.vgv_estimado || 0), 0);

            return (
              <div
                key={fase.key}
                className={`flex flex-col shrink-0 h-full rounded-xl transition-all duration-200 ${
                  isDragOver ? "ring-2 ring-primary/50 bg-primary/5 scale-[1.01]" : "bg-muted/20"
                }`}
                style={{ width: 300, scrollSnapAlign: "start" }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFase(fase.key); }}
                onDragLeave={() => setDragOverFase(null)}
                onDrop={(e) => handleDrop(e, fase.key)}
              >
                {/* Column header */}
                <div className="shrink-0 px-3.5 py-3 bg-card border border-border/40 rounded-t-xl">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-3 w-1 rounded-full" style={{ backgroundColor: fase.cor }} />
                    <span className="text-xs font-bold text-foreground">{fase.icon} {fase.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-bold">
                      {faseNegocios.length}
                    </Badge>
                    {totalFaseVGV > 0 && (
                      <span className="text-[10px] font-semibold text-foreground flex items-center gap-0.5">
                        <TrendingUp className="h-2.5 w-2.5 text-primary" />
                        {formatVGV(totalFaseVGV)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                  {faseNegocios.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center mb-2">
                        <span className="text-muted-foreground/40 text-sm">+</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground/50">Arraste negócios aqui</span>
                    </div>
                  )}
                  {faseNegocios.map(negocio => (
                    <NegocioCard
                      key={negocio.id}
                      negocio={negocio}
                      corretorNome={negocio.corretor_id ? corretorNomes[negocio.corretor_id] : undefined}
                      corretorInfo={negocio.corretor_id ? corretorInfoMap[negocio.corretor_id] : undefined}
                      showCorretor={isAdmin || isGestor}
                      paradoInfo={paradoMap.get(negocio.id)}
                      onDragStart={() => { dragNegocioId.current = negocio.id; }}
                      onClick={() => {
                        toast.info(`${negocio.nome_cliente} — ${fase.label}`);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AddNegocioDialog
        open={addNegocioOpen}
        onOpenChange={setAddNegocioOpen}
        onCreated={() => reload()}
      />
    </div>
  );
}

// Confetti helper
function spawnConfetti() {
  const colors = ["#22C55E", "#F59E0B", "#3B82F6", "#8B5CF6", "#FFFFFF"];
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none;overflow:hidden";
  document.body.appendChild(container);
  for (let i = 0; i < 50; i++) {
    const p = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 8;
    p.style.cssText = `position:absolute;top:-10px;left:${left}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random() > 0.5 ? "50%" : "2px"};opacity:0.9;animation:confettiNeg ${2 + Math.random()}s ease-in ${delay}s forwards`;
    container.appendChild(p);
  }
  const style = document.createElement("style");
  style.textContent = `@keyframes confettiNeg { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(100vh) rotate(720deg); opacity: 0; } }`;
  container.appendChild(style);
  setTimeout(() => container.remove(), 4000);
}
