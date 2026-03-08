import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Settings, ChevronDown, Check, MapPin, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function RoletaStatusBar() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusOnline>("offline");
  const [statusOpen, setStatusOpen] = useState(false);
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [mySegmentoIds, setMySegmentoIds] = useState<string[]>([]);
  const [credStatus, setCredStatus] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [currentJanela, setCurrentJanela] = useState("");

  const getJanela = useCallback(() => {
    const h = new Date().getHours();
    const m = new Date().getMinutes();
    const decimal = h + m / 60;
    if (decimal < 9.5) return "manha";
    if (decimal < 13.5) return "tarde";
    if (decimal < 23.5) return "noturna";
    return "manha"; // after 23:30 → next morning
  }, []);

  const getJanelaLabel = (j: string) => {
    if (j === "manha") return "Manhã ☀️";
    if (j === "tarde") return "Tarde 🌤️";
    if (j === "noturna") return "Noturna 🌙";
    return j;
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch profile id + status
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, status_online")
      .eq("user_id", user.id)
      .single();
    if (profile?.status_online) setStatus(profile.status_online as StatusOnline);
    if (profile?.id) setProfileId(profile.id);

    const janela = getJanela();
    setCurrentJanela(janela);

    // Fetch segmentos with campanhas
    const { data: segs } = await supabase
      .from("roleta_segmentos")
      .select("id, nome, descricao, faixa_preco")
      .eq("ativo", true)
      .order("nome");

    const { data: camps } = await supabase
      .from("roleta_campanhas")
      .select("segmento_id, empreendimento")
      .eq("ativo", true);

    const segList: Segmento[] = (segs || []).map((s) => ({
      ...s,
      empreendimentos: (camps || [])
        .filter((c) => c.segmento_id === s.id)
        .map((c) => c.empreendimento)
        .filter(Boolean) as string[],
    }));
    setSegmentos(segList);

    // Fetch credenciamento — today + current janela
    const today = new Date().toISOString().slice(0, 10);
    if (profile?.id) {
      const { data: creds } = await supabase
        .from("roleta_credenciamentos")
        .select("segmento_1_id, segmento_2_id, status")
        .eq("corretor_id", profile.id)
        .eq("data", today)
        .eq("janela", janela)
        .order("created_at", { ascending: false })
        .limit(1);

      if (creds && creds.length > 0) {
        const c = creds[0];
        const ids = [c.segmento_1_id, c.segmento_2_id].filter(Boolean) as string[];
        setMySegmentoIds(ids);
        setSelectedIds(ids);
        setCredStatus(c.status || "");
      } else {
        setMySegmentoIds([]);
        setSelectedIds([]);
        setCredStatus("");
      }
    }

    setLoading(false);
  }, [user, getJanela]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (newStatus: StatusOnline) => {
    if (!user) return;
    setStatus(newStatus);
    setStatusOpen(false);

    const { error } = await supabase
      .from("profiles")
      .update({ status_online: newStatus, status_updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    const opt = STATUS_OPTIONS.find((o) => o.value === newStatus)!;
    toast.success(`Status atualizado: ${opt.label} ${opt.icon}`);
  };

  const toggleSegmento = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) {
        toast.warning("Máximo 2 segmentos permitidos");
        return prev;
      }
      return [...prev, id];
    });
  };

  const saveCredenciamento = async () => {
    if (!user || !profileId || selectedIds.length === 0) return;
    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);
    const janela = getJanela();

    // Upsert: delete existing for this corretor+data+janela, then insert
    await supabase
      .from("roleta_credenciamentos")
      .delete()
      .eq("corretor_id", profileId)
      .eq("data", today)
      .eq("janela", janela);

    const { error } = await supabase
      .from("roleta_credenciamentos")
      .insert({
        corretor_id: profileId,
        data: today,
        janela,
        segmento_1_id: selectedIds[0] || null,
        segmento_2_id: selectedIds[1] || null,
        status: "pendente",
      });

    if (error) {
      console.error("Credenciamento error:", error);
      toast.error("Erro ao salvar credenciamento");
      setSaving(false);
      return;
    }

    setMySegmentoIds([...selectedIds]);
    setCredStatus("pendente");
    setCredModalOpen(false);
    setSaving(false);
    toast.success(`Credenciamento salvo para ${getJanelaLabel(janela)}! Aguardando aprovação.`);
  };

  const currentOpt = STATUS_OPTIONS.find((o) => o.value === status) || STATUS_OPTIONS[3];
  const isAvailable = status === "na_empresa" || status === "em_plantao";
  const hasSegmentos = mySegmentoIds.length > 0;
  const isActiveRoleta = isAvailable && hasSegmentos;

  const segNames = mySegmentoIds
    .map((id) => segmentos.find((s) => s.id === id)?.nome)
    .filter(Boolean);

  if (loading) {
    return (
      <div className="h-12 rounded-xl border border-border bg-card animate-pulse" />
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
          isActiveRoleta
            ? "border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-border bg-card"
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
                  {STATUS_OPTIONS.map((opt) => (
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

          {/* Divider */}
          <div className="h-5 w-px bg-border" />

          {/* Roleta status text */}
          <span className={`text-xs font-medium ${isActiveRoleta ? "text-emerald-600" : "text-muted-foreground"}`}>
            {isActiveRoleta ? "🟢 Ativo na Roleta" : "⚪ Inativo na Roleta"}
          </span>
        </div>

        {/* Right: Segmentos */}
        <div className="flex items-center gap-2">
          {hasSegmentos ? (
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <MapPin className="inline h-3 w-3 mr-0.5" />
              {segNames.join(", ")}
              {credStatus === "pendente" && (
                <span className="ml-1 text-amber-600 font-medium">(pendente)</span>
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

      {/* Modal de Credenciamento */}
      <Dialog open={credModalOpen} onOpenChange={setCredModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Credenciamento na Roleta de Leads
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
            <span className="text-xs font-medium text-primary">
              Credenciamento para: {getJanelaLabel(currentJanela)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground">
            Selecione até <strong>2 segmentos</strong> para receber leads automaticamente:
          </p>

          <div className="space-y-2 mt-2">
            {segmentos.map((seg) => {
              const isChecked = selectedIds.includes(seg.id);
              return (
                <button
                  key={seg.id}
                  onClick={() => toggleSegmento(seg.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${
                    isChecked
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isChecked}
                      className="mt-0.5"
                      onCheckedChange={() => toggleSegmento(seg.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{seg.nome}</p>
                      {seg.empreendimentos.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {seg.empreendimentos.join(", ")}
                        </p>
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
            <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
              ⚠️ Máximo 2 segmentos por corretor
            </p>
          )}

          <Button
            onClick={saveCredenciamento}
            disabled={saving || selectedIds.length === 0}
            className="w-full mt-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Salvar Credenciamento
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
