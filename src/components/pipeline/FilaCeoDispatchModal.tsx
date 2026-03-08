import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Rocket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SegmentoPreview {
  segmento_id: string;
  segmento_nome: string;
  empreendimentos: string[];
  count: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatched?: () => void;
}

type Janela = "manha" | "tarde" | "noturna" | "qualquer";

const JANELA_OPTIONS: { id: Janela; label: string; emoji: string }[] = [
  { id: "manha", label: "Roleta da Manhã", emoji: "🌅" },
  { id: "tarde", label: "Roleta da Tarde", emoji: "☀️" },
  { id: "noturna", label: "Roleta Noturna", emoji: "🌙" },
  { id: "qualquer", label: "Distribuir agora para qualquer corretor ativo", emoji: "📋" },
];

export default function FilaCeoDispatchModal({ open, onOpenChange, onDispatched }: Props) {
  const [loading, setLoading] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [segmentoMap, setSegmentoMap] = useState<Record<string, { id: string; nome: string }>>({});
  const [selectedJanela, setSelectedJanela] = useState<Janela>("manha");
  const [includeUnidentified, setIncludeUnidentified] = useState(false);

  // Load CEO queue leads and segmento mapping
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("pipeline_leads")
        .select("id, nome, empreendimento, telefone, origem")
        .is("corretor_id", null)
        .order("created_at", { ascending: false }),
      supabase.from("roleta_campanhas")
        .select("empreendimento, segmento_id, roleta_segmentos(id, nome)")
        .eq("ativo", true),
    ]).then(([leadsRes, campRes]) => {
      setLeads(leadsRes.data || []);
      const map: Record<string, { id: string; nome: string }> = {};
      (campRes.data || []).forEach((c: any) => {
        if (c.empreendimento && c.roleta_segmentos) {
          map[c.empreendimento.toLowerCase().trim()] = {
            id: c.roleta_segmentos.id,
            nome: c.roleta_segmentos.nome,
          };
        }
      });
      setSegmentoMap(map);
      setLoading(false);
    });
  }, [open]);

  // Group leads by segmento
  const { preview, unidentifiedCount } = useMemo(() => {
    const groups: Record<string, SegmentoPreview> = {};
    let unidentified = 0;

    for (const lead of leads) {
      const emp = (lead.empreendimento || "").toLowerCase().trim();
      const seg = segmentoMap[emp];
      if (seg) {
        if (!groups[seg.id]) {
          groups[seg.id] = { segmento_id: seg.id, segmento_nome: seg.nome, empreendimentos: [], count: 0 };
        }
        groups[seg.id].count++;
        const empName = lead.empreendimento || "";
        if (!groups[seg.id].empreendimentos.includes(empName)) {
          groups[seg.id].empreendimentos.push(empName);
        }
      } else {
        unidentified++;
      }
    }

    return { preview: Object.values(groups), unidentifiedCount: unidentified };
  }, [leads, segmentoMap]);

  const identifiedCount = leads.length - unidentifiedCount;

  const handleDispatch = async () => {
    setDispatching(true);
    let dispatched = 0;
    let failed = 0;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        setDispatching(false);
        return;
      }

      for (const lead of leads) {
        const emp = (lead.empreendimento || "").toLowerCase().trim();
        const seg = segmentoMap[emp];

        if (!seg && !includeUnidentified) continue;

        try {
          const { error } = await supabase.functions.invoke("distribute-lead", {
            body: {
              action: "dispatch_fila_ceo",
              lead_id: lead.id,
              segmento_id: seg?.id || null,
              janela: selectedJanela,
            },
          });
          if (error) { failed++; continue; }
          dispatched++;
        } catch {
          failed++;
        }
      }

      // Log the dispatch
      await supabase.from("audit_log").insert({
        user_id: session.user.id,
        modulo: "roleta",
        acao: "dispatch_fila_ceo",
        descricao: `Disparou ${dispatched} leads da Fila CEO para roleta (janela: ${selectedJanela})`,
        depois: { dispatched, failed, janela: selectedJanela, unidentified: unidentifiedCount },
      });

      toast.success(`✅ ${dispatched} leads disparados para a roleta!${unidentifiedCount > 0 && !includeUnidentified ? ` ${unidentifiedCount} leads sem segmento identificado.` : ""}`);
      onOpenChange(false);
      onDispatched?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao disparar leads para a roleta.");
    } finally {
      setDispatching(false);
    }
  };

  const SEGMENTO_COLORS: Record<string, string> = {
    "MCMV / Até 500k": "bg-blue-500/10 text-blue-700 border-blue-300",
    "Médio-Alto Padrão": "bg-emerald-500/10 text-emerald-700 border-emerald-300",
    "Altíssimo Padrão": "bg-amber-500/10 text-amber-700 border-amber-300",
    "Investimento": "bg-purple-500/10 text-purple-700 border-purple-300",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Rocket className="h-5 w-5 text-purple-600" />
            Disparar Fila CEO para a Roleta
          </DialogTitle>
          <DialogDescription>
            {leads.length} leads serão distribuídos automaticamente pelos segmentos
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* Preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prévia de distribuição</p>
              {preview.map(p => (
                <div key={p.segmento_id} className={`flex items-center justify-between p-2.5 rounded-lg border ${SEGMENTO_COLORS[p.segmento_nome] || "bg-muted/50 border-border"}`}>
                  <div>
                    <span className="text-sm font-medium">● {p.segmento_nome}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.empreendimentos.join(", ")}</p>
                  </div>
                  <Badge variant="secondary" className="font-bold">{p.count} leads</Badge>
                </div>
              ))}
              {unidentifiedCount > 0 && (
                <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-300 bg-amber-500/10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Não identificados</span>
                  </div>
                  <Badge variant="secondary" className="font-bold">{unidentifiedCount} leads</Badge>
                </div>
              )}
            </div>

            {/* Janela selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Disparar para qual janela?</p>
              <div className="grid grid-cols-1 gap-1.5">
                {JANELA_OPTIONS.map(j => (
                  <button
                    key={j.id}
                    onClick={() => setSelectedJanela(j.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm text-left transition-colors ${
                      selectedJanela === j.id
                        ? "border-purple-500 bg-purple-500/10 text-purple-700 font-medium"
                        : "border-border hover:border-purple-300 text-foreground"
                    }`}
                  >
                    <span>{j.emoji}</span>
                    <span>{j.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Include unidentified */}
            {unidentifiedCount > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-unidentified"
                  checked={includeUnidentified}
                  onCheckedChange={(v) => setIncludeUnidentified(!!v)}
                />
                <label htmlFor="include-unidentified" className="text-xs text-muted-foreground cursor-pointer">
                  Incluir leads não identificados na distribuição manual
                </label>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={dispatching}>
                Cancelar
              </Button>
              <Button
                onClick={handleDispatch}
                disabled={dispatching || identifiedCount === 0}
                className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Confirmar Disparo
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
