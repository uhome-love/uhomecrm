import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, MapPin, Loader2, Clock, Lock, Unlock, Sun, Sunset, Moon, CheckCircle2, XCircle } from "lucide-react";
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
import { compareRoletaSegmentosByNome } from "@/hooks/useRoletaSegmentos";
import PresencaDoCorretorPill from "@/components/corretor/PresencaDoCorretorPill";

// Segmento shape


interface Segmento {
  id: string;
  nome: string;
  descricao: string | null;
  faixa_preco: string | null;
  empreendimentos: string[];
}

// TODO: TEMPORÁRIO - ajustar horários após período de teste
type JanelaKey = "manha" | "tarde" | "noite" | "dia_todo";
type JanelaDb = "manha" | "tarde" | "noturna" | "dia_todo";

interface JanelaConfig {
  key: JanelaKey;
  label: string;
  emoji: string;
  icon: typeof Sun;
  credAberto: { inicio: number; fim: number }; // hours
  recebimento: string;
  temRequisitos: boolean;
}

const toDbJanela = (janela: JanelaKey): JanelaDb => (janela === "noite" ? "noturna" : janela === "dia_todo" ? "dia_todo" : (janela as JanelaDb));
const toUiJanela = (janela: string): JanelaKey => (janela === "noturna" ? "noite" : janela === "dia_todo" ? "dia_todo" : (janela as JanelaKey));

// Detect Saturday (BRT)
function isSaturdayBRT(): boolean {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.getDay() === 6;
}

// Detect Sunday (BRT)
function isSundayBRTLocal(): boolean {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.getDay() === 0;
}

// Feriados liberados (dia todo, sem limite de horário) — formato "YYYY-MM-DD"
const FERIADOS_LIBERADOS = [
  "2026-01-01",
  "2026-02-16",
  "2026-02-17",
  "2026-04-03",
  "2026-04-21",
  "2026-05-01",
  "2026-06-04",
  "2026-09-07",
  "2026-10-12",
  "2026-11-02",
  "2026-11-15",
  "2026-12-25",
];

function isHolidayBRT(): boolean {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dateStr = brt.toISOString().slice(0, 10);
  return FERIADOS_LIBERADOS.includes(dateStr);
}

// Janelas de credenciamento com horários de abertura e fechamento
function getJanelasConfig(): JanelaConfig[] {
  const saturdayMorning = isSaturdayBRT();
  const sunday = isSundayBRTLocal();
  const holiday = isHolidayBRT();
  
  if (sunday || holiday) {
    return [
      { key: "dia_todo" as JanelaKey, label: "Dia Todo", emoji: "☀️", icon: Sun, credAberto: { inicio: 8, fim: 23.99 }, recebimento: "08:00 — 23:59", temRequisitos: false },
    ];
  }
  
  return [
    { key: "manha", label: "Manhã", emoji: "🌅", icon: Sun, credAberto: { inicio: 7, fim: 9.5 }, recebimento: "7h — 12h", temRequisitos: false },
    { key: "tarde", label: "Tarde", emoji: "🌞", icon: Sunset, credAberto: { inicio: 12, fim: 13.5 }, recebimento: "12h — 18h", temRequisitos: false },
    { key: "noite", label: "Noite", emoji: "🌙", icon: Moon, credAberto: { inicio: 18, fim: 20 }, recebimento: "18h — 23h30", temRequisitos: true },
  ];
}

// NOTE: JANELAS_CONFIG is now computed inside the component to handle day changes

function formatHora(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function getHoraDecimal() {
  const now = new Date();
  const brt = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brt.getHours() + brt.getMinutes() / 60;
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

function getJanelaOperacaoStatus(janela: JanelaKey): "aberto" | "encerrado" | "futuro" {
  const h = getHoraDecimal();

  const faixa =
    janela === "manha"
      ? { inicio: 7, fim: 12 }
      : janela === "tarde"
        ? { inicio: 12, fim: 18 }
        : janela === "noite"
          ? { inicio: 18, fim: 23.5 }
          : { inicio: 8, fim: 23.99 };

  if (h < faixa.inicio) return "futuro";
  if (h >= faixa.fim) return "encerrado";
  return "aberto";
}

interface NightRequirements {
  visitaMarcada: boolean;
  visitaRealizada: boolean;
  visitasCount: number;
  sistemaAtualizado: boolean;
  leadsDesatualizados: number;
  limiteLeads: number;
  loading: boolean;
  error: string | null;
}

function useNightRequirements(
  userId: string | undefined,
  profileId: string | null,
  refreshKey: number = 0,
): NightRequirements & { refresh: () => void } {
  const [state, setState] = useState<NightRequirements>({
    visitaMarcada: false, visitaRealizada: false, visitasCount: 0,
    sistemaAtualizado: true, leadsDesatualizados: 0, limiteLeads: 10,
    loading: true, error: null,
  });
  const [internalKey, setInternalKey] = useState(0);

  const refresh = useCallback(() => setInternalKey(k => k + 1), []);

  useEffect(() => {
    if (!userId) { setState(s => ({ ...s, loading: false })); return; }
    let cancelled = false;

    const check = async () => {
      setState(s => ({ ...s, loading: true, error: null }));
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const idsToCheck = [userId, profileId].filter(Boolean) as string[];

      let visitaMarcada = false;
      let visitaRealizada = false;
      let visitasCount = 0;
      let sistemaAtualizado = true;
      let leadsDesatualizados = 0;
      let limiteLeads = 10;
      let error: string | null = null;

      try {
        const marcadasRes = await supabase.from("visitas").select("id", { count: "exact", head: true })
          .in("corretor_id", idsToCheck)
          .gte("data_visita", hoje)
          .in("status", ["marcada", "confirmada", "reagendada"]);
        const realizadasRes = await supabase.from("visitas").select("id", { count: "exact", head: true })
          .in("corretor_id", idsToCheck)
          .eq("status", "realizada")
          .gte("data_visita", hoje);
        visitaMarcada = (marcadasRes.count || 0) > 0;
        visitaRealizada = (realizadasRes.count || 0) > 0;
        visitasCount = (marcadasRes.count || 0) + (realizadasRes.count || 0);
      } catch (e: any) {
        console.warn("[NightRequirements] Falha ao consultar visitas:", e);
        error = "Não foi possível verificar visitas. Tente novamente.";
      }

      try {
        const { data: eleg } = await supabase.rpc("get_elegibilidade_roleta", { p_corretor_id: userId });
        if (eleg && typeof (eleg as any).leads_desatualizados === "number") {
          leadsDesatualizados = (eleg as any).leads_desatualizados;
          limiteLeads = (eleg as any).limite_bloqueio ?? 10;
          sistemaAtualizado = leadsDesatualizados <= limiteLeads;
        }
      } catch (e) {
        console.warn("[NightRequirements] Falha ao checar elegibilidade:", e);
      }

      if (cancelled) return;
      setState({ visitaMarcada, visitaRealizada, visitasCount, sistemaAtualizado, leadsDesatualizados, limiteLeads, loading: false, error });
    };
    check();
    return () => { cancelled = true; };
  }, [userId, profileId, refreshKey, internalKey]);

  // Realtime: refresh when broker's visits change
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`night-reqs-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas", filter: `corretor_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, refresh]);

  return { ...state, refresh };
}

export default function RoletaStatusBar() {
  const JANELAS_CONFIG = getJanelasConfig();
  const { user } = useAuth();
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

  const nightReqs = useNightRequirements(user?.id, profileId, credModalOpen ? 1 : 0);

  // Re-fetch requirements every time the credenciamento modal opens
  useEffect(() => {
    if (credModalOpen) nightReqs.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credModalOpen]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
    if (profile?.id) setProfileId(profile.id);

    // Fetch segmentos
    const { data: segs } = await supabase.from("roleta_segmentos").select("id, nome, descricao, faixa_preco").eq("ativo", true).order("nome");
    const { data: camps } = await supabase.from("roleta_campanhas").select("segmento_id, empreendimento").eq("ativo", true);
    const segList: Segmento[] = (segs || []).map(s => ({
      ...s,
      empreendimentos: (camps || []).filter(c => c.segmento_id === s.id).map(c => c.empreendimento).filter(Boolean) as string[],
    })).sort((a, b) => compareRoletaSegmentosByNome(a.nome, b.nome));
    setSegmentos(segList);

    // Fetch credenciamentos for today — check all janelas
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    if (profile?.id) {
      const { data: creds } = await supabase
        .from("roleta_credenciamentos")
        .select("janela, segmento_1_id, segmento_2_id, status")
        .eq("corretor_id", profile.id)
        .eq("data", today)
        .in("status", ["aprovado", "pendente"])
        .order("created_at", { ascending: false });

      const porJanela: Record<string, string> = {};
      let activeIds: string[] = [];
      let activeStatus = "";
      (creds || []).forEach(c => {
        const uiJanela = toUiJanela(c.janela);
        porJanela[uiJanela] = c.status || "pendente";
        const ids = [c.segmento_1_id, c.segmento_2_id].filter(Boolean) as string[];
        const janelaOperacaoAtiva = getJanelaOperacaoStatus(uiJanela) !== "encerrado";
        if (!activeStatus && janelaOperacaoAtiva && ids.length > 0) {
          activeIds = ids;
          activeStatus = c.status || "";
        }
      });
      setCredenciamentosPorJanela(porJanela);
      setMySegmentoIds(activeIds);
      setSelectedIds(activeIds);
      setCredStatus(activeStatus);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Status auto-declarado removido. A presença é registrada pelo gestor
  // (ver PresencaDoCorretorPill) e a saída é feita pelo botão "Sair" no pill.


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

    const payload = {
      corretor_id: profileId,
      auth_user_id: user.id,
      data: today,
      janela: janelaDb,
      segmento_1_id: selectedIds[0] || null,
      segmento_2_id: selectedIds[1] || null,
      status: "pendente",
    } as any;

    // Retry up to 5x on transient AbortError "Lock was stolen" (supabase-js navigator.locks race).
    // The error can be either THROWN (exception) or returned via { error }, so we handle both.
    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const { error } = await supabase.from("roleta_credenciamentos").upsert(payload, {
          onConflict: "corretor_id,data,janela",
        });
        if (!error) { lastError = null; break; }
        lastError = error;
        const msg = String(error?.message || "");
        const isLockError = msg.includes("Lock was stolen") || msg.includes("AbortError") || error?.name === "AbortError";
        if (!isLockError) break;
      } catch (thrown: any) {
        lastError = thrown;
        const msg = String(thrown?.message || "");
        const isLockError = msg.includes("Lock was stolen") || msg.includes("AbortError") || thrown?.name === "AbortError";
        if (!isLockError) break;
      }
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
    }

    if (lastError) {
      console.error("Credenciamento error:", lastError);
      toast.error(`Erro ao salvar credenciamento: ${lastError.message}`);
      setSaving(false);
      return;
    }

    await fetchData();
    setSelectedJanela(null);
    setCredModalOpen(false);
    setSaving(false);
    const jCfg = JANELAS_CONFIG.find(j => j.key === janela)!;
    toast.success(`Credenciamento enviado para ${jCfg.emoji} ${jCfg.label}! Aguardando aprovação do CEO ⏳`);
  };

  const hasSegmentos = mySegmentoIds.length > 0;
  const isActiveRoleta = hasSegmentos && credStatus === "aprovado";

  const segNames = mySegmentoIds.map(id => segmentos.find(s => s.id === id)?.nome).filter(Boolean);

  const activeJanelas = Object.keys(credenciamentosPorJanela).filter(
    (janela) => getJanelaOperacaoStatus(janela as JanelaKey) !== "encerrado"
  );

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
        {/* Left: Presença (marcada pelo gestor) + status da roleta */}
        <div className="relative flex items-center gap-2 flex-wrap">
          <PresencaDoCorretorPill profileId={profileId} authUserId={user?.id} />

          <div className="h-5 w-px bg-border hidden sm:block" />
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
                const jOperacaoStatus = getJanelaOperacaoStatus(j.key);
                const credJanelaStatus = credenciamentosPorJanela[j.key]; // "aprovado" | "pendente" | undefined
                const jaCredenciado = !!credJanelaStatus;
                const credenciamentoAtivoAgora = jaCredenciado && jOperacaoStatus === "aberto";
                const credenciamentoEncerrado = jaCredenciado && jOperacaoStatus === "encerrado";
                const isAprovado = credJanelaStatus === "aprovado" && credenciamentoAtivoAgora;
                const isPendente = credJanelaStatus === "pendente" && credenciamentoAtivoAgora;
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
                                : credenciamentoEncerrado
                                  ? "Janela finalizada"
                                : jStatus === "encerrado"
                                  ? "Encerrado"
                                  : jStatus === "futuro"
                                    ? `Abre às ${formatHora(j.credAberto.inicio)}`
                                    : `Aberto até ${formatHora(j.credAberto.fim)}`
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
                      ) : credenciamentoEncerrado ? (
                        <Badge variant="outline" className="text-[10px]">
                          <Clock className="h-3 w-3 mr-1" /> Encerrado
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
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Verificando requisitos…</span>
                          </div>
                        ) : (
                          <>
                            <RequirementRow
                              ok={nightReqs.visitaMarcada || nightReqs.visitaRealizada}
                              label={
                                nightReqs.visitaMarcada || nightReqs.visitaRealizada
                                  ? `Visitas: ${nightReqs.visitasCount} hoje/futuras ✓`
                                  : "Marcar ou realizar ao menos 1 visita (0 hoje)"
                              }
                            />
                            <RequirementRow
                              ok={nightReqs.sistemaAtualizado}
                              label={
                                nightReqs.sistemaAtualizado
                                  ? "Sistema atualizado ✓"
                                  : `Atualizar leads pendentes (${nightReqs.leadsDesatualizados}/${nightReqs.limiteLeads} desatualizados)`
                              }
                            />
                            {nightReqs.error && (
                              <p className="text-[11px] text-destructive mt-1">{nightReqs.error}</p>
                            )}
                            {!nightReqs.visitaMarcada && !nightReqs.visitaRealizada && !nightReqs.error && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
                                💡 Vá ao pipeline e agende uma visita para hoje ou próximos dias para liberar a janela noturna.
                              </p>
                            )}
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
