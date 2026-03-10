import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, ChevronDown, Check, MapPin, Loader2, Clock, Lock, Unlock, Sun, Sunset, Moon, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

type StatusOnline = "na_empresa" | "em_plantao" | "em_pausa" | "offline";

interface StatusOption {
  value: StatusOnline;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  available: boolean;
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: "na_empresa", label: "Na Empresa", icon: "🟢", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-300", description: "Disponível para receber leads", available: true },
  { value: "em_plantao", label: "Em Plantão", icon: "🔵", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-300", description: "Plantão externo, disponível", available: true },
  { value: "em_pausa", label: "Em Pausa", icon: "🟡", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-300", description: "Pausa temporária, não recebe leads", available: false },
  { value: "offline", label: "Offline", icon: "🔴", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-300", description: "Fora do expediente", available: false },
];

interface Segmento {
  id: string;
  nome: string;
  descricao: string | null;
  faixa_preco: string | null;
  empreendimentos: string[];
}

// TODO: TEMPORÁRIO - ajustar horários após período de teste
type JanelaKey = "manha" | "tarde" | "noite";
type JanelaDb = "manha" | "tarde" | "noturna";

interface JanelaConfig {
  key: JanelaKey;
  label: string;
  emoji: string;
  icon: typeof Sun;
  credAberto: { inicio: number; fim: number }; // hours
  recebimento: string;
  temRequisitos: boolean;
}

const toDbJanela = (janela: JanelaKey): JanelaDb => (janela === "noite" ? "noturna" : janela);
const toUiJanela = (janela: string): JanelaKey => (janela === "noturna" ? "noite" : (janela as JanelaKey));

// Janelas de credenciamento com horários de abertura e fechamento
const JANELAS_CONFIG: JanelaConfig[] = [
  { key: "manha", label: "Manhã", emoji: "🌅", icon: Sun, credAberto: { inicio: 7.5, fim: 9.5 }, recebimento: "7h30 — 9h30", temRequisitos: false },
  { key: "tarde", label: "Tarde", emoji: "🌞", icon: Sunset, credAberto: { inicio: 12, fim: 13.5 }, recebimento: "13h30 — 18h", temRequisitos: false },
  { key: "noite", label: "Noite", emoji: "🌙", icon: Moon, credAberto: { inicio: 18.5, fim: 20.5 }, recebimento: "18h — 23h30", temRequisitos: true },
];

function getHoraDecimal() {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

function isJanelaAberta(j: JanelaConfig): boolean {
  const h = getHoraDecimal();
  return h >= j.credAberto.inicio && h < j.credAberto.fim;
}

function getJanelaStatus(j: JanelaConfig): "aberto" | "encerrado" | "futuro" {
  const h = getHoraDecimal();
  if (h < j.credAberto.inicio) return "futuro";
  if (h >= j.credAberto.fim) return "encerrado";
  return "aberto";
}

interface NightRequirements {
  visitaMarcada: boolean;
  visitaRealizada: boolean;
  sistemaAtualizado: boolean;
  loading: boolean;
}

function useNightRequirements(userId: string | undefined, profileId: string | null): NightRequirements {
  const [state, setState] = useState<NightRequirements>({ visitaMarcada: false, visitaRealizada: false, sistemaAtualizado: true, loading: true });

  useEffect(() => {
    if (!userId) { setState(s => ({ ...s, loading: false })); return; }

    const check = async () => {
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

      // visitas.corretor_id stores MIXED ids: auth user_id (when broker creates)
      // or profile_id (when manager creates). We must check BOTH.
      // Also check visits scheduled for today OR future dates (not just today).
      const idsToCheck = [userId, profileId].filter(Boolean) as string[];

      const marcadasRes = await supabase.from("visitas").select("id", { count: "exact", head: true })
        .in("corretor_id", idsToCheck)
        .gte("data_visita", hoje)
        .in("status", ["marcada", "confirmada", "reagendada"]);

      const realizadasRes = await supabase.from("visitas").select("id", { count: "exact", head: true })
        .in("corretor_id", idsToCheck)
        .eq("status", "realizada")
        .gte("data_visita", hoje);

      // pipeline_leads.corretor_id stores auth user.id
      const paradosRes = await (supabase.from("pipeline_leads").select("id", { count: "exact", head: true })
        .eq("corretor_id", userId) as any).neq("pipeline_fase", "Descarte").gt("dias_parado", 1);

      setState({
        visitaMarcada: (marcadasRes.count || 0) > 0,
        visitaRealizada: (realizadasRes.count || 0) > 0,
        sistemaAtualizado: (paradosRes.count || 0) === 0,
        loading: false,
      });
    };
    check();
  }, [userId, profileId]);

  return state;
}

export default function RoletaStatusBar() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusOnline>("offline");
  const [statusOpen, setStatusOpen] = useState(false);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [credStatus, setCredStatus] = useState<string>("");
  const [mySegmentoIds, setMySegmentoIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedJanela, setSelectedJanela] = useState<JanelaKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [credenciamentosPorJanela, setCredenciamentosPorJanela] = useState<Record<string, string>>({});

  const nightReqs = useNightRequirements(user?.id, profileId);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase.from("profiles").select("id, status_online").eq("user_id", user.id).single();
    if (profile?.status_online) setStatus(profile.status_online as StatusOnline);
    if (profile?.id) setProfileId(profile.id);

    // Fetch segmentos
    const { data: segs } = await supabase.from("roleta_segmentos").select("id, nome, descricao, faixa_preco").eq("ativo", true).order("nome");
    const { data: camps } = await supabase.from("roleta_campanhas").select("segmento_id, empreendimento").eq("ativo", true);
    const segList: Segmento[] = (segs || []).map(s => ({
      ...s,
      empreendimentos: (camps || []).filter(c => c.segmento_id === s.id).map(c => c.empreendimento).filter(Boolean) as string[],
    }));
    setSegmentos(segList);

    // Fetch credenciamentos for today — check all janelas
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (profile?.id) {
      const { data: creds } = await supabase
        .from("roleta_credenciamentos")
        .select("janela, segmento_1_id, segmento_2_id, status")
        .eq("corretor_id", profile.id)
        .eq("data", today)
        .in("status", ["aprovado", "pendente"]);

      const porJanela: Record<string, string> = {};
      let activeIds: string[] = [];
      let activeStatus = "";
      (creds || []).forEach(c => {
        porJanela[toUiJanela(c.janela)] = c.status || "pendente";
        const ids = [c.segmento_1_id, c.segmento_2_id].filter(Boolean) as string[];
        if (ids.length > 0) { activeIds = ids; activeStatus = c.status || ""; }
      });
      setCredenciamentosPorJanela(porJanela);
      setMySegmentoIds(activeIds);
      setSelectedIds(activeIds);
      setCredStatus(activeStatus);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (newStatus: StatusOnline) => {
    if (!user) return;
    setStatus(newStatus);
    setStatusOpen(false);
    const { error } = await supabase.from("profiles").update({ status_online: newStatus, status_updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (error) { toast.error("Erro ao atualizar status"); return; }
    const opt = STATUS_OPTIONS.find(o => o.value === newStatus)!;
    toast.success(`Status atualizado: ${opt.label} ${opt.icon}`);

    // If going offline, remove from roleta (deactivate credenciamentos + fila)
    if (newStatus === "offline" && profileId) {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      // Mark credenciamentos as "saiu"
      const { error: credErr } = await supabase.from("roleta_credenciamentos")
        .update({ status: "saiu", saiu_em: new Date().toISOString() })
        .eq("corretor_id", profileId)
        .eq("data", today)
        .in("status", ["pendente", "aprovado"]);
      // Deactivate from fila
      const { error: filaErr } = await supabase.from("roleta_fila")
        .update({ ativo: false })
        .eq("corretor_id", profileId)
        .eq("data", today)
        .eq("ativo", true);
      
      if (credErr) console.error("Erro ao sair da roleta (cred):", credErr);
      if (filaErr) console.error("Erro ao sair da fila:", filaErr);
      
      // Reset local state immediately
      setCredenciamentosPorJanela({});
      setMySegmentoIds([]);
      setSelectedIds([]);
      setCredStatus("");
      toast.info("Você saiu da roleta automaticamente.");
      // Refetch to ensure consistency
      setTimeout(() => fetchData(), 500);
    }
  };

  const toggleSegmento = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) { toast.warning("Máximo 2 segmentos permitidos"); return prev; }
      return [...prev, id];
    });
  };

  const saveCredenciamento = async (janela: JanelaKey) => {
    if (!user || !profileId || selectedIds.length === 0) return;
    setSaving(true);
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const janelaDb = toDbJanela(janela);

    const { error } = await supabase.from("roleta_credenciamentos").upsert({
      corretor_id: profileId,
      data: today,
      janela: janelaDb,
      segmento_1_id: selectedIds[0] || null,
      segmento_2_id: selectedIds[1] || null,
      status: "pendente",
    } as any, {
      onConflict: "corretor_id,data,janela",
    });

    if (error) {
      console.error("Credenciamento error:", error);
      toast.error(`Erro ao salvar credenciamento: ${error.message}`);
      setSaving(false);
      return;
    }

    await fetchData();
    setSelectedJanela(null);
    setCredModalOpen(false);
    setSaving(false);
    const jCfg = JANELAS_CONFIG.find(j => j.key === janela)!;
    toast.success(`Credenciamento enviado para ${jCfg.emoji} ${jCfg.label}! Aguardando aprovação ⏳`);
  };

  const currentOpt = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[3];
  const isAvailable = status === "na_empresa" || status === "em_plantao";
  const hasSegmentos = mySegmentoIds.length > 0;
  const isActiveRoleta = isAvailable && hasSegmentos && credStatus === "aprovado";

  const segNames = mySegmentoIds.map(id => segmentos.find(s => s.id === id)?.nome).filter(Boolean);

  const activeJanelas = Object.keys(credenciamentosPorJanela);

  if (loading) return <div className="h-12 rounded-xl border border-border bg-card animate-pulse" />;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
          isActiveRoleta ? "border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border bg-card"
        }`}
      >
        {/* Left: Status */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className={`flex items-center gap-1.5 text-sm font-medium rounded-lg px-2.5 py-1 transition-colors hover:bg-muted/50 ${currentOpt.color}`}
          >
            <span>{currentOpt.icon}</span>
            <span>{currentOpt.label}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${statusOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setStatusOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => updateStatus(opt.value)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${
                        opt.value === status ? `${opt.bgColor} ${opt.borderColor} border-l-2` : ""
                      }`}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${opt.color}`}>{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                      {opt.value === status && <Check className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <div className="h-5 w-px bg-border" />
          <span className={`text-xs font-medium ${
            isActiveRoleta ? "text-emerald-600" : 
            credStatus === "pendente" ? "text-amber-600" : "text-muted-foreground"
          }`}>
            {isActiveRoleta ? "🟢 Ativo na Roleta" : 
             credStatus === "pendente" ? "⏳ Aguardando aprovação" : "⚪ Inativo na Roleta"}
          </span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {hasSegmentos ? (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <MapPin className="inline h-3 w-3 mr-0.5" />
              {segNames.join(", ")}
              {activeJanelas.length > 0 && (
                <span className="ml-1 text-primary font-medium">
                  ({activeJanelas.map(j => JANELAS_CONFIG.find(c => c.key === j)?.emoji).join("")})
                </span>
              )}
            </span>
          ) : (
            <button
              onClick={() => setCredModalOpen(true)}
              className="text-xs text-amber-600 font-medium hover:text-amber-700 transition-colors hidden sm:inline"
            >
              📍 Nenhum segmento — Credenciar-se →
            </button>
          )}
          <button
            onClick={() => setCredModalOpen(true)}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title="Credenciamento na Roleta"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* Modal de Credenciamento — 3 Janelas */}
      <Dialog open={credModalOpen} onOpenChange={setCredModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Credenciamento na Roleta
            </DialogTitle>
          </DialogHeader>

          {selectedJanela === null ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Escolha a janela para se credenciar:</p>
              {JANELAS_CONFIG.map(j => {
                const jStatus = getJanelaStatus(j);
                const credJanelaStatus = credenciamentosPorJanela[j.key]; // "aprovado" | "pendente" | undefined
                const jaCredenciado = !!credJanelaStatus;
                const isAprovado = credJanelaStatus === "aprovado";
                const isPendente = credJanelaStatus === "pendente";
                // Desbloqueia com visita marcada OU realizada (+ sistema atualizado)
                const nightBlocked = j.temRequisitos && !((nightReqs.visitaMarcada || nightReqs.visitaRealizada) && nightReqs.sistemaAtualizado);
                const isDisabled = jStatus !== "aberto" || jaCredenciado || (j.temRequisitos && nightBlocked);
                const Icon = j.icon;

                return (
                  <button
                    key={j.key}
                    disabled={isDisabled}
                    onClick={() => { setSelectedJanela(j.key); }}
                    className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                      isAprovado
                        ? "border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20"
                        : isPendente
                          ? "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20"
                          : isDisabled
                            ? "border-border bg-muted/30 opacity-60 cursor-not-allowed"
                            : "border-border hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isAprovado ? "bg-emerald-100 dark:bg-emerald-900/30" :
                          isPendente ? "bg-amber-100 dark:bg-amber-900/30" :
                          isDisabled ? "bg-muted" : "bg-primary/10"
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            isAprovado ? "text-emerald-600" : isPendente ? "text-amber-600" : isDisabled ? "text-muted-foreground" : "text-primary"
                          }`} />
                        </div>
                        <div>
                          <p className="text-sm font-bold flex items-center gap-1.5">
                            {j.emoji} {j.label}
                            <span className="text-xs font-normal text-muted-foreground">
                              ({j.recebimento})
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isAprovado
                              ? "✅ Aprovado — Ativo na roleta"
                              : isPendente
                                ? "⏳ Aguardando aprovação do gestor"
                                : jStatus === "encerrado"
                                  ? "Encerrado"
                                  : jStatus === "futuro"
                                    ? `Abre às ${j.credAberto.inicio}h`
                                    : `Aberto até ${j.credAberto.fim === 13.5 ? "13:30" : j.credAberto.fim === 9.5 ? "09:30" : j.credAberto.fim === 20.5 ? "20:30" : j.credAberto.fim + "h"}`
                            }
                          </p>
                        </div>
                      </div>
                      {isAprovado ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
                        </Badge>
                      ) : isPendente ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 text-[10px]">
                          ⏳ Pendente
                        </Badge>
                      ) : isDisabled ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-4 w-4 text-primary" />
                      )}
                    </div>

                    {/* Night requirements */}
                    {j.temRequisitos && jStatus === "aberto" && !jaCredenciado && (
                      <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Para desbloquear, complete hoje:</p>
                        {nightReqs.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <RequirementRow ok={nightReqs.visitaMarcada || nightReqs.visitaRealizada} label="Marcar ou realizar pelo menos 1 visita" />
                            <RequirementRow ok={nightReqs.sistemaAtualizado} label="Sistema atualizado" />
                          </>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Segmento selection for chosen janela */
            <div className="space-y-4">
              <button
                onClick={() => setSelectedJanela(null)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Voltar às janelas
              </button>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <span className="text-xs font-medium text-primary">
                  {JANELAS_CONFIG.find(j => j.key === selectedJanela)?.emoji}{" "}
                  Credenciando para: {JANELAS_CONFIG.find(j => j.key === selectedJanela)?.label}
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                Selecione até <strong>2 segmentos</strong> para receber leads:
              </p>

              <div className="space-y-2">
                {segmentos.map(seg => {
                  const isChecked = selectedIds.includes(seg.id);
                  return (
                    <button
                      key={seg.id}
                      onClick={() => toggleSegmento(seg.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${
                        isChecked ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox checked={isChecked} className="mt-0.5" onCheckedChange={() => toggleSegmento(seg.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{seg.nome}</p>
                          {seg.empreendimentos.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">{seg.empreendimentos.join(", ")}</p>
                          )}
                          {seg.faixa_preco && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{seg.faixa_preco}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedIds.length >= 2 && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">⚠️ Máximo 2 segmentos por corretor</p>
              )}

              <Button
                onClick={() => saveCredenciamento(selectedJanela)}
                disabled={saving || selectedIds.length === 0}
                className="w-full"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Credenciamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequirementRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
      <span className={ok ? "text-emerald-600" : "text-destructive"}>{label}</span>
    </div>
  );
}
