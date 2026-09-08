import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePagadoriaConfig, FaixaConfig, CredorFixoConfig } from "@/hooks/usePagadoriaConfig";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function PagadoriaConfigModal({ open, onOpenChange }: Props) {
  const { corretorFaixas, gerenteFaixas, credoresFixos, saveConfig } = usePagadoriaConfig();
  const [tab, setTab] = useState("corretor");
  const [cFaixas, setCFaixas] = useState<FaixaConfig[]>([]);
  const [gFaixas, setGFaixas] = useState<FaixaConfig[]>([]);
  const [creds, setCreds] = useState<CredorFixoConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCFaixas(corretorFaixas.length ? [...corretorFaixas] : [{ vgv_max: 1500000, percentual: 30 }]);
      setGFaixas(gerenteFaixas.length ? [...gerenteFaixas] : [{ vgv_max: null, percentual: 10 }]);
      setCreds(credoresFixos.length ? [...credoresFixos] : [{ nome: "Diretoria", tipo: "diretoria", percentual: 5 }]);
    }
  }, [open, corretorFaixas, gerenteFaixas, credoresFixos]);

  const fmt = (v: number | null) => v === null ? "∞" : `R$ ${v.toLocaleString("pt-BR")}`;

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await saveConfig.mutateAsync({ tipo: "corretor", config: { faixas: cFaixas } });
      await saveConfig.mutateAsync({ tipo: "gerente", config: { faixas: gFaixas } });
      await saveConfig.mutateAsync({ tipo: "credores_fixos", config: { credores: creds } });
      toast.success("Configurações salvas!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderFaixas = (faixas: FaixaConfig[], setFaixas: (f: FaixaConfig[]) => void, label: string) => (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {faixas.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs">VGV máx (vazio = ilimitado)</Label>
            <Input
              type="number"
              value={f.vgv_max ?? ""}
              onChange={e => {
                const next = [...faixas];
                next[i] = { ...next[i], vgv_max: e.target.value ? Number(e.target.value) : null };
                setFaixas(next);
              }}
              placeholder="Ilimitado"
              className="h-8 text-sm"
            />
          </div>
          <div className="w-24">
            <Label className="text-xs">%</Label>
            <Input
              type="number"
              step="0.5"
              value={f.percentual}
              onChange={e => {
                const next = [...faixas];
                next[i] = { ...next[i], percentual: Number(e.target.value) };
                setFaixas(next);
              }}
              className="h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-4" onClick={() => setFaixas(faixas.filter((_, j) => j !== i))}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setFaixas([...faixas, { vgv_max: null, percentual: 0 }])}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar faixa
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚙️ Configurar Tabelas de Comissão</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="corretor" className="flex-1">Corretor</TabsTrigger>
            <TabsTrigger value="gerente" className="flex-1">Gerente</TabsTrigger>
            <TabsTrigger value="credores" className="flex-1">Credores Fixos</TabsTrigger>
          </TabsList>

          <TabsContent value="corretor" className="mt-4">
            {renderFaixas(cFaixas, setCFaixas, "Faixas progressivas do Corretor (VGV acumulado no mês)")}
          </TabsContent>

          <TabsContent value="gerente" className="mt-4">
            {renderFaixas(gFaixas, setGFaixas, "Faixas do Gerente")}
          </TabsContent>

          <TabsContent value="credores" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm font-medium">Credores fixos padrão (pré-preenchidos em cada nova pagadoria)</p>
              {creds.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input value={c.nome} onChange={e => { const n = [...creds]; n[i] = { ...n[i], nome: e.target.value }; setCreds(n); }} className="h-8 text-sm" placeholder="Nome" />
                  </div>
                  <div className="w-20">
                    <Input type="number" step="0.5" value={c.percentual} onChange={e => { const n = [...creds]; n[i] = { ...n[i], percentual: Number(e.target.value) }; setCreds(n); }} className="h-8 text-sm" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCreds(creds.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCreds([...creds, { nome: "", tipo: "outro", percentual: 0 }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar credor
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveAll} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar Configurações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
