import { motion } from "framer-motion";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface LeadsSemTarefaCardProps {
  count: number;
  onOpenFoco: () => void;
}

/**
 * Card destacado no Home do corretor: leads ativos sem nenhuma
 * tarefa pendente/agendada. CTA abre o Modo Foco direto com o
 * critério "no_next_step" (Sem direção) pré-selecionado.
 *
 * Renderiza apenas quando count > 0 (caller controla).
 */
export default function LeadsSemTarefaCard({ count, onOpenFoco }: LeadsSemTarefaCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
      <Card className="border-l-4 border-l-amber-400 bg-amber-50/60 dark:bg-amber-500/10">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-500/20">
            <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-700 dark:text-amber-300 leading-none">{count}</span>
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                Lead{count === 1 ? "" : "s"} sem tarefa
              </span>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
              Lead{count === 1 ? "" : "s"} ativo{count === 1 ? "" : "s"} sem próxima ação agendada. Adicione uma tarefa para retomar o contato.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1 bg-amber-500 hover:bg-amber-600 text-white shrink-0"
            onClick={onOpenFoco}
          >
            Ver no Modo Foco
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
