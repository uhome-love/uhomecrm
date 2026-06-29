import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentWindowInfo,
  type JanelaId,
  type useRoleta,
} from "@/hooks/useRoleta";
import { compareRoletaSegmentos } from "@/hooks/useRoletaSegmentos";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";

type RoletaApi = ReturnType<typeof useRoleta>;

interface Props {
  roleta: RoletaApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RoletaIncluirModal({ roleta, open, onOpenChange }: Props) {
  const { segmentos, submitting, incluirManualNaFila } = roleta;
  const windowInfo = getCurrentWindowInfo();

  const [selectedCorretor, setSelectedCorretor] = useState("");
  const [selectedSegmentos, setSelectedSegmentos] = useState<string[]>([]);
  const [selectedJanela, setSelectedJanela] = useState<JanelaId>(
    windowInfo.janela === "madrugada" ? "manha" : (windowInfo.janela as JanelaId)
  );

  const { data: allCorretores = [] } = useQuery({
    queryKey: ["roleta-all-corretores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("cargo", "corretor")
        .order("nome");
      return (data || []) as { id: string; nome: string }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const segmentosOrdenados = [...segmentos].sort(compareRoletaSegmentos);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Incluir Corretor na Roleta
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Corretor</label>
            <Select value={selectedCorretor} onValueChange={setSelectedCorretor}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o corretor" />
              </SelectTrigger>
              <SelectContent>
                {allCorretores.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Janela da roleta</label>
            <Select
              value={selectedJanela}
              onValueChange={(v) => setSelectedJanela(v as JanelaId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">☀️ Manhã (07h — 12h)</SelectItem>
                <SelectItem value="tarde">🌞 Tarde (12h — 18h)</SelectItem>
                <SelectItem value="noturna">🌙 Noturna (18h — 23h30)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Janela atual detectada: <span className="font-medium">{windowInfo.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Segmentos</label>
            <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
              {segmentosOrdenados.map((s) => {
                const checked = selectedSegmentos.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 cursor-pointer text-sm hover:bg-muted/50 rounded px-1 py-0.5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedSegmentos((prev) =>
                          checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                        );
                      }}
                      className="accent-primary h-4 w-4"
                    />
                    {s.nome}
                  </label>
                );
              })}
            </div>
            {selectedSegmentos.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedSegmentos.length} segmento(s) selecionado(s)
              </p>
            )}
          </div>
          <Button
            className="w-full"
            disabled={!selectedCorretor || selectedSegmentos.length === 0 || submitting}
            onClick={async () => {
              for (const segId of selectedSegmentos) {
                await incluirManualNaFila(selectedCorretor, segId, selectedJanela);
              }
              setSelectedCorretor("");
              setSelectedSegmentos([]);
              onOpenChange(false);
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Incluir na Fila ({selectedSegmentos.length || 0})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
