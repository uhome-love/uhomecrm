/**
 * Aviso do Uhome Performance na Minha rotina. Estados da Roleta:
 * "Pode se credenciar", "Já credenciado neste turno", "Fora do horário" e "Bloqueado".
 * Credenciamento é sempre manual — nada aqui inscreve o corretor.
 */
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Info, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import { getJanelasConfig, getJanelaStatus, formatHora } from "@/components/corretor/RoletaStatusBar";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Turno de recebimento em andamento agora (BRT), no formato do banco. */
function turnoAtualDb(): string | null {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", weekday: "short" }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value) + Number(parts.find((p) => p.type === "minute")?.value) / 60;
  if (parts.find((p) => p.type === "weekday")?.value === "Sun") return h >= 8 ? "dia_todo" : null;
  if (h >= 7 && h < 12) return "manha";
  if (h >= 12 && h < 18) return "tarde";
  if (h >= 18 && h < 23.5) return "noturna";
  return null;
}

function useCredenciadoTurno() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["crm-aviso-credenciado", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<boolean> => {
      const turno = turnoAtualDb();
      if (!turno) return false;
      const { data: prof } = await supabase.from("profiles").select("id").eq("user_id", user!.id).maybeSingle();
      if (!prof?.id) return false;
      const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const { count } = await supabase
        .from("roleta_credenciamentos")
        .select("id", { count: "exact", head: true })
        .eq("corretor_id", prof.id)
        .eq("data", hoje)
        .eq("janela", turno)
        .in("status", ["aprovado", "pendente"]);
      return (count ?? 0) > 0;
    },
  });
}

export default function CrmMetaAviso() {
  const { data } = useRoletaPerformanceStatus();
  const { data: credenciado } = useCredenciadoTurno();
  const navigate = useNavigate();
  if (!data) return null;

  const { crm, crm_minimo_pct: min, crm_gate_ativo: gate, crm_atende } = data;
  const goClientes = () => navigate("/pipeline-leads?filtro=atrasado");

  if (crm.estado !== "calculado" || crm.pct == null) {
    if (crm.estado !== "dados_insuficientes") return null;
    return (
      <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-muted-foreground">
          Seus clientes ativos estão parados. Atualize-os para gerar seu percentual de saúde do CRM.
        </p>
      </div>
    );
  }

  if (crm_atende) {
    let titulo = `Meta Uhome: ${fmt(min)}% — Conquistada!`;
    let extra: string | null = null;
    let podeAgora = false;
    let Icone = CheckCircle2;
    if (gate) {
      const janelas = getJanelasConfig();
      const aberta = janelas.find((j) => getJanelaStatus(j) === "aberto");
      const proxima = janelas.find((j) => getJanelaStatus(j) === "futuro");
      if (credenciado) {
        titulo = "Já credenciado neste turno";
        extra = "Sua carteira está dentro do padrão Uhome e você está recebendo leads.";
      } else if (aberta) {
        titulo = "Pode se credenciar";
        podeAgora = true;
        extra = `Sua carteira está dentro do padrão Uhome. Credencie-se para a Roleta da ${aberta.label.toLowerCase()} até ${formatHora(aberta.credAberto.fim)}.`;
      } else {
        titulo = "Fora do horário de credenciamento";
        Icone = Clock;
        extra = proxima
          ? `Sua carteira está dentro do padrão Uhome. Próximo período: ${proxima.label.toLowerCase()}, das ${formatHora(proxima.credAberto.inicio)} às ${formatHora(proxima.credAberto.fim)}.`
          : "Sua carteira está dentro do padrão Uhome. Próximo período de credenciamento: amanhã.";
      }
    } else {
      extra = "Sua carteira está dentro do padrão Uhome.";
    }
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <Icone className="h-4 w-4 shrink-0 text-success-600" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">{titulo}</span>{" "}
          <span className="text-muted-foreground">{extra}</span>
        </p>
        {podeAgora && (
          <Button size="sm" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Credenciar agora
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold">
        {gate && <Lock className="h-4 w-4" />}
        {gate ? "Bloqueado — sua Roleta está temporariamente bloqueada" : `Meta Uhome: ${fmt(min)}% de saúde do CRM`}
      </p>
      <p className="text-muted-foreground">
        Seu CRM está em <span className="font-semibold text-foreground">{fmt(crm.pct)}%</span> e o mínimo é{" "}
        <span className="font-semibold text-foreground">{fmt(min)}%</span>.{" "}
        {crm.a_atualizar ? `${crm.a_atualizar} clientes precisam de atualização. ` : ""}
        {gate
          ? credenciado
            ? `Você está credenciado, mas não recebe leads até voltar a ${fmt(min)}%. Ao recuperar, volta a receber neste turno sem novo credenciamento.`
            : `Ao atingir ${fmt(min)}%, você poderá se credenciar manualmente no horário disponível.`
          : "Atualize seus clientes para conquistar o padrão Uhome."}
      </p>
      <Button size="sm" onClick={goClientes}>Atualizar meus clientes</Button>
    </div>
  );
}
