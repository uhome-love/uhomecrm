import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ReferralAdminConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["referral-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("referral_config")
        .select("*")
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const [tipo, setTipo] = useState("");
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [regra, setRegra] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync state when config loads
  const tipoVal = tipo || config?.tipo_premiacao || "cashback";
  const valorVal = valor || String(config?.valor_premiacao || 500);
  const descricaoVal = descricao || config?.descricao_premiacao || "";
  const regraVal = regra || config?.regra_conversao || "apos_assinatura";

  const handleSave = async () => {
    if (!config?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("referral_config")
      .update({
        tipo_premiacao: tipoVal,
        valor_premiacao: Number(valorVal) || 0,
        descricao_premiacao: descricaoVal,
        regra_conversao: regraVal,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", config.id);

    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Configuração salva!");
      queryClient.invalidateQueries({ queryKey: ["referral-config"] });
    }
    setSaving(false);
  };

  if (isLoading) return <p className="text-muted-foreground text-sm p-4">Carregando...</p>;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h3 className="font-display font-bold text-foreground">Configuração de Indicações</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de premiação</Label>
            <Select value={tipoVal} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cashback">Cashback (R$)</SelectItem>
                <SelectItem value="desconto">Desconto</SelectItem>
                <SelectItem value="brinde">Brinde</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor da premiação (R$)</Label>
            <Input type="number" value={valorVal} onChange={e => setValor(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Descrição da premiação</Label>
            <Input value={descricaoVal} onChange={e => setDescricao(e.target.value)} placeholder="Ex: R$500 em cashback" />
          </div>

          <div className="space-y-2">
            <Label>Regra de conversão</Label>
            <Select value={regraVal} onValueChange={setRegra}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="apos_assinatura">Após assinatura do contrato</SelectItem>
                <SelectItem value="apos_entrada">Após pagamento da entrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar configuração"}
        </Button>
      </CardContent>
    </Card>
  );
}
