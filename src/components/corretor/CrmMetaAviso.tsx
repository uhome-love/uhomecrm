/**
 * Aviso do Uhome Performance na Minha rotina: meta de saúde do CRM e,
 * quando houver bloqueio, motivo + dado atual + meta + como resolver + botão.
 */
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRoletaPerformanceStatus } from "@/hooks/useRoletaPerformanceStatus";
import { getJanelasConfig, getJanelaStatus, formatHora } from "@/components/corretor/RoletaStatusBar";

const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function CrmMetaAviso() {
  const { data } = useRoletaPerformanceStatus();
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
    // Com a regra ligada: diz se pode se credenciar agora ou qual o próximo período (horários reais).
    let extra: string | null = null;
    let podeAgora = false;
    if (gate) {
      const janelas = getJanelasConfig();
      const aberta = janelas.find((j) => getJanelaStatus(j) === "aberto");
      const proxima = janelas.find((j) => getJanelaStatus(j) === "futuro");
      if (aberta) {
        podeAgora = true;
        extra = `Você já pode se credenciar para a Roleta da ${aberta.label.toLowerCase()} (até ${formatHora(aberta.credAberto.fim)}).`;
      } else {
        extra = proxima
          ? `Você poderá participar do próximo período de credenciamento: ${proxima.label.toLowerCase()}, das ${formatHora(proxima.credAberto.inicio)} às ${formatHora(proxima.credAberto.fim)}.`
          : "Você poderá participar do próximo período de credenciamento, amanhã.";
      }
    }
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
        <p className="min-w-0 flex-1">
          <span className="font-semibold">Meta Uhome: {fmt(min)}% — Conquistada!</span>{" "}
          <span className="text-muted-foreground">
            {gate ? "Parabéns! Sua carteira está dentro do padrão Uhome. " : "Sua carteira está dentro do padrão Uhome."}
            {extra}
          </span>
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
      <p className="font-semibold">
        {gate ? "Sua Roleta está temporariamente bloqueada" : `Meta Uhome: ${fmt(min)}% de saúde do CRM`}
      </p>
      <p className="text-muted-foreground">
        Seu CRM está em <span className="font-semibold text-foreground">{fmt(crm.pct)}%</span> e o mínimo é{" "}
        <span className="font-semibold text-foreground">{fmt(min)}%</span>.{" "}
        {crm.a_atualizar ? `${crm.a_atualizar} clientes precisam de atualização. ` : ""}
        {gate
          ? `Atualize sua carteira até atingir ${fmt(min)}% para recuperar o acesso ao credenciamento.`
          : "Atualize seus clientes para conquistar o padrão Uhome."}
      </p>
      <Button size="sm" onClick={goClientes}>Atualizar meus clientes</Button>
    </div>
  );
}
