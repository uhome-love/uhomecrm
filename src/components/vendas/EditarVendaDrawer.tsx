import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Lock } from "lucide-react";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useEditarVenda } from "@/hooks/useEditarVenda";
import { EMPREENDIMENTOS } from "@/lib/empreendimentos";
import { fmtMoney } from "@/lib/fmtMoney";
import { format } from "date-fns";

export interface VendaEditavel {
  id: string;
  nome_cliente: string;
  empreendimento: string | null;
  unidade: string | null;
  vgv_final: number | null;
  vgv_estimado: number | null;
  data_assinatura: string | null;
  observacoes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: VendaEditavel | null;
  canEdit: boolean;
}

export function EditarVendaDrawer({ open, onOpenChange, venda, canEdit }: Props) {
  const editar = useEditarVenda();
  const [nome, setNome] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [unidade, setUnidade] = useState("");
  const [vgv, setVgv] = useState(0);
  const [dataAssinatura, setDataAssinatura] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!venda) return;
    setNome(venda.nome_cliente ?? "");
    setEmpreendimento(venda.empreendimento ?? "");
    setUnidade(venda.unidade ?? "");
    setVgv(Number(venda.vgv_final ?? venda.vgv_estimado ?? 0));
    setDataAssinatura(venda.data_assinatura ?? format(new Date(), "yyyy-MM-dd"));
    setObs(venda.observacoes ?? "");
  }, [venda]);

  if (!venda) return null;

  const invalid = !nome.trim() || !empreendimento.trim() || !unidade.trim() || vgv <= 0 || !dataAssinatura;

  const handleSave = async () => {
    if (!canEdit || invalid) return;
    await editar.mutateAsync({
      id: venda.id,
      nome_cliente: nome,
      empreendimento,
      unidade,
      vgv_final: vgv,
      data_assinatura: dataAssinatura,
      observacoes: obs,
      before: {
        nome_cliente: venda.nome_cliente,
        empreendimento: venda.empreendimento,
        unidade: venda.unidade,
        vgv_final: venda.vgv_final,
        vgv_estimado: venda.vgv_estimado,
        data_assinatura: venda.data_assinatura,
        observacoes: venda.observacoes ?? null,
      },
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {canEdit ? "Editar venda" : (<><Lock className="h-4 w-4" /> Detalhes da venda</>)}
          </SheetTitle>
          <SheetDescription>
            {canEdit
              ? "As alterações ficam salvas no negócio e refletem em Pipeline e PDN."
              : "Você não tem permissão para editar esta venda."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {canEdit ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ev-cliente">Cliente</Label>
                <Input id="ev-cliente" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ev-emp">Empreendimento</Label>
                <Input
                  id="ev-emp"
                  list="ev-emp-list"
                  value={empreendimento}
                  onChange={(e) => setEmpreendimento(e.target.value)}
                  maxLength={120}
                  placeholder="Ex: Botanique"
                />
                <datalist id="ev-emp-list">
                  {EMPREENDIMENTOS.map((e) => <option key={e} value={e} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ev-un">Unidade</Label>
                <Input id="ev-un" value={unidade} onChange={(e) => setUnidade(e.target.value)} maxLength={80} placeholder="Ex: Torre 2 · Apto 1203" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>VGV final</Label>
                  <MoneyInput value={vgv} onCommit={setVgv} variant="field" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-data">Data de assinatura</Label>
                  <Input id="ev-data" type="date" value={dataAssinatura} onChange={(e) => setDataAssinatura(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ev-obs">Observação (opcional)</Label>
                <Textarea id="ev-obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={4} maxLength={1000} placeholder="Contexto da venda, condições, próximos passos…" />
              </div>

              <p className="text-[11px] text-muted-foreground">
                🕒 Toda edição fica registrada no histórico do negócio (auditável).
              </p>
            </>
          ) : (
            <ReadOnlyView venda={venda} />
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? "Cancelar" : "Fechar"}
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={invalid || editar.isPending}>
              {editar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Salvar alterações
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReadOnlyView({ venda }: { venda: VendaEditavel }) {
  const rows: [string, string][] = [
    ["Cliente", venda.nome_cliente || "—"],
    ["Empreendimento", venda.empreendimento || "—"],
    ["Unidade", venda.unidade || "—"],
    ["VGV final", fmtMoney(Number(venda.vgv_final ?? venda.vgv_estimado ?? 0), "exact", { decimals: 2 })],
    ["Data assinatura", venda.data_assinatura ? format(new Date(venda.data_assinatura + "T12:00:00"), "dd/MM/yyyy") : "—"],
    ["Observação", venda.observacoes || "—"],
  ];
  return (
    <div className="space-y-2.5">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[130px_1fr] gap-2 text-sm border-b border-border/40 pb-2">
          <span className="text-muted-foreground">{k}</span>
          <span className="text-foreground font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}
