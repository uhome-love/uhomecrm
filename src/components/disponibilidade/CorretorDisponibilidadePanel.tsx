import { useState, useEffect } from "react";

// Live timer component
function TempoDisponivel({ entradaEm }: { entradaEm: string | null | undefined }) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!entradaEm) { setElapsed("—"); return; }
    const update = () => {
      const diff = Date.now() - new Date(entradaEm).getTime();
      if (diff < 0) { setElapsed("agora"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`);
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, [entradaEm]);

  return <>{elapsed}</>;
}
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Building2,
  Coffee,
  MapPin,
  WifiOff,
  Loader2,
  RotateCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  useCorretorDisponibilidade,
  SEGMENTOS_OFICIAIS,
  type DisponibilidadeStatus,
} from "@/hooks/useCorretorDisponibilidade";

const STATUS_CONFIG: Record<
  DisponibilidadeStatus,
  { label: string; icon: React.ElementType; color: string; bgColor: string }
> = {
  offline: { label: "Offline", icon: WifiOff, color: "text-muted-foreground", bgColor: "bg-muted" },
  na_empresa: { label: "Estou na empresa", icon: Building2, color: "text-emerald-600", bgColor: "bg-emerald-500/15" },
  em_pausa: { label: "Em pausa", icon: Coffee, color: "text-amber-600", bgColor: "bg-amber-500/15" },
  em_visita: { label: "Em visita", icon: MapPin, color: "text-blue-600", bgColor: "bg-blue-500/15" },
};

export default function CorretorDisponibilidadePanel() {
  const { disponibilidade, loading, setStatus, setSegmentos, saving } =
    useCorretorDisponibilidade();
  const [pendingSegmentos, setPendingSegmentos] = useState<string[]>([]);
  const [showSegmentos, setShowSegmentos] = useState(false);

  const currentStatus = disponibilidade?.status || "offline";
  const currentSegmentos = disponibilidade?.segmentos || [];
  const naRoleta = disponibilidade?.na_roleta || false;
  const config = STATUS_CONFIG[currentStatus];

  const handleStatusChange = async (newStatus: DisponibilidadeStatus) => {
    if (newStatus === currentStatus) return;

    if (newStatus === "na_empresa") {
      setPendingSegmentos(currentSegmentos.length > 0 ? currentSegmentos : []);
      setShowSegmentos(true);
      return;
    }

    await setStatus(newStatus);
    toast.info(`Status alterado para: ${STATUS_CONFIG[newStatus].label}`);
  };

  const handleConfirmEntrada = async () => {
    if (pendingSegmentos.length === 0) {
      toast.error("Selecione pelo menos 1 segmento para entrar na roleta.");
      return;
    }
    await setStatus("na_empresa", pendingSegmentos);
    setShowSegmentos(false);
    toast.success("Você está na roleta! Aguarde leads dos seus segmentos.");
  };

  const toggleSegmento = (seg: string) => {
    if (pendingSegmentos.includes(seg)) {
      setPendingSegmentos((prev) => prev.filter((s) => s !== seg));
    } else {
      if (pendingSegmentos.length >= 2) {
        toast.warning("Você pode selecionar no máximo 2 segmentos.");
        return;
      }
      setPendingSegmentos((prev) => [...prev, seg]);
    }
  };

  const handleChangeSegmentos = () => {
    setPendingSegmentos(currentSegmentos);
    setShowSegmentos(true);
  };

  const handleSaveSegmentos = async () => {
    if (pendingSegmentos.length === 0) {
      toast.error("Selecione pelo menos 1 segmento.");
      return;
    }
    await setSegmentos(pendingSegmentos);
    setShowSegmentos(false);
    toast.success("Segmentos atualizados!");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCw className="h-4 w-4 text-primary" />
          Disponibilidade & Roleta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bgColor}`}>
            <config.icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1">
            <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
            <p className="text-[10px] text-muted-foreground">
              {naRoleta ? "🟢 Na roleta" : "⚫ Fora da roleta"}
            </p>
          </div>
          {naRoleta && (
            <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-[10px]">
              Na Roleta
            </Badge>
          )}
        </div>

        {/* Live stats: tempo disponível + leads recebidos */}
        {currentStatus !== "offline" && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs">⏱</span>
              <div>
                <p className="text-[10px] text-muted-foreground">Disponível há</p>
                <p className="text-xs font-semibold text-foreground">
                  <TempoDisponivel entradaEm={disponibilidade?.entrada_em} />
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs">📩</span>
              <div>
                <p className="text-[10px] text-muted-foreground">Leads hoje</p>
                <p className="text-xs font-semibold text-foreground">
                  {disponibilidade?.leads_recebidos_turno || 0} recebidos
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Active Segments */}
        {currentSegmentos.length > 0 && !showSegmentos && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Segmentos ativos:</p>
              {currentStatus === "na_empresa" && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleChangeSegmentos}>
                  Alterar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentSegmentos.map((seg) => (
                <Badge key={seg} variant="secondary" className="text-[10px]">
                  {seg}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Segment Selection */}
        <AnimatePresence>
          {showSegmentos && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-2.5">
                <p className="text-xs font-semibold text-foreground">
                  Selecione seus segmentos (máx. 2):
                </p>
                {SEGMENTOS_OFICIAIS.map((seg) => {
                  const checked = pendingSegmentos.includes(seg);
                  const disabled = !checked && pendingSegmentos.length >= 2;
                  return (
                    <label
                      key={seg}
                      className={`flex items-center gap-2.5 p-2 rounded-md cursor-pointer transition-colors ${
                        checked
                          ? "bg-primary/10 border border-primary/20"
                          : disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-muted border border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggleSegmento(seg)}
                      />
                      <span className="text-xs">{seg}</span>
                    </label>
                  );
                })}
                <p className="text-[10px] text-muted-foreground">
                  {pendingSegmentos.length}/2 selecionados
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={
                    currentStatus === "na_empresa"
                      ? handleSaveSegmentos
                      : handleConfirmEntrada
                  }
                  disabled={saving || pendingSegmentos.length === 0}
                  className="flex-1"
                >
                  {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                  {currentStatus === "na_empresa" ? "Salvar" : "Confirmar & Entrar na Roleta"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSegmentos(false)}
                >
                  Cancelar
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Buttons */}
        <div className="grid grid-cols-2 gap-2">
          {(
            Object.entries(STATUS_CONFIG) as [DisponibilidadeStatus, typeof config][]
          ).map(([key, cfg]) => {
            const isActive = currentStatus === key;
            return (
              <Button
                key={key}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={`text-[11px] gap-1.5 ${
                  isActive ? "" : `${cfg.color} hover:${cfg.bgColor}`
                }`}
                disabled={saving || isActive}
                onClick={() => handleStatusChange(key)}
              >
                <cfg.icon className="h-3.5 w-3.5" />
                {cfg.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
