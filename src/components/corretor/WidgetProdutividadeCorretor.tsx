// =============================================================================
// WidgetProdutividadeCorretor — Widget motivacional para o corretor.
// Correlaciona presenças, leads recebidos e negócios fechados no período.
// =============================================================================
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, Sparkles, TrendingUp, Users, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useMyProfileId, useWidgetCorretorSemana, type PeriodoWidget } from "@/hooks/useWidgetCorretorSemana";

export default function WidgetProdutividadeCorretor() {
  const [periodo, setPeriodo] = useState<PeriodoWidget>("semana");
  const { data: profileId } = useMyProfileId();
  const { data, isLoading } = useWidgetCorretorSemana(profileId, periodo);

  const presencas = data?.presencas ?? 0;
  const leads = data?.leads_recebidos ?? 0;
  const negocios = data?.negocios_fechados ?? 0;

  const mensagem = deriveMensagem(presencas, leads, negocios, periodo);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 text-primary p-1.5">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Sua presença faz diferença
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Presença × Leads × Negócios
            </p>
          </div>
        </div>
        <div className="flex rounded-lg bg-muted/40 p-0.5 text-[11px]">
          <button
            onClick={() => setPeriodo("semana")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition",
              periodo === "semana"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriodo("mes")}
            className={cn(
              "px-2.5 py-1 rounded-md font-medium transition",
              periodo === "mes"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Mês
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatBlock
              icon={<CalendarCheck className="h-4 w-4" />}
              label="Presenças"
              value={presencas}
              tone="primary"
            />
            <StatBlock
              icon={<Users className="h-4 w-4" />}
              label="Leads recebidos"
              value={leads}
              tone="info"
            />
            <StatBlock
              icon={<Trophy className="h-4 w-4" />}
              label="Negócios"
              value={negocios}
              tone="success"
            />
          </div>
          <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 flex items-start gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-foreground leading-snug">{mensagem}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}

function StatBlock({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "info" | "success";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    success: "bg-success-500/10 text-success-700",
  }[tone];
  return (
    <div className={cn("rounded-lg px-3 py-2.5", toneClass)}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function deriveMensagem(
  presencas: number,
  leads: number,
  negocios: number,
  periodo: PeriodoWidget,
): string {
  const label = periodo === "semana" ? "esta semana" : "este mês";
  if (presencas === 0) {
    return `Você ainda não teve presença registrada ${label}. Estar na empresa é o primeiro passo pra receber lead novo.`;
  }
  if (negocios > 0) {
    return `${negocios} negócio${negocios > 1 ? "s" : ""} fechado${negocios > 1 ? "s" : ""} ${label} com ${presencas} presença${presencas > 1 ? "s" : ""}. Consistência gera resultado — continua assim!`;
  }
  if (leads > 0) {
    return `${leads} lead${leads > 1 ? "s" : ""} nas suas mãos com ${presencas} presença${presencas > 1 ? "s" : ""} ${label}. Foco no follow-up transforma isso em venda.`;
  }
  return `${presencas} presença${presencas > 1 ? "s" : ""} ${label} — a próxima roleta pode ser sua. Confirma seu credenciamento pra maximizar leads.`;
}
