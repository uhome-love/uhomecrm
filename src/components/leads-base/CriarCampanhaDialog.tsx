import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  usePreviewCampanha,
  useCriarCampanhaDaBase,
  useEmpreendimentosCanonicos,
  type BaseLeadsFiltro,
} from "@/hooks/useBaseLeads";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtroInicial: BaseLeadsFiltro;
}

function defaultExpiracao(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(23, 59, 0, 0);
  return d.toISOString().slice(0, 16);
}

export function CriarCampanhaDialog({ open, onOpenChange, filtroInicial }: Props) {
  const [nome, setNome] = useState("");
  const [limite, setLimite] = useState(300);
  const [expira, setExpira] = useState(defaultExpiracao(3));
  const [liberar, setLiberar] = useState(true);
  const [nuncaTrabalhado, setNuncaTrabalhado] = useState(true);

  const filtro: BaseLeadsFiltro = { ...filtroInicial, nunca_trabalhado: nuncaTrabalhado, busca: null };
  const { data: emps } = useEmpreendimentosCanonicos();
  const { data: preview, isLoading: loadingPreview } = usePreviewCampanha(filtro, open);
  const criar = useCriarCampanhaDaBase();

  const empNome = emps?.find((e) => e.id === filtroInicial.empreendimento_canonico_id)?.nome;

  useEffect(() => {
    if (!open) return;
    setNome(`${empNome ?? "Base Única"} · ${new Date().toLocaleDateString("pt-BR")}`);
    setExpira(defaultExpiracao(3));
  }, [open, empNome]);

  const disponivel = preview ?? 0;
  const totalCampanha = Math.min(disponivel, limite);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket size={16} /> Criar campanha de Oferta Ativa
          </DialogTitle>
          <DialogDescription>
            Libera leads da Base Única por tempo limitado. Ao expirar, os não trabalhados voltam para a base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Empreendimento</span>
              <span className="font-medium">{empNome ?? "Todos"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Leads disponíveis no filtro</span>
              <span className="font-medium">
                {loadingPreview ? "…" : disponivel.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Serão liberados</span>
              <span className="font-semibold text-primary">{totalCampanha.toLocaleString("pt-BR")}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camp-nome">Nome da campanha</Label>
            <Input id="camp-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="camp-limite">Limite de leads</Label>
              <Input
                id="camp-limite"
                type="number"
                min={1}
                max={5000}
                value={limite}
                onChange={(e) => setLimite(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-expira">Expira em</Label>
              <Input
                id="camp-expira"
                type="datetime-local"
                value={expira}
                onChange={(e) => setExpira(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={nuncaTrabalhado} onCheckedChange={(c) => setNuncaTrabalhado(!!c)} />
            Apenas leads nunca liberados em campanha
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={liberar} onCheckedChange={(c) => setLiberar(!!c)} />
            Liberar imediatamente para os corretores
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={criar.isPending || totalCampanha === 0 || !nome.trim()}
            onClick={() =>
              criar.mutate(
                {
                  nome: nome.trim(),
                  filtro,
                  expira_em: new Date(expira).toISOString(),
                  limite,
                  liberar,
                },
                { onSuccess: () => onOpenChange(false) },
              )
            }
          >
            {criar.isPending ? "Criando…" : `Criar com ${totalCampanha} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CriarCampanhaDialog;
