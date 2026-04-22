import { useState } from "react";
import { formatCurrencyInput, parseCurrencyToNumber, handleCurrencyChange } from "@/utils/currencyFormat";
import { formatBRLCompact } from "@/lib/utils";
import { NEGOCIOS_FASES, type Negocio, type CorretorInfo } from "@/hooks/useNegocios";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TrendingUp, Clock, Phone, MessageSquare, Zap, MoreVertical, ArrowRight, Handshake, Repeat2, XCircle, X, Plus, AlertTriangle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInDays } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const formatVGV = formatBRLCompact;

const CARD_QUICK_ACTIONS = [
  { id: "simulacao", emoji: "📊", label: "Mandei simulação", tipo: "simulacao", titulo: "Simulação enviada" },
  { id: "vpl", emoji: "📈", label: "Mandei VPL", tipo: "vpl", titulo: "VPL enviado" },
  { id: "documentos", emoji: "📁", label: "Subi docs p/ aprovação", tipo: "documentos_aprovacao", titulo: "Documentos submetidos" },
  { id: "proposta", emoji: "📄", label: "Enviei proposta", tipo: "proposta", titulo: "Proposta enviada", openPopup: "proposta" },
  { id: "contrato", emoji: "📝", label: "Enviei contrato", tipo: "contrato", titulo: "Contrato enviado", openPopup: "contrato" },
];

export interface NegocioTask {
  id: string;
  titulo: string;
  vence_em: string | null;
  status: string;
}

interface NegocioCardProps {
  negocio: Negocio;
  corretorNome?: string;
  corretorInfo?: CorretorInfo;
  showCorretor?: boolean;
  paradoInfo?: { diasParado: number; severity: "warning" | "danger" };
  nextTask?: NegocioTask | null;
  parceriaInfo?: { label: string; isParceria: boolean } | null;
  onDragStart: () => void;
  onClick: () => void;
  onMoveFase: (id: string, fase: string) => void;
  onUpdateNegocio: (id: string, updates: Partial<Negocio>) => Promise<void>;
  onTaskSaved?: () => void;
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
}

export default function NegocioCard({ negocio, corretorNome, corretorInfo, showCorretor, paradoInfo, nextTask, parceriaInfo, onDragStart, onClick, onMoveFase, onUpdateNegocio, onTaskSaved, onDelete, isAdmin: cardIsAdmin }: NegocioCardProps) {
  const { user } = useAuth();
  const faseInfo = NEGOCIOS_FASES.find(f => f.key === negocio.fase);
  const daysInFase = differenceInDays(new Date(), new Date(negocio.fase_changed_at || negocio.created_at));

  const [ligarPopup, setLigarPopup] = useState(false);
  const [ligarNota, setLigarNota] = useState("");
  const [ligarResultado, setLigarResultado] = useState("atendeu");
  const [quedaPopup, setQuedaPopup] = useState(false);
  const [quedaMotivo, setQuedaMotivo] = useState("");
  const [propostaPopup, setPropostaPopup] = useState(false);
  const [contratoPopup, setContratoPopup] = useState(false);
  const [quickVgvId, setQuickVgvId] = useState<string | null>(null);
  const [quickVgvValue, setQuickVgvValue] = useState("");
  const [propEmp, setPropEmp] = useState(negocio.empreendimento || "");
  const [propUni, setPropUni] = useState("");
  const [propVgv, setPropVgv] = useState(negocio.vgv_estimado ? String(negocio.vgv_estimado) : "");
  const [contEmp, setContEmp] = useState(negocio.empreendimento || "");
  const [contUni, setContUni] = useState("");
  const [contVgv, setContVgv] = useState(negocio.vgv_estimado ? String(negocio.vgv_estimado) : "");
  const [contTipo, setContTipo] = useState("digital");
  const [editingTask, setEditingTask] = useState(false);
  const [taskText, setTaskText] = useState("");
  const whatsappUrl = negocio.telefone ? `https://wa.me/${negocio.telefone.replace(/\D/g, "")}` : null;

  const handleLigarRegistro = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "ligacao", resultado: ligarResultado, descricao: ligarNota || null, titulo: "Ligação registrada", created_by: user.id } as any);
    toast.success("📞 Ligação registrada!");
    setLigarPopup(false); setLigarNota(""); setLigarResultado("atendeu");
  };

  const handleQueda = async () => {
    if (!quedaMotivo.trim()) { toast.error("Informe o motivo da queda"); return; }
    if (!user) return;
    await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "queda", resultado: "negativo", descricao: quedaMotivo, titulo: "Negócio caiu", created_by: user.id } as any);
    onMoveFase(negocio.id, "distrato");
    toast("❌ Negócio movido para Caiu");
    setQuedaPopup(false); setQuedaMotivo("");
  };

  const handleCardAction = async (action: typeof CARD_QUICK_ACTIONS[0]) => {
    if (!user) return;
    if (action.openPopup === "proposta") { setPropostaPopup(true); return; }
    if (action.openPopup === "contrato") { setContratoPopup(true); return; }
    await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: action.tipo, titulo: action.titulo, created_by: user.id } as any);
    toast.success(`${action.emoji} ${action.titulo}`);
  };

  const handlePropostaSubmit = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "proposta", titulo: "Proposta enviada", descricao: `Empreendimento: ${propEmp}, Unidade: ${propUni}, VGV: ${formatCurrencyInput(propVgv)}`, created_by: user.id } as any);
    await supabase.from("negocios").update({ empreendimento: propEmp || negocio.empreendimento, vgv_estimado: propVgv ? parseCurrencyToNumber(propVgv) : negocio.vgv_estimado, updated_at: new Date().toISOString() } as any).eq("id", negocio.id);
    onMoveFase(negocio.id, "proposta");
    setPropostaPopup(false);
    toast.success("📄 Proposta → coluna Proposta");
  };

  const handleContratoSubmit = async () => {
    if (!user) return;
    await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "contrato", titulo: "Contrato enviado", descricao: `Emp: ${contEmp}, Uni: ${contUni}, VGV: ${formatCurrencyInput(contVgv)}, Assinatura: ${contTipo === "digital" ? "Digital" : "Presencial"}`, created_by: user.id } as any);
    await supabase.from("negocios").update({ empreendimento: contEmp || negocio.empreendimento, vgv_final: contVgv ? parseCurrencyToNumber(contVgv) : negocio.vgv_final, updated_at: new Date().toISOString() } as any).eq("id", negocio.id);
    onMoveFase(negocio.id, "documentacao");
    setContratoPopup(false);
    toast.success("📝 Contrato → coluna Contrato Gerado");
  };

  const handleSaveTask = async () => {
    if (!user || !taskText.trim()) { setEditingTask(false); return; }
    const trimmed = taskText.trim();
    if (nextTask) {
      await supabase.from("negocios_tarefas").update({ titulo: trimmed, updated_at: new Date().toISOString() }).eq("id", nextTask.id);
      await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "proximo_passo", titulo: "Próximo passo atualizado", descricao: trimmed, created_by: user.id } as any);
    } else {
      await supabase.from("negocios_tarefas").insert({ negocio_id: negocio.id, titulo: trimmed, tipo: "follow_up", status: "pendente", prioridade: "media", created_by: user.id });
      await supabase.from("negocios_atividades").insert({ negocio_id: negocio.id, tipo: "proximo_passo", titulo: "Próximo passo definido", descricao: trimmed, created_by: user.id } as any);
    }
    setEditingTask(false); setTaskText("");
    onTaskSaved?.();
    toast.success("✅ Próximo passo salvo");
  };

  return (
    <>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
        className="group rounded-xl cursor-pointer active:cursor-grabbing transition-all duration-200 select-none overflow-hidden hover:scale-[1.02] hover:shadow-lg bg-white border border-[#e8e8f0] dark:bg-[rgba(255,255,255,0.04)] dark:border-white/[0.08] dark:backdrop-blur-[16px]"
        style={{ boxShadow: `0 0 12px ${faseInfo?.cor || "#6B7280"}15` }}
      >
        <div className="h-[2px] rounded-t-xl" style={{ background: `linear-gradient(90deg, transparent, ${faseInfo?.cor || "#6B7280"}, transparent)` }} />

        <div className="px-4 pt-3.5 pb-2.5 space-y-2" onClick={onClick}>
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#0a0a0a] dark:text-white truncate flex-1">{negocio.nome_cliente}</p>
            <span className={`text-[11px] font-bold ml-2 shrink-0 px-2 py-0.5 rounded-full ${daysInFase <= 3 ? "bg-emerald-500/15 text-emerald-400" : daysInFase <= 7 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/15 text-red-400"}`}>
              {daysInFase}d
            </span>
          </div>

          <p className="text-[12px] text-[#71717a] dark:text-[#52525b] truncate">
            {negocio.empreendimento || <span className="italic text-amber-500 dark:text-amber-400/80 font-semibold">Sem imóvel</span>}
          </p>

          {showCorretor && (
            corretorInfo ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={corretorInfo.avatar_gamificado_url || corretorInfo.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="text-[8px]" style={{ background: `${faseInfo?.cor || "#6B7280"}30`, color: faseInfo?.cor }}>{(corretorInfo.nome || "?")[0]}</AvatarFallback>
                </Avatar>
                {parceriaInfo?.isParceria ? (
                  <span className="text-[12px] font-medium text-[#71717a] dark:text-[#a1a1aa] truncate">{parceriaInfo.label}</span>
                ) : (
                  <span className="text-[12px] font-medium text-[#71717a] dark:text-[#a1a1aa] truncate">{corretorInfo.nome?.split(" ")[0]}</span>
                )}
                {corretorInfo.equipe && !parceriaInfo?.isParceria && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-[#e8e8f0] dark:border-white/[0.1] text-[#71717a] dark:text-[#52525b]">
                    {corretorInfo.equipe}
                  </Badge>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-[#a1a1aa] dark:text-[#52525b] italic">Sem corretor</p>
            )
          )}

          <div className="flex items-center gap-2">
            {negocio.vgv_estimado ? (
              <span className="text-[14px] font-bold text-[#10b981] dark:text-[#34d399] flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                {parceriaInfo?.isParceria ? `${formatVGV(negocio.vgv_estimado / 2)} (50%)` : formatVGV(negocio.vgv_estimado)}
              </span>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setQuickVgvId(negocio.id); setQuickVgvValue(""); }} className="text-[13px] text-amber-400/90 font-bold hover:text-amber-300 transition-colors flex items-center gap-1">
                Preencher VGV
              </button>
            )}
          </div>

          {(!negocio.empreendimento || !negocio.vgv_estimado) && (
            <div className="flex items-center gap-1 flex-wrap">
              {!negocio.empreendimento && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Falta Imóvel</span>}
              {!negocio.vgv_estimado && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-md flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Falta VGV</span>}
            </div>
          )}

          {parceriaInfo && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <Handshake className="h-3 w-3" /> 🤝 {parceriaInfo.label}
              </span>
            </div>
          )}
        </div>

        {/* Próximo passo */}
        <div className="px-3.5 pb-2.5 border-t border-[#e8e8f0] dark:border-white/[0.04] pt-2" onClick={(e) => e.stopPropagation()}>
          {editingTask ? (
            <div className="flex items-center gap-1.5">
              <input autoFocus value={taskText} onChange={(e) => setTaskText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveTask(); if (e.key === "Escape") setEditingTask(false); }} placeholder="Definir próximo passo..." className="flex-1 text-[11px] bg-[#f7f7fb] dark:bg-white/5 border border-[#e8e8f0] dark:border-white/10 rounded px-2 py-1 text-[#0a0a0a] dark:text-white placeholder:text-[#a1a1aa] dark:placeholder:text-white/30 focus:outline-none focus:border-[#4969FF] dark:focus:border-white/20" />
              <button onClick={handleSaveTask} className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 font-medium shrink-0">Salvar</button>
            </div>
          ) : (
            <button onClick={() => { setTaskText(nextTask?.titulo || ""); setEditingTask(true); }} className="w-full text-left group/task">
              {nextTask ? (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#a1a1aa] dark:text-[#52525b] shrink-0" />
                  <span className="text-[11px] text-[#a1a1aa] dark:text-[#52525b] italic truncate group-hover/task:text-[#71717a] dark:group-hover/task:text-[#a1a1aa] transition-colors">{nextTask.titulo}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5 text-[#a1a1aa] dark:text-white/25 shrink-0" />
                  <span className="text-[11px] text-[#a1a1aa] dark:text-[#52525b] italic group-hover/task:text-[#71717a] dark:group-hover/task:text-[#a1a1aa] transition-colors">Definir próximo passo...</span>
                </div>
              )}
            </button>
          )}
        </div>

        {/* Action bar */}
        <div className="flex items-center border-t border-[#e8e8f0] dark:border-white/[0.06] bg-[#f7f7fb] dark:bg-[rgba(255,255,255,0.02)]" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setLigarPopup(true)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#71717a] hover:text-[#4969FF] dark:hover:text-white hover:bg-[#f0f0f5] dark:hover:bg-white/5 transition-colors border-r border-[#e8e8f0] dark:border-white/[0.06]">
            <Phone className="h-3.5 w-3.5" /> Ligar
          </button>

          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#71717a] hover:text-[#10b981] hover:bg-[#f0f0f5] dark:hover:bg-white/5 transition-colors border-r border-[#e8e8f0] dark:border-white/[0.06]">
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </a>
          ) : (
            <span className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#a1a1aa] dark:text-[#52525b] border-r border-[#e8e8f0] dark:border-white/[0.06]">
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </span>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium text-[#71717a] hover:text-[#4969FF] hover:bg-[#f0f0f5] dark:hover:bg-white/5 transition-colors">
                <Zap className="h-3.5 w-3.5" /> Ação
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <p className="px-2 py-1.5 text-xs font-bold text-muted-foreground">Ação do Negócio</p>
              <DropdownMenuSeparator />
              {CARD_QUICK_ACTIONS.map(action => (
                <DropdownMenuItem key={action.id} onClick={() => handleCardAction(action)} className="gap-2 cursor-pointer text-xs">
                  <span>{action.emoji}</span> {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-2 py-1.5 text-gray-500 hover:text-[#0a0a0a] dark:hover:text-white hover:bg-[#f0f0f5] dark:hover:bg-white/5 transition-colors">
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="gap-2 text-xs"><ArrowRight className="h-3.5 w-3.5" /> Mover para etapa</DropdownMenuSubTrigger>
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
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs"><Handshake className="h-3.5 w-3.5" /> Parceria</DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs"><Repeat2 className="h-3.5 w-3.5" /> Repassar negócio</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer text-xs text-red-500" onClick={() => setQuedaPopup(true)}><XCircle className="h-3.5 w-3.5" /> Caiu negócio</DropdownMenuItem>
              {cardIsAdmin && onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 cursor-pointer text-xs text-red-600 font-bold" onClick={() => onDelete(negocio.id)}><X className="h-3.5 w-3.5" /> 🗑️ Excluir negócio</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Popups */}
      <Dialog open={!!quickVgvId} onOpenChange={(o) => { if (!o) setQuickVgvId(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="text-base">💰 Preencher VGV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">VGV (R$)</Label><Input value={formatCurrencyInput(quickVgvValue)} onChange={(e) => setQuickVgvValue(handleCurrencyChange(e.target.value))} placeholder="R$ 500.000,00" inputMode="numeric" className="h-9" /></div>
            <Button size="sm" className="w-full" onClick={async () => { if (!quickVgvId || !quickVgvValue) return; const val = parseCurrencyToNumber(quickVgvValue); if (!val) return; await onUpdateNegocio(quickVgvId, { vgv_estimado: val }); toast.success("VGV atualizado!"); setQuickVgvId(null); }}>Salvar VGV</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={ligarPopup} onOpenChange={setLigarPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">📞 Registrar Ligação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Resultado</Label>
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
            <div><Label className="text-xs">Observação</Label><Textarea value={ligarNota} onChange={e => setLigarNota(e.target.value)} placeholder="O que aconteceu na ligação..." className="text-xs h-20" /></div>
          </div>
          <DialogFooter><Button size="sm" onClick={handleLigarRegistro} className="text-xs gap-1"><Phone className="h-3 w-3" /> Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quedaPopup} onOpenChange={setQuedaPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">❌ Motivo da Queda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Negócio: <strong>{negocio.nome_cliente}</strong></p>
            <div><Label className="text-xs">Motivo</Label><Textarea value={quedaMotivo} onChange={e => setQuedaMotivo(e.target.value)} placeholder="Descreva o motivo..." className="text-xs h-20" /></div>
          </div>
          <DialogFooter><Button size="sm" variant="destructive" onClick={handleQueda} className="text-xs gap-1"><XCircle className="h-3 w-3" /> Confirmar queda</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={propostaPopup} onOpenChange={setPropostaPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">📄 Enviar Proposta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Empreendimento</Label><Input value={propEmp} onChange={e => setPropEmp(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Unidade</Label><Input value={propUni} onChange={e => setPropUni(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">VGV (R$)</Label><Input value={formatCurrencyInput(propVgv)} onChange={e => setPropVgv(handleCurrencyChange(e.target.value))} inputMode="numeric" className="h-8 text-xs" /></div>
          </div>
          <DialogFooter><Button size="sm" onClick={handlePropostaSubmit} className="text-xs gap-1">📄 Enviar e mover para Proposta</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contratoPopup} onOpenChange={setContratoPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-base">📝 Enviar Contrato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Empreendimento</Label><Input value={contEmp} onChange={e => setContEmp(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Unidade</Label><Input value={contUni} onChange={e => setContUni(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">VGV (R$)</Label><Input value={formatCurrencyInput(contVgv)} onChange={e => setContVgv(handleCurrencyChange(e.target.value))} inputMode="numeric" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Tipo de assinatura</Label>
              <Select value={contTipo} onValueChange={setContTipo}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">🖊️ Digital</SelectItem>
                  <SelectItem value="presencial">🤝 Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button size="sm" onClick={handleContratoSubmit} className="text-xs gap-1">📝 Enviar e mover para Contrato Gerado</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
