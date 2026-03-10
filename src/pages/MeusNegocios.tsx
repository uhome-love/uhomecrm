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
import { Loader2, Search, RefreshCw, Briefcase, X, SlidersHorizontal, LayoutGrid, ChevronLeft, ChevronRight, TrendingUp, Clock, MessageCircle, Plus, Phone, MessageSquare, Zap, MoreVertical, ArrowRight, Handshake, Repeat2, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import CentralComunicacao from "@/components/comunicacao/CentralComunicacao";
import AddNegocioDialog from "@/components/pipeline/AddNegocioDialog";
import NegocioDetailModal from "@/components/pipeline/NegocioDetailModal";
import VendaCelebration from "@/components/pipeline/VendaCelebration";
import { supabase } from "@/integrations/supabase/client";

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

// ── Quick Actions for card ──
const CARD_QUICK_ACTIONS = [
  { id: "simulacao", emoji: "📊", label: "Mandei simulação", tipo: "simulacao", titulo: "Simulação enviada" },
  { id: "vpl", emoji: "📈", label: "Mandei VPL", tipo: "vpl", titulo: "VPL enviado" },
  { id: "documentos", emoji: "📁", label: "Subi docs p/ aprovação", tipo: "documentos_aprovacao", titulo: "Documentos submetidos" },
  { id: "proposta", emoji: "📄", label: "Enviei proposta", tipo: "proposta", titulo: "Proposta enviada", openPopup: "proposta" },
  { id: "contrato", emoji: "📝", label: "Enviei contrato", tipo: "contrato", titulo: "Contrato enviado", openPopup: "contrato" },
];

function NegocioCard({ negocio, corretorNome, corretorInfo, showCorretor, paradoInfo, onDragStart, onClick, onMoveFase }: {
  negocio: Negocio;
  corretorNome?: string;
  corretorInfo?: CorretorInfo;
  showCorretor?: boolean;
  paradoInfo?: { diasParado: number; severity: "warning" | "danger" };
  onDragStart: () => void;
  onClick: () => void;
  onMoveFase: (id: string, fase: string) => void;
}) {
  const { user } = useAuth();
  const faseInfo = NEGOCIOS_FASES.find(f => f.key === negocio.fase);
  const daysInFase = differenceInDays(new Date(), new Date(negocio.fase_changed_at || negocio.created_at));

  // Local state for popups
  const [ligarPopup, setLigarPopup] = useState(false);
  const [ligarNota, setLigarNota] = useState("");
  const [ligarResultado, setLigarResultado] = useState("atendeu");
  const [quedaPopup, setQuedaPopup] = useState(false);
  const [quedaMotivo, setQuedaMotivo] = useState("");
  const [propostaPopup, setPropostaPopup] = useState(false);
  const [contratoPopup, setContratoPopup] = useState(false);
  const [propEmp, setPropEmp] = useState(negocio.empreendimento || "");
  const [propUni, setPropUni] = useState("");
  const [propVgv, setPropVgv] = useState(negocio.vgv_estimado ? String(negocio.vgv_estimado) : "");
  const [contEmp, setContEmp] = useState(negocio.empreendimento || "");
  const [contUni, setContUni] = useState("");
  const [contVgv, setContVgv] = useState(negocio.vgv_estimado ? String(negocio.vgv_estimado) : "");
  const [contTipo, setContTipo] = useState("digital");

  const whatsappUrl = negocio.telefone ? `https://wa.me/${negocio.telefone.replace(/\D/g, "")}` : null;

  const handleLigarRegistro = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "ligacao", resultado: ligarResultado,
      descricao: ligarNota || null, titulo: "Ligação registrada", created_by: user.id,
    } as any);
    toast.success("📞 Ligação registrada!");
    setLigarPopup(false); setLigarNota(""); setLigarResultado("atendeu");
  };

  const handleQueda = async () => {
    if (!quedaMotivo.trim()) { toast.error("Informe o motivo da queda"); return; }
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "queda", resultado: "negativo",
      descricao: quedaMotivo, titulo: "Negócio caiu", created_by: user.id,
    } as any);
    onMoveFase(negocio.id, "distrato");
    toast("❌ Negócio movido para Caiu");
    setQuedaPopup(false); setQuedaMotivo("");
  };

  const handleCardAction = async (action: typeof CARD_QUICK_ACTIONS[0]) => {
    if (!user) return;
    if (action.openPopup === "proposta") { setPropostaPopup(true); return; }
    if (action.openPopup === "contrato") { setContratoPopup(true); return; }
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: action.tipo, titulo: action.titulo, created_by: user.id,
    } as any);
    toast.success(`${action.emoji} ${action.titulo}`);
  };

  const handlePropostaSubmit = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "proposta", titulo: "Proposta enviada",
      descricao: `Empreendimento: ${propEmp}, Unidade: ${propUni}, VGV: R$ ${propVgv}`, created_by: user.id,
    } as any);
    await supabase.from("negocios").update({
      empreendimento: propEmp || negocio.empreendimento,
      vgv_estimado: propVgv ? parseFloat(propVgv) : negocio.vgv_estimado,
      updated_at: new Date().toISOString(),
    } as any).eq("id", negocio.id);
    onMoveFase(negocio.id, "proposta");
    setPropostaPopup(false);
    toast.success("📄 Proposta → coluna Proposta");
  };

  const handleContratoSubmit = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({
      negocio_id: negocio.id, tipo: "contrato", titulo: "Contrato enviado",
      descricao: `Emp: ${contEmp}, Uni: ${contUni}, VGV: R$ ${contVgv}, Assinatura: ${contTipo === "digital" ? "Digital" : "Presencial"}`,
      created_by: user.id,
    } as any);
    await supabase.from("negocios").update({
      empreendimento: contEmp || negocio.empreendimento,
      vgv_final: contVgv ? parseFloat(contVgv) : negocio.vgv_final,
      updated_at: new Date().toISOString(),
    } as any).eq("id", negocio.id);
    onMoveFase(negocio.id, "documentacao");
    setContratoPopup(false);
    toast.success("📝 Contrato → coluna Contrato Gerado");
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        className="group rounded-xl cursor-pointer active:cursor-grabbing transition-all duration-200 select-none overflow-hidden hover:scale-[1.02] hover:shadow-lg"
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: `1px solid rgba(255,255,255,0.08)`,
          boxShadow: `0 0 12px ${faseInfo?.cor || "#6B7280"}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Glow top bar */}
        <div className="h-[2px] rounded-t-xl" style={{ background: `linear-gradient(90deg, transparent, ${faseInfo?.cor || "#6B7280"}, transparent)` }} />

        {/* Body - click opens modal */}
        <div className="px-3.5 pt-3 pb-2 space-y-1.5" onClick={onClick}>
          {/* Row 1: Nome + Days badge */}
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-white truncate flex-1">{negocio.nome_cliente}</p>
            <span className={`text-[10px] font-bold ml-2 shrink-0 px-1.5 py-0.5 rounded-full ${
              daysInFase <= 3 ? "bg-emerald-500/15 text-emerald-400" : daysInFase <= 7 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"
            }`}>
              {daysInFase}d
            </span>
          </div>

          {/* Row 2: Imóvel (fase) */}
          <p className="text-[11px] text-white/50 truncate">
            {negocio.empreendimento || <span className="italic text-amber-400/70">🏠 Sem imóvel</span>}
            {negocio.empreendimento && (
              <span className="ml-1 text-white/30">({faseInfo?.label})</span>
            )}
          </p>

          {/* Row 3: VGV */}
          <div className="flex items-center gap-2">
            {negocio.vgv_estimado ? (
              <span className="text-sm font-bold flex items-center gap-1" style={{ color: faseInfo?.cor || "#22C55E" }}>
                <TrendingUp className="h-3 w-3" />
                {formatVGV(negocio.vgv_estimado)}
              </span>
            ) : (
              <span className="text-[11px] text-red-400/80 font-medium">⚠️ VGV obrigatório</span>
            )}
          </div>

          {/* Row 4: Corretor (para admin/gestor) */}
          {showCorretor && corretorInfo && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Avatar className="h-4 w-4">
                <AvatarImage src={corretorInfo.avatar_gamificado_url || corretorInfo.avatar_url || undefined} className="object-cover" />
                <AvatarFallback className="text-[7px]" style={{ background: `${faseInfo?.cor || "#6B7280"}30`, color: faseInfo?.cor }}>{(corretorInfo.nome || "?")[0]}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-white/40 truncate">{corretorInfo.nome?.split(" ")[0]}</span>
              {corretorInfo.equipe && (
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-white/10 text-white/30">
                  {corretorInfo.equipe}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Action bar - glass effect */}
        <div
          className="flex items-center gap-0 border-t border-white/[0.06]"
          style={{ background: "rgba(255,255,255,0.02)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ligar */}
          <button
            onClick={() => setLigarPopup(true)}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Phone className="h-3 w-3" /> Ligar
          </button>

          {/* WhatsApp */}
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-green-500 hover:text-green-400 hover:bg-white/5 transition-colors"
            >
              <MessageSquare className="h-3 w-3" /> WhatsApp
            </a>
          ) : (
            <span className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600">
              <MessageSquare className="h-3 w-3" /> WhatsApp
            </span>
          )}

          {/* ⚡ Ação */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-amber-400 hover:text-amber-300 hover:bg-white/5 transition-colors">
                <Zap className="h-3 w-3" /> Ação
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <p className="px-2 py-1.5 text-xs font-bold text-muted-foreground">⚡ Ação do Negócio</p>
              <DropdownMenuSeparator />
              {CARD_QUICK_ACTIONS.map(action => (
                <DropdownMenuItem key={action.id} onClick={() => handleCardAction(action)} className="gap-2 cursor-pointer text-xs">
                  <span>{action.emoji}</span> {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ⋯ Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2 py-1.5 text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {/* Move between stages */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 text-xs">
                  <ArrowRight className="h-3.5 w-3.5" /> Mover para etapa
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {NEGOCIOS_FASES.filter(f => f.key !== negocio.fase && f.key !== "distrato").map(f => (
                    <DropdownMenuItem key={f.key} onClick={() => onMoveFase(negocio.id, f.key)} className="gap-2 cursor-pointer text-xs">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: f.cor }} />
                      {f.icon} {f.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs">
                <Handshake className="h-3.5 w-3.5" /> Parceria
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs">
                <Repeat2 className="h-3.5 w-3.5" /> Repassar negócio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs text-red-500" onClick={() => setQuedaPopup(true)}>
                <XCircle className="h-3.5 w-3.5" /> Caiu negócio
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Popup: Registrar Ligação ── */}
      <Dialog open={ligarPopup} onOpenChange={setLigarPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">📞 Registrar Ligação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Resultado</Label>
              <Select value={ligarResultado} onValueChange={setLigarResultado}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendeu">✅ Atendeu</SelectItem>
                  <SelectItem value="nao_atendeu">❌ Não atendeu</SelectItem>
                  <SelectItem value="caixa_postal">📭 Caixa postal</SelectItem>
                  <SelectItem value="ocupado">🔴 Ocupado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Observação</Label>
              <Textarea value={ligarNota} onChange={e => setLigarNota(e.target.value)} placeholder="O que aconteceu na ligação..." className="text-xs h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleLigarRegistro} className="text-xs gap-1">
              <Phone className="h-3 w-3" /> Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Popup: Motivo da Queda ── */}
      <Dialog open={quedaPopup} onOpenChange={setQuedaPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">❌ Motivo da Queda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Textarea value={quedaMotivo} onChange={e => setQuedaMotivo(e.target.value)} placeholder="Descreva o motivo..." className="text-xs h-20" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="destructive" onClick={handleQueda} className="text-xs gap-1">
              <XCircle className="h-3 w-3" /> Confirmar queda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Popup: Enviar Proposta ── */}
      <Dialog open={propostaPopup} onOpenChange={setPropostaPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">📄 Enviar Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Empreendimento</Label><Input value={propEmp} onChange={e => setPropEmp(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Unidade</Label><Input value={propUni} onChange={e => setPropUni(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">VGV (R$)</Label><Input value={propVgv} onChange={e => setPropVgv(e.target.value)} type="number" className="h-8 text-xs" /></div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handlePropostaSubmit} className="text-xs gap-1">📄 Enviar e mover para Proposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Popup: Enviar Contrato ── */}
      <Dialog open={contratoPopup} onOpenChange={setContratoPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">📝 Enviar Contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Empreendimento</Label><Input value={contEmp} onChange={e => setContEmp(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Unidade</Label><Input value={contUni} onChange={e => setContUni(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">VGV (R$)</Label><Input value={contVgv} onChange={e => setContVgv(e.target.value)} type="number" className="h-8 text-xs" /></div>
            <div>
              <Label className="text-xs">Tipo de assinatura</Label>
              <Select value={contTipo} onValueChange={setContTipo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">🖊️ Digital</SelectItem>
                  <SelectItem value="presencial">🤝 Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleContratoSubmit} className="text-xs gap-1">📝 Enviar e mover para Contrato Gerado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MeusNegocios() {
  const { negocios, corretorNomes, corretorInfoMap, loading, moveFase, updateNegocio, reload } = useNegocios();
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
  const [selectedNegocio, setSelectedNegocio] = useState<Negocio | null>(null);
  const [celebrationData, setCelebrationData] = useState<{
    nomeCliente: string; empreendimento?: string; vgv: number; corretorNome?: string;
  } | null>(null);
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

    // GATILHO 5: If moved to "assinado", trigger pos-vendas + epic celebration
    if (novaFase === "assinado") {
      await onNegocioAssinado({
        negocioId,
        pipelineLeadId: negocio.pipeline_lead_id || negocio.lead_id || undefined,
        nomeCliente: negocio.nome_cliente,
        empreendimento: negocio.empreendimento || undefined,
        corretorId: negocio.corretor_id || user?.id || "",
        vgvFinal: negocio.vgv_estimado || undefined,
      });
      // Epic celebration screen
      setCelebrationData({
        nomeCliente: negocio.nome_cliente,
        empreendimento: negocio.empreendimento || undefined,
        vgv: negocio.vgv_final || negocio.vgv_estimado || 0,
        corretorNome: negocio.corretor_id ? corretorNomes[negocio.corretor_id] : undefined,
      });
    }
  }, [negocios, moveFase, onNegocioAssinado, user, corretorNomes]);

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
    <div
      className="flex flex-col w-full max-w-full min-w-0 overflow-hidden rounded-2xl"
      style={{
        height: "calc(100vh - 56px - 2rem)",
        background: "linear-gradient(135deg, hsl(220 25% 8%) 0%, hsl(230 20% 12%) 50%, hsl(220 25% 8%) 100%)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 space-y-3 pb-3 px-4 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-auto">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(265 83% 57%))" }}>
              <Briefcase className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">Pipeline Negócios</h1>
            <Button size="sm" className="gap-1 h-7 text-xs rounded-lg" onClick={() => setAddNegocioOpen(true)}
              style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(265 83% 57%))", color: "#fff", border: "none" }}
            >
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>

          <div className="relative flex-1 min-w-[140px] sm:min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              placeholder="Buscar negócio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-white placeholder:text-white/30 border-white/10 rounded-lg"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3.5 w-3.5 text-white/40 hover:text-white" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5 h-9 border-white/10 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>

          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-white/10 text-white/50 hover:text-white hover:bg-white/10 rounded-lg" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {showFilters && (
          <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl border border-white/10 animate-fade-in" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Select value={filterCorretor} onValueChange={setFilterCorretor}>
              <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs border-white/10 text-white/70" style={{ background: "rgba(255,255,255,0.06)" }}>
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
        <div className="flex items-center gap-3 flex-wrap px-1">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-xs sm:text-sm font-bold text-white">
              {filteredNegocios.length} negócios
            </span>
          </div>
          {totalVGV > 0 && (
            <span className="text-sm font-semibold" style={{ color: "hsl(45 93% 58%)" }}>
              💰 {formatVGV(totalVGV)}
            </span>
          )}
        </div>
      </div>

      {/* Kanban */}
      <div className="relative flex-1 min-h-0 px-2">
        {canScrollLeft && (
          <button
            onClick={() => scrollTo("left")}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-xl transition-all text-white/70 hover:text-white"
            style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {canScrollRight && (
          <button
            onClick={() => scrollTo("right")}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-10 w-10 flex items-center justify-center rounded-full shadow-xl transition-all text-white/70 hover:text-white"
            style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.12)" }}
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
                  isDragOver ? "scale-[1.01]" : ""
                }`}
                style={{
                  width: 300,
                  scrollSnapAlign: "start",
                  background: isDragOver ? `${fase.cor}10` : "rgba(255,255,255,0.02)",
                  border: isDragOver ? `2px solid ${fase.cor}50` : "1px solid rgba(255,255,255,0.06)",
                }}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverFase(fase.key); }}
                onDragLeave={() => setDragOverFase(null)}
                onDrop={(e) => handleDrop(e, fase.key)}
              >
                {/* Column header - glass */}
                <div
                  className="shrink-0 px-3.5 py-3 rounded-t-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderBottom: `2px solid ${fase.cor}40`,
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-2.5 w-2.5 rounded-full shadow-lg" style={{ backgroundColor: fase.cor, boxShadow: `0 0 8px ${fase.cor}80` }} />
                    <span className="text-xs font-bold text-white/90">{fase.icon} {fase.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white/80" style={{ background: `${fase.cor}20` }}>
                      {faseNegocios.length}
                    </span>
                    {totalFaseVGV > 0 && (
                      <span className="text-[10px] font-semibold flex items-center gap-0.5" style={{ color: fase.cor }}>
                        <TrendingUp className="h-2.5 w-2.5" />
                        {formatVGV(totalFaseVGV)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2.5 scrollbar-thin">
                  {faseNegocios.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center mb-2" style={{ background: `${fase.cor}10`, border: `1px dashed ${fase.cor}30` }}>
                        <span className="text-white/20 text-sm">+</span>
                      </div>
                      <span className="text-[11px] text-white/20">Arraste negócios aqui</span>
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
                      onClick={() => setSelectedNegocio(negocio)}
                      onMoveFase={handleMoveFase}
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

      {selectedNegocio && (
        <NegocioDetailModal
          open={!!selectedNegocio}
          onOpenChange={(open) => { if (!open) setSelectedNegocio(null); }}
          negocio={selectedNegocio}
          onUpdate={updateNegocio}
          onMoveFase={handleMoveFase}
        />
      )}

      {celebrationData && (
        <VendaCelebration
          nomeCliente={celebrationData.nomeCliente}
          empreendimento={celebrationData.empreendimento}
          vgv={celebrationData.vgv}
          corretorNome={celebrationData.corretorNome}
          onDismiss={() => setCelebrationData(null)}
        />
      )}
    </div>
  );
}
