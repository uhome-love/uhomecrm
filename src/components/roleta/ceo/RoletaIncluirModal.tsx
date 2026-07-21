import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getCurrentWindowInfo,
  type JanelaId,
  type useRoleta,
} from "@/hooks/useRoleta";
import { useEmpreendimentosCanonicos } from "@/hooks/useFocoCorretores";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Loader2, UserPlus } from "lucide-react";

type RoletaApi = ReturnType<typeof useRoleta>;

interface Props {
  roleta: RoletaApi;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CorretorOpt {
  profile_id: string;
  user_id: string;
  nome: string;
}

export function RoletaIncluirModal({ roleta, open, onOpenChange }: Props) {
  const { submitting, incluirManualNaFila } = roleta;
  const windowInfo = getCurrentWindowInfo();

  const [selectedProfile, setSelectedProfile] = useState("");
  const [selectedJanela, setSelectedJanela] = useState<JanelaId>(
    windowInfo.janela === "madrugada" ? "manha" : (windowInfo.janela as JanelaId)
  );

  const { data: allCorretores = [] } = useQuery({
    queryKey: ["roleta-all-corretores-v2"],
    queryFn: async (): Promise<CorretorOpt[]> => {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, nome")
        .eq("cargo", "corretor")
        .order("nome");
      return ((data || []) as any[])
        .filter((c) => c.user_id)
        .map((c) => ({ profile_id: c.id, user_id: c.user_id, nome: c.nome }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: empreendimentos = [] } = useEmpreendimentosCanonicos({ includeInactive: false });

  const selectedCorretor = useMemo(
    () => allCorretores.find((c) => c.profile_id === selectedProfile) || null,
    [allCorretores, selectedProfile]
  );

  // Alocação do corretor selecionado
  const { data: alocacao = [], isLoading: loadingAlocacao } = useQuery({
    queryKey: ["roleta-incluir-alocacao", selectedCorretor?.user_id],
    enabled: !!selectedCorretor?.user_id,
    queryFn: async (): Promise<string[]> => {
      const { data } = await supabase
        .from("corretor_alocacao")
        .select("empreendimentos")
        .eq("user_id", selectedCorretor!.user_id)
        .maybeSingle();
      return ((data as any)?.empreendimentos as string[]) || [];
    },
  });

  const empsAtivos = useMemo(
    () => empreendimentos.filter((e) => alocacao.includes(e.id)),
    [empreendimentos, alocacao]
  );

  const segmentosDerivados = useMemo(
    () =>
      Array.from(
        new Set(empsAtivos.map((e) => e.segmento_id).filter(Boolean) as string[])
      ),
    [empsAtivos]
  );

  useEffect(() => {
    if (!open) {
      setSelectedProfile("");
    }
  }, [open]);

  const semAlocacao = !!selectedCorretor && !loadingAlocacao && empsAtivos.length === 0;
  const podeIncluir =
    !!selectedCorretor && empsAtivos.length > 0 && segmentosDerivados.length > 0 && !submitting;

  const handleIncluir = async () => {
    if (!selectedCorretor || segmentosDerivados.length === 0) return;
    // Aproveita a lógica existente: cria/aprova credenciamento e insere na fila para cada segmento
    for (const segId of segmentosDerivados.slice(0, 2)) {
      await incluirManualNaFila(selectedCorretor.profile_id, segId, selectedJanela);
    }
    setSelectedProfile("");
    onOpenChange(false);
  };

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
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o corretor" />
              </SelectTrigger>
              <SelectContent>
                {allCorretores.map((c) => (
                  <SelectItem key={c.profile_id} value={c.profile_id}>
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

          {selectedCorretor && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                Empreendimentos alocados
              </label>
              {loadingAlocacao ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando alocação…
                </div>
              ) : semAlocacao ? (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-md p-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    Este corretor não tem empreendimentos ativos alocados.
                    Configure em <span className="font-medium">Foco Corretores</span> antes de incluí-lo na roleta.
                  </div>
                </div>
              ) : (
                <div className="border rounded-md p-2.5 space-y-1.5">
                  {empsAtivos.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{e.nome}</span>
                      {e.segmento_nome && (
                        <Badge variant="outline" className="text-[10px]">
                          {e.segmento_nome}
                        </Badge>
                      )}
                    </div>
                  ))}
                  <p className="text-[11px] text-muted-foreground pt-1 border-t">
                    O corretor receberá leads apenas destes empreendimentos.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!podeIncluir}
            onClick={handleIncluir}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Incluir na Roleta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
