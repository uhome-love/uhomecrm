import { useState, useEffect, useRef } from "react";
import { useOAFila, useOARegistrarTentativa, useOATemplates, type OALista, type OALead } from "@/hooks/useOfertaAtiva";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Phone, MessageCircle, Mail, Copy, User, Building2, Calendar, History, CheckCircle, Flame, Target, Lock, CalendarCheck, Zap, ChevronDown, Pencil, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useCorretorDailyStats, useCorretorDailyGoals } from "@/hooks/useCorretorDailyStats";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import AttemptModal from "./AttemptModal";
import ScriptPanel from "./ScriptPanel";
import AttemptHistory from "./AttemptHistory";
import ScoringLegend from "./ScoringLegend";

interface Props {
  lista: OALista;
  onBack: () => void;
}

export default function DialingModeWithScript({ lista, onBack }: Props) {
  const { fila, isLoading, lockLead, unlockLead, refetch } = useOAFila(lista.id);
  const { registrar } = useOARegistrarTentativa();
  const { templates } = useOATemplates(lista.empreendimento);
  const { stats } = useCorretorDailyStats();
  const { goals, saveGoals } = useCorretorDailyGoals();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionTaken, setActionTaken] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [lockStatus, setLockStatus] = useState<"idle" | "locking" | "locked" | "failed">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [editingMetas, setEditingMetas] = useState(false);
  const [metaLig, setMetaLig] = useState("");
  const [metaAprov, setMetaAprov] = useState("");
  const [metaVis, setMetaVis] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  const metaLigacoes = goals?.meta_ligacoes || 30;
  const metaAproveitados = goals?.meta_aproveitados || 5;
  const metaVisitas = goals?.meta_visitas_marcadas || 3;
  const progLig = Math.min(100, Math.round((stats.tentativas / metaLigacoes) * 100));
  const progAprov = Math.min(100, Math.round((stats.aproveitados / metaAproveitados) * 100));
  const progVisitas = Math.min(100, Math.round((stats.visitas_marcadas / metaVisitas) * 100));

  const lead = fila[currentIndex];

  // Lock lead when it becomes active — atomic lock
  const prevLeadIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (lead && lead.id !== prevLeadIdRef.current) {
      prevLeadIdRef.current = lead.id;
      setLockStatus("locking");
      lockLead(lead.id).then(result => {
        if (result.locked) {
          setLockStatus("locked");
        } else {
          setLockStatus("failed");
          if (result.reason === "locked_by_another") {
            toast.error("Lead em atendimento por outro corretor. Avançando...");
            // Skip to next lead
            setTimeout(() => {
              if (currentIndex < fila.length - 1) {
                setCurrentIndex(prev => prev + 1);
              }
            }, 1000);
          }
        }
      });
    }
    return () => {
      if (prevLeadIdRef.current) {
        unlockLead(prevLeadIdRef.current);
      }
    };
  }, [lead?.id, lockLead, unlockLead]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const handleAction = (canal: string) => {
    if (!lead) return;
    setActionTaken(canal);

    if (canal === "ligacao") {
      // Não redireciona — corretor liga manualmente pelo celular
      setTimeout(() => setShowModal(true), 300);
      return;
    } else if (canal === "whatsapp" && lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, "");
      const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
      const template = templates.find(t => t.canal === "whatsapp" && t.tipo === "primeiro_contato");
      const msg = template
        ? template.conteudo.replace("{nome}", lead.nome).replace("{empreendimento}", lead.empreendimento || "")
        : `Olá ${lead.nome}! Vi que você se interessou pelo ${lead.empreendimento || "nosso empreendimento"}. Podemos conversar?`;
      window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    } else if (canal === "email" && lead.email) {
      const subject = `${lead.empreendimento || "Oportunidade"} - Informações`;
      const body = `Olá ${lead.nome},\n\nGostaria de apresentar mais detalhes sobre o ${lead.empreendimento || "empreendimento"}.\n\nPodemos agendar uma conversa?`;
      window.open(`mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    }

    setTimeout(() => setShowModal(true), 500);
  };

  const handleResultSubmit = async (resultado: string, feedback: string, visitaMarcada?: boolean) => {
    if (!lead || !actionTaken || submitting) return;
    setSubmitting(true);
    try {
      const result = await registrar(lead, actionTaken, resultado, feedback, lista);
      if (!result.success) {
        setSubmitting(false);
        return;
      }

      // Se marcou visita, incrementar real_visitas_marcadas no checkpoint
      if (visitaMarcada && user) {
        try {
          const today = new Date().toISOString().split("T")[0];
          // Find team_member for this user
          const { data: tm } = await supabase
            .from("team_members")
            .select("id, gerente_id")
            .eq("user_id", user.id)
            .eq("status", "ativo")
            .maybeSingle();

          if (tm) {
            // Find or create today's checkpoint
            let { data: cp } = await supabase
              .from("checkpoints")
              .select("id")
              .eq("gerente_id", tm.gerente_id)
              .eq("data", today)
              .maybeSingle();

            if (!cp) {
              const { data: newCp } = await supabase
                .from("checkpoints")
                .insert({ gerente_id: tm.gerente_id, data: today })
                .select("id")
                .single();
              cp = newCp;
            }

            if (cp) {
              // Get current line
              const { data: line } = await supabase
                .from("checkpoint_lines")
                .select("id, real_visitas_marcadas")
                .eq("checkpoint_id", cp.id)
                .eq("corretor_id", tm.id)
                .maybeSingle();

              if (line) {
                await supabase
                  .from("checkpoint_lines")
                  .update({ real_visitas_marcadas: (line.real_visitas_marcadas || 0) + 1 })
                  .eq("id", line.id);
              } else {
                await supabase
                  .from("checkpoint_lines")
                  .insert({ checkpoint_id: cp.id, corretor_id: tm.id, real_visitas_marcadas: 1 } as any);
              }
            }
          }
          toast.success("📅 Visita marcada contabilizada no checkpoint!");
        } catch (err) {
          console.error("Erro ao atualizar visita no checkpoint:", err);
        }
      }

      setShowModal(false);
      setActionTaken(null);
      queryClient.invalidateQueries({ queryKey: ["corretor-daily-stats"] });
      queryClient.invalidateQueries({ queryKey: ["checkpoint"] });

      if (currentIndex < fila.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        refetch();
        setCurrentIndex(0);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!lead) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="font-bold text-lg text-foreground">Fila concluída! 🎉</p>
          <p className="text-sm text-muted-foreground mt-1">Todos os leads de <strong>{lista.empreendimento}</strong> foram trabalhados.</p>
          <Button className="mt-4" onClick={onBack}>Voltar às listas</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Daily Progress Mini-Summary with Goals */}
      <div className="p-3 rounded-xl border border-border bg-card shadow-card space-y-2">
        {editingMetas ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground">Editar Metas</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Ligações</label>
                <Input type="number" value={metaLig} onChange={e => setMetaLig(e.target.value)} className="h-8 mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Aproveitados</label>
                <Input type="number" value={metaAprov} onChange={e => setMetaAprov(e.target.value)} className="h-8 mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Visitas</label>
                <Input type="number" value={metaVis} onChange={e => setMetaVis(e.target.value)} className="h-8 mt-0.5" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-7 text-xs" onClick={async () => {
                await saveGoals(parseInt(metaLig) || 30, parseInt(metaAprov) || 5, parseInt(metaVis) || 3);
                setEditingMetas(false);
                toast.success("Metas atualizadas!");
                queryClient.invalidateQueries({ queryKey: ["corretor-daily-goals"] });
              }}>Salvar</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingMetas(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-sm">
                <Flame className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground">{stats.tentativas}</span>
                <span className="text-muted-foreground text-xs">/ {metaLigacoes} ligações</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <Target className="h-4 w-4 text-success" />
                <span className="font-semibold text-foreground">{stats.aproveitados}</span>
                <span className="text-muted-foreground text-xs">/ {metaAproveitados} aproveitados</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm">
                <CalendarCheck className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-foreground">{stats.visitas_marcadas}</span>
                <span className="text-muted-foreground text-xs">/ {metaVisitas} visitas</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                  setMetaLig((goals?.meta_ligacoes || 30).toString());
                  setMetaAprov((goals?.meta_aproveitados || 5).toString());
                  setMetaVis((goals?.meta_visitas_marcadas || 3).toString());
                  setEditingMetas(true);
                }}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              {stats.tentativas >= metaLigacoes && (
                <Badge variant="secondary" className="text-[10px] gap-1">🔥 Missão cumprida!</Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Progress value={progLig} className="h-1.5" />
              <Progress value={progAprov} className="h-1.5" />
              <Progress value={progVisitas} className="h-1.5" />
            </div>
          </>
        )}
      </div>

      {/* Finalizar Trabalho */}
      <div className="flex items-center justify-between gap-2">
        <ScoringLegend />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={async () => {
            if (!user) return;
            setFinalizando(true);
            try {
              const { data, error } = await supabase.rpc("finalizar_trabalho_corretor", { p_user_id: user.id });
              if (error) throw error;
              const result = data as any;
              if (result?.success) {
                toast.success(`Trabalho finalizado! ${result.tentativas} tentativas e ${result.aproveitados} aproveitados enviados ao gerente.`);
                onBack();
              } else {
                toast.error(result?.message || "Erro ao finalizar trabalho.");
              }
            } catch (err: any) {
              toast.error("Erro ao finalizar: " + err.message);
            } finally {
              setFinalizando(false);
            }
          }}
          disabled={finalizando || stats.tentativas === 0}
        >
          <LogOut className="h-3.5 w-3.5" /> {finalizando ? "Enviando..." : "Finalizar Trabalho"}
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold text-primary">{lista.empreendimento} · Modo Missão</span>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Lead {currentIndex + 1} de {fila.length}</span>
        {lockStatus === "locked" && (
          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/30 text-emerald-600">
            <Lock className="h-3 w-3" /> Reservado para você
          </Badge>
        )}
        {lockStatus === "locking" && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Loader2 className="h-3 w-3 animate-spin" /> Reservando...
          </Badge>
        )}
        {lockStatus === "failed" && (
          <Badge variant="outline" className="gap-1 text-[10px] border-destructive/30 text-destructive">
            <Lock className="h-3 w-3" /> Bloqueado por outro corretor
          </Badge>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${((currentIndex + 1) / fila.length) * 100}%` }} />
      </div>

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Lead Card (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> {lead.nome}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" /> {lead.empreendimento}
                    {lead.campanha && <span>· {lead.campanha}</span>}
                    {lead.origem && <span>· {lead.origem}</span>}
                  </div>
                </div>
                {lead.tentativas_count > 0 && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <History className="h-3 w-3" /> {lead.tentativas_count} tent.
                  </Badge>
                )}
              </div>

              {/* Contact info */}
              <div className="grid gap-2">
                {lead.telefone && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone principal</p>
                      <p className="text-base font-mono font-bold text-foreground">{lead.telefone}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone!, "Telefone")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {lead.telefone2 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Telefone secundário</p>
                      <p className="text-sm font-mono text-foreground">{lead.telefone2}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.telefone2!, "Telefone 2")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {lead.email && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">E-mail</p>
                      <p className="text-xs text-foreground">{lead.email}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => copyToClipboard(lead.email!, "E-mail")}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Extra info */}
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                {lead.data_lead && (
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Lead de {lead.data_lead}</span>
                )}
                {lead.observacoes && <span className="italic">"{lead.observacoes}"</span>}
              </div>

              {/* Attempt History */}
              {lead.tentativas_count > 0 && <AttemptHistory leadId={lead.id} />}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Button
                  size="lg"
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-12 text-sm"
                  onClick={() => handleAction("ligacao")}
                  disabled={lockStatus !== "locked" || (!!actionTaken && !showModal)}
                >
                  <Phone className="h-4 w-4" /> Ligar
                </Button>
                <Button
                  size="lg"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 h-12 text-sm"
                  onClick={() => handleAction("whatsapp")}
                  disabled={lockStatus !== "locked" || (!!actionTaken && !showModal)}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-1.5 h-12 text-sm"
                  onClick={() => handleAction("email")}
                  disabled={lockStatus !== "locked" || !lead.email || (!!actionTaken && !showModal)}
                >
                  <Mail className="h-4 w-4" /> E-mail
                </Button>
              </div>

              {actionTaken && !showModal && (
                <div className="text-center text-xs text-muted-foreground animate-pulse">
                  Registre o resultado para continuar...
                </div>
              )}

              {/* Objeções Rápidas */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Zap className="h-4 w-4 text-amber-500" /> OBJEÇÕES RÁPIDAS
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {[
                    { objecao: "Já tenho corretor", resposta: "Entendo! Meu papel não é substituir ninguém, mas complementar. Posso te mostrar condições exclusivas deste empreendimento que talvez seu corretor não tenha acesso." },
                    { objecao: "Não tenho interesse", resposta: "Sem problemas! Só por curiosidade, o que te fez preencher o formulário? Às vezes temos condições que mudam a perspectiva." },
                    { objecao: "Estou sem tempo agora", resposta: "Claro! Posso te ligar em outro horário? Leva menos de 2 minutos. Qual o melhor horário pra você?" },
                    { objecao: "Está muito caro", resposta: "Entendo sua preocupação. Temos planos de pagamento facilitados e condições especiais de lançamento. Posso te mostrar uma simulação rápida?" },
                    { objecao: "Preciso falar com meu cônjuge", resposta: "Faz todo sentido! Que tal agendarmos uma visita juntos? Assim vocês podem conhecer o empreendimento e tirar todas as dúvidas de uma vez." },
                    { objecao: "Já comprei outro imóvel", resposta: "Parabéns pela aquisição! Muitos dos nossos clientes investem em um segundo imóvel para renda. Já pensou nisso?" },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-background">
                      <p className="text-xs font-bold text-destructive mb-1">❌ "{item.objecao}"</p>
                      <p className="text-xs text-foreground">✅ {item.resposta}</p>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        </div>

        {/* Right: Script Panel (2 cols) */}
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <ScriptPanel empreendimento={lista.empreendimento} lead={lead} />
          </div>
        </div>
      </div>

      {/* Attempt Modal */}
      {showModal && (
        <AttemptModal
          open={showModal}
          onClose={() => { setShowModal(false); setActionTaken(null); }}
          onSubmit={handleResultSubmit}
          leadName={lead.nome}
        />
      )}
    </div>
  );
}
