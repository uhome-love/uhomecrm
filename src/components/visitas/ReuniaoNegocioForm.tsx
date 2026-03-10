import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type Visita } from "@/hooks/useVisitas";
import { cn } from "@/lib/utils";

interface NegocioOption {
  id: string;
  nome_cliente: string | null;
  imovel_interesse: string | null;
  vgv_estimado: number | null;
  fase: string | null;
  corretor_id: string | null;
}

const OBJETIVO_OPTIONS = [
  { value: "negociacao", label: "🤝 Negociação" },
  { value: "fechamento", label: "🎯 Fechamento" },
  { value: "entrega_contrato", label: "📄 Entrega de contrato" },
  { value: "leitura_contrato", label: "📖 Leitura de contrato" },
  { value: "assinatura_contrato", label: "✍️ Assinatura de contrato" },
  { value: "entrega_presente", label: "🎁 Entrega de presente" },
];

const LOCAL_OPTIONS = [
  { value: "empresa", label: "🏢 Escritório / Empresa" },
  { value: "stand", label: "🏗️ Stand do empreendimento" },
  { value: "videochamada", label: "📹 Videochamada" },
  { value: "cartorio", label: "📜 Cartório" },
  { value: "outro", label: "📍 Outro" },
];

const QUICK_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Visita>) => Promise<any>;
}

export default function ReuniaoNegocioForm({ open, onClose, onSubmit }: Props) {
  const { user } = useAuth();
  const [negocios, setNegocios] = useState<NegocioOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNegocio, setSelectedNegocio] = useState<NegocioOption | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    local_visita: "",
    objetivo: "",
    data_visita: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    hora_visita: "",
    telefone: "",
    observacoes: "",
  });

  useEffect(() => {
    if (!open || !user) return;
    setSelectedNegocio(null);
    setSearchTerm("");
    setForm({
      local_visita: "",
      objetivo: "",
      data_visita: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      hora_visita: "",
      telefone: "",
      observacoes: "",
    });

    (async () => {
      const { data } = await supabase
        .from("negocios")
        .select("id, nome_cliente, imovel_interesse, vgv_estimado, fase, corretor_id")
        .not("fase", "eq", "caiu")
        .order("updated_at", { ascending: false })
        .limit(200);
      setNegocios((data || []) as NegocioOption[]);
    })();
  }, [open, user]);

  const filteredNegocios = useMemo(() => {
    if (!searchTerm.trim()) return negocios.slice(0, 15);
    const term = searchTerm.toLowerCase();
    return negocios.filter(n =>
      n.nome_cliente?.toLowerCase().includes(term) ||
      n.imovel_interesse?.toLowerCase().includes(term)
    ).slice(0, 15);
  }, [negocios, searchTerm]);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!selectedNegocio) return;
    setSubmitting(true);
    try {
      const objetivoLabel = OBJETIVO_OPTIONS.find(o => o.value === form.objetivo)?.label || form.objetivo;
      const result = await onSubmit({
        nome_cliente: selectedNegocio.cliente_nome,
        telefone: form.telefone || null,
        empreendimento: selectedNegocio.imovel || null,
        local_visita: form.local_visita || null,
        data_visita: form.data_visita,
        hora_visita: form.hora_visita || null,
        observacoes: [objetivoLabel ? `Objetivo: ${objetivoLabel}` : "", form.observacoes].filter(Boolean).join(" | ") || null,
        origem: "crm",
        tipo: "negocio" as any,
        negocio_id: selectedNegocio.id as any,
        tipo_reuniao: form.objetivo as any,
      } as any);

      if (result !== null && result !== undefined) {
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-amber-600" />
            Reunião de Negócio
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client from negocios */}
          <div>
            <Label className="text-xs font-semibold">Cliente (Negócio) *</Label>
            {selectedNegocio ? (
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 border mt-1">
                <div>
                  <p className="text-sm font-semibold">{selectedNegocio.cliente_nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[selectedNegocio.imovel, selectedNegocio.fase].filter(Boolean).join(" · ")}
                    {selectedNegocio.vgv ? ` · R$ ${(selectedNegocio.vgv / 1000).toFixed(0)}k` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => setSelectedNegocio(null)}>
                  Trocar
                </Button>
              </div>
            ) : (
              <div className="space-y-2 mt-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar negócio por cliente ou imóvel..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                {filteredNegocios.length > 0 && (
                  <div className="max-h-44 overflow-y-auto rounded-lg border bg-card shadow-md">
                    {filteredNegocios.map(n => (
                      <button
                        key={n.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0"
                        onClick={() => setSelectedNegocio(n)}
                      >
                        <span className="text-sm font-medium">{n.cliente_nome}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {[n.imovel, n.fase].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Objetivo */}
          <div>
            <Label className="text-xs font-semibold">Objetivo *</Label>
            <Select value={form.objetivo} onValueChange={v => set("objetivo", v)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Selecione o objetivo" />
              </SelectTrigger>
              <SelectContent>
                {OBJETIVO_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Local */}
          <div>
            <Label className="text-xs font-semibold">Local da Reunião</Label>
            <Select value={form.local_visita} onValueChange={v => set("local_visita", v)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Onde será a reunião?" />
              </SelectTrigger>
              <SelectContent>
                {LOCAL_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Data *</Label>
              <Input type="date" value={form.data_visita} onChange={e => set("data_visita", e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Horário</Label>
              <Input type="time" value={form.hora_visita} onChange={e => set("hora_visita", e.target.value)} className="mt-1 h-9 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set("hora_visita", t)}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                  form.hora_visita === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 text-muted-foreground border-border/60 hover:border-primary/40"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Telefone */}
          <div>
            <Label className="text-xs font-semibold">Telefone</Label>
            <Input placeholder="(XX) XXXXX-XXXX" value={form.telefone} onChange={e => set("telefone", e.target.value)} className="mt-1 h-9 text-sm" />
          </div>

          {/* Observações */}
          <div>
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea placeholder="Notas sobre a reunião..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} className="mt-1 text-sm" rows={3} />
          </div>

          {/* Submit */}
          <Button
            className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!selectedNegocio || !form.objetivo || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Agendar Reunião
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
