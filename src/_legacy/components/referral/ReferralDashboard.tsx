import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, Copy, Users, TrendingUp, DollarSign, Plus, ExternalLink, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Referral {
  id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  codigo_unico: string;
  total_indicacoes: number;
  indicacoes_convertidas: number;
  premiacao_acumulada: number;
  ativo: boolean;
  created_at: string;
}

export default function ReferralDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [creating, setCreating] = useState(false);

  const { data: referrals = [], isLoading } = useQuery({
    queryKey: ["referrals", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as Referral[];
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      const { data: leads } = await supabase
        .from("referral_leads")
        .select("id, referral_id, convertido, created_at");
      const { data: rewards } = await supabase
        .from("referral_rewards")
        .select("id, valor, status");

      const totalLeads = leads?.length || 0;
      const convertidos = leads?.filter(l => l.convertido).length || 0;
      const pendentesReward = rewards?.filter(r => r.status === "pendente").length || 0;
      const totalPremiacoes = rewards?.reduce((sum, r) => sum + Number(r.valor || 0), 0) || 0;

      return { totalLeads, convertidos, pendentesReward, totalPremiacoes };
    },
    enabled: !!user,
  });

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  };

  const handleCreate = useCallback(async () => {
    if (!user || !nome.trim()) return;
    setCreating(true);
    const codigo = generateCode();
    const { error } = await supabase.from("referrals").insert({
      cliente_nome: nome.trim(),
      cliente_telefone: telefone.trim() || null,
      codigo_unico: codigo,
      created_by: user.id,
      corretor_id: user.id,
    });
    if (error) {
      toast.error("Erro ao criar indicação");
    } else {
      toast.success("Código de indicação criado!");
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      setCreateOpen(false);
      setNome("");
      setTelefone("");
    }
    setCreating(false);
  }, [user, nome, telefone, queryClient]);

  const copyLink = (codigo: string) => {
    const link = `${window.location.origin}/indica/${codigo}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Indicações", value: referrals.length, icon: Users, color: "text-primary" },
          { label: "Leads gerados", value: stats?.totalLeads || 0, icon: TrendingUp, color: "text-emerald-500" },
          { label: "Convertidos", value: stats?.convertidos || 0, icon: CheckCircle2, color: "text-green-500" },
          { label: "Premiações", value: `R$${(stats?.totalPremiacoes || 0).toLocaleString("pt-BR")}`, icon: DollarSign, color: "text-amber-500" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header + Add */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-foreground flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" /> Programa de Indicações
        </h2>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Código
        </Button>
      </div>

      {/* Referrals list */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : referrals.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-3 text-primary/30" />
            <p className="font-medium">Nenhuma indicação criada ainda</p>
            <p className="text-xs mt-1">Crie um código para um cliente e compartilhe o link</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {referrals.map(r => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{r.cliente_nome}</p>
                      <Badge variant={r.ativo ? "default" : "secondary"} className="text-[10px]">
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {r.cliente_telefone && (
                      <p className="text-xs text-muted-foreground">{r.cliente_telefone}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{r.total_indicacoes}</p>
                      <p>indicações</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-emerald-500">{r.indicacoes_convertidas}</p>
                      <p>convertidas</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-500">R${Number(r.premiacao_acumulada).toLocaleString("pt-BR")}</p>
                      <p>prêmio</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{r.codigo_unico}</Badge>
                    <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => copyLink(r.codigo_unico)}>
                      <Copy className="h-3 w-3" /> Copiar link
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar código de indicação</DialogTitle>
            <DialogDescription>Gere um link exclusivo para o cliente indicar conhecidos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do cliente *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !nome.trim()}>
              {creating ? "Criando..." : "Criar código"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
