import { useEffect, useState } from "react";
import { Pencil, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCampanhaEscopo, useEditarCampanha, useEscopoOpcoes } from "@/hooks/useBaseLeads";
import { PassoEscopo, type EscopoState } from "./PassoEscopo";

interface Props {
  listaId: string | null;
  onOpenChange: (v: boolean) => void;
}

/** datetime-local a partir de agora + N dias, às 23:59 (hora local BRT). */
function expiracaoEm(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(23, 59, 0, 0);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function isoParaInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function EditarCampanhaDialog({ listaId, onOpenChange }: Props) {
  const open = !!listaId;
  const { data: atual, isLoading } = useCampanhaEscopo(listaId);
  const { data: opcoes } = useEscopoOpcoes();
  const editar = useEditarCampanha();

  const [escopo, setEscopo] = useState<EscopoState>({ equipes: [], corretores: [], liberar: true });
  const [expira, setExpira] = useState("");

  useEffect(() => {
    if (!atual) return;
    setEscopo({ equipes: atual.equipes, corretores: atual.corretores, liberar: true });
    setExpira(isoParaInput(atual.expira_em));
  }, [atual]);

  const restrito = escopo.equipes.length > 0 || escopo.corretores.length > 0;
  const vencida = !!expira && new Date(expira).getTime() <= Date.now();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={16} /> Editar campanha
          </DialogTitle>
          <DialogDescription>
            {atual?.nome ? `“${atual.nome}” · ` : ""}mude quem pode ligar e o prazo. A campanha só aparece para o
            corretor enquanto o prazo estiver no futuro.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-expira">Prazo (expira em)</Label>
              <Input
                id="edit-expira"
                type="datetime-local"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[1, 3, 7].map((d) => (
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => setExpira(expiracaoEm(d))}
                  >
                    +{d} {d === 1 ? "dia" : "dias"}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={expira ? "outline" : "default"}
                  className="h-7 text-xs"
                  onClick={() => setExpira("")}
                >
                  Sem prazo
                </Button>
              </div>
              {vencida && (
                <p className="flex items-start gap-1.5 text-[11px] text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Esse prazo já passou — nenhum corretor vai ver a campanha. Estenda o prazo para reativá-la.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Quem pode ligar</Label>
              <PassoEscopo
                state={escopo}
                set={(p) => setEscopo((s) => ({ ...s, ...p }))}
                opcoes={opcoes}
                esconderLiberar
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {restrito
                ? `${escopo.equipes.length} equipe(s) e ${escopo.corretores.length} corretor(es) selecionados.`
                : "Todos os corretores vão ver esta campanha."}
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={editar.isPending || isLoading || !listaId}
            onClick={() =>
              editar.mutate(
                {
                  listaId: listaId!,
                  equipes: escopo.equipes,
                  corretores: escopo.corretores,
                  expira_em: expira ? new Date(expira).toISOString() : null,
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {editar.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditarCampanhaDialog;
