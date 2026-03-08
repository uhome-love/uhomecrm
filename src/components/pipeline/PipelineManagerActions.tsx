import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Phone, CalendarDays, FileText, MessageSquare, Send, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PipelineLead } from "@/hooks/usePipeline";
import { differenceInHours } from "date-fns";

interface TeamMemberInfo {
  user_id: string;
  nome: string;
  telefone?: string;
}

interface Props {
  leads: PipelineLead[];
  corretorNomes: Record<string, string>;
}

type ActionType = "ligacoes" | "leads_parados" | "visitas" | "relatorio";

interface ActionConfig {
  type: ActionType;
  icon: any;
  label: string;
  description: string;
  buildMessage: (member: TeamMemberInfo, leads: PipelineLead[]) => string;
}

export default function PipelineManagerActions({ leads, corretorNomes }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberInfo[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [previewMessage, setPreviewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(false);

  const today = format(new Date(), "dd/MM/yyyy");

  // Group leads by corretor for stats
  const leadsByCorretor = useMemo(() => {
    const map = new Map<string, PipelineLead[]>();
    for (const l of leads) {
      if (!l.corretor_id) continue;
      const arr = map.get(l.corretor_id) || [];
      arr.push(l);
      map.set(l.corretor_id, arr);
    }
    return map;
  }, [leads]);

  const leadsParadosByCorretor = useMemo(() => {
    const now = new Date();
    const map = new Map<string, PipelineLead[]>();
    for (const l of leads) {
      if (!l.corretor_id) continue;
      const last = l.ultimo_contato || l.updated_at || l.created_at;
      if (last && differenceInHours(now, new Date(last)) > 3) {
        const arr = map.get(l.corretor_id) || [];
        arr.push(l);
        map.set(l.corretor_id, arr);
      }
    }
    return map;
  }, [leads]);

  const actions: ActionConfig[] = [
    {
      type: "ligacoes",
      icon: Phone,
      label: "Cobrar Ligações",
      description: "Lembrar corretores sobre metas de ligações",
      buildMessage: (m) =>
        `Oi ${m.nome?.split(" ")[0]}! 👋 Passando para lembrar sobre sua meta de ligações de hoje. Vamos lá! 💪`,
    },
    {
      type: "leads_parados",
      icon: RefreshCw,
      label: "Cobrar Atualização",
      description: "Corretores com leads sem atualização >3h",
      buildMessage: (m, mLeads) => {
        const count = mLeads.length;
        const tempo = "3 horas";
        return `Oi ${m.nome?.split(" ")[0]}! Você tem ${count} lead(s) sem atualização há mais de ${tempo}. Por favor, atualize no sistema. 🙏`;
      },
    },
    {
      type: "visitas",
      icon: CalendarDays,
      label: "Cobrar Visitas",
      description: "Corretores com visita hoje não atualizada",
      buildMessage: (m) =>
        `Oi ${m.nome?.split(" ")[0]}! Suas visitas de hoje — como foram? Atualize o status no sistema! ✅`,
    },
    {
      type: "relatorio",
      icon: FileText,
      label: "Relatório Rápido",
      description: "Gera resumo do time para você",
      buildMessage: () => "",
    },
  ];

  const loadTeamMembers = useCallback(async () => {
    if (!user) return;
    setLoadingTeam(true);
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, nome")
      .eq("gerente_id", user.id)
      .eq("status", "ativo");

    const userIds = (members || []).map(m => m.user_id).filter(Boolean) as string[];
    let phoneMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, telefone")
        .in("user_id", userIds);
      profiles?.forEach(p => { if (p.telefone) phoneMap[p.user_id!] = p.telefone; });
    }

    const result: TeamMemberInfo[] = (members || [])
      .filter(m => m.user_id)
      .map(m => ({
        user_id: m.user_id!,
        nome: m.nome,
        telefone: phoneMap[m.user_id!],
      }));

    setTeamMembers(result);
    setLoadingTeam(false);
    return result;
  }, [user]);

  const openAction = useCallback(async (type: ActionType) => {
    setActiveAction(type);
    const members = await loadTeamMembers();
    if (!members) return;

    if (type === "relatorio") {
      // Generate report for manager
      generateReport(members);
      return;
    }

    // Auto-select members based on action type
    if (type === "leads_parados") {
      const auto = new Set(members.filter(m => leadsParadosByCorretor.has(m.user_id)).map(m => m.user_id));
      setSelectedMembers(auto);
    } else {
      setSelectedMembers(new Set(members.map(m => m.user_id)));
    }

    // Set preview message
    const action = actions.find(a => a.type === type)!;
    const sampleMember = members[0];
    if (sampleMember) {
      const sampleLeads = (type === "leads_parados" ? leadsParadosByCorretor.get(sampleMember.user_id) : leadsByCorretor.get(sampleMember.user_id)) || [];
      setPreviewMessage(action.buildMessage(sampleMember, sampleLeads));
    }

    setDialogOpen(true);
  }, [loadTeamMembers, leadsParadosByCorretor, leadsByCorretor]);

  const generateReport = useCallback(async (members: TeamMemberInfo[]) => {
    if (!user) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Sessão expirada"); return; }

      const { data: prof } = await supabase.from("profiles").select("telefone, nome").eq("user_id", user.id).single();
      if (!prof?.telefone) { toast.error("Cadastre seu telefone nas configurações"); setSending(false); return; }

      const totalLeads = leads.filter(l => l.corretor_id && members.some(m => m.user_id === l.corretor_id)).length;
      const parados = [...leadsParadosByCorretor.values()].flat().length;

      // Find best/worst
      let best = { nome: "-", count: 0 };
      let worst = { nome: "-", count: 999999 };
      for (const m of members) {
        const count = leadsByCorretor.get(m.user_id)?.length || 0;
        if (count > best.count) best = { nome: m.nome, count };
        if (count < worst.count) worst = { nome: m.nome, count };
      }

      const mensagem = `📊 *Relatório Rápido — ${today}*\n\n👥 Time: ${members.length} corretores\n📋 Leads ativos: ${totalLeads}\n⚠️ Leads parados: ${parados}\n\n🏆 Destaque: ${best.nome} (${best.count} leads)\n⚠️ Atenção: ${worst.nome} (${worst.count} leads)`;

      await supabase.functions.invoke("whatsapp-notificacao", {
        body: { telefone: prof.telefone, tipo: "cobranca", dados: { mensagem_personalizada: mensagem } },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      await supabase.from("cobrancas_enviadas").insert({
        enviado_por: user.id,
        tipo: "relatorio_rapido",
        destinatarios: [{ corretor_id: user.id, nome: prof.nome, telefone: prof.telefone }],
        mensagem,
      });

      toast.success("📊 Relatório enviado para seu WhatsApp!");
    } catch { toast.error("Erro ao enviar relatório"); }
    finally { setSending(false); }
  }, [user, leads, leadsByCorretor, leadsParadosByCorretor, today]);

  const sendMessages = useCallback(async () => {
    if (!user || !activeAction) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { toast.error("Sessão expirada"); return; }

      const action = actions.find(a => a.type === activeAction)!;
      const selected = teamMembers.filter(m => selectedMembers.has(m.user_id));
      let enviados = 0;
      const destinatarios: any[] = [];

      for (const m of selected) {
        if (!m.telefone) continue;
        const mLeads = (activeAction === "leads_parados" ? leadsParadosByCorretor.get(m.user_id) : leadsByCorretor.get(m.user_id)) || [];
        const msg = action.buildMessage(m, mLeads);

        await supabase.functions.invoke("whatsapp-notificacao", {
          body: { telefone: m.telefone, tipo: "cobranca", dados: { mensagem_personalizada: msg } },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        destinatarios.push({ corretor_id: m.user_id, nome: m.nome, telefone: m.telefone });
        enviados++;
        if (enviados < selected.length) await new Promise(r => setTimeout(r, 1000));
      }

      await supabase.from("cobrancas_enviadas").insert({
        enviado_por: user.id,
        tipo: activeAction,
        destinatarios,
        mensagem: previewMessage,
      });

      toast.success(`✅ Mensagem enviada para ${enviados} corretor(es)`);
      setDialogOpen(false);
    } catch { toast.error("Erro ao enviar mensagens"); }
    finally { setSending(false); }
  }, [user, activeAction, teamMembers, selectedMembers, previewMessage, leadsParadosByCorretor, leadsByCorretor]);

  const toggleMember = (uid: string) => {
    setSelectedMembers(prev => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  };

  const parados3h = [...leadsParadosByCorretor.values()].flat().length;

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center justify-between w-full px-3 py-2 text-left"
        >
          <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
            ⚡ Ações Rápidas do Time
            {parados3h > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{parados3h} parados</Badge>}
          </span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>

        {expanded && (
          <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {actions.map(a => (
              <Button
                key={a.type}
                variant="outline"
                size="sm"
                onClick={() => openAction(a.type)}
                disabled={sending}
                className="flex flex-col items-center gap-1 h-auto py-2.5 text-[10px]"
              >
                <a.icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{a.label}</span>
                <span className="text-muted-foreground text-[9px] text-center leading-tight">{a.description}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Confirm dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {activeAction === "ligacoes" ? "📞 Cobrar Ligações" :
               activeAction === "leads_parados" ? "📅 Cobrar Atualização de Leads" :
               activeAction === "visitas" ? "🏠 Cobrar Visitas" : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium mb-2">Preview da mensagem:</p>
              <Textarea
                value={previewMessage}
                onChange={e => setPreviewMessage(e.target.value)}
                className="text-xs min-h-[80px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium">Enviar para:</p>
                <button
                  className="text-[10px] text-primary hover:underline"
                  onClick={() => {
                    if (selectedMembers.size === teamMembers.length) setSelectedMembers(new Set());
                    else setSelectedMembers(new Set(teamMembers.map(m => m.user_id)));
                  }}
                >
                  {selectedMembers.size === teamMembers.length ? "Desmarcar todos" : "Selecionar todos"}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                {loadingTeam ? (
                  <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                ) : teamMembers.map(m => (
                  <label key={m.user_id} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                    <Checkbox
                      checked={selectedMembers.has(m.user_id)}
                      onCheckedChange={() => toggleMember(m.user_id)}
                    />
                    <span>{m.nome}</span>
                    {!m.telefone && <Badge variant="outline" className="text-[8px] h-3.5">Sem tel</Badge>}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={sendMessages}
              disabled={sending || selectedMembers.size === 0}
              className="text-xs gap-1.5"
            >
              {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              Enviar para {selectedMembers.size} corretor(es)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
