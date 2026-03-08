import { motion } from "framer-motion";
import { CheckCircle2, Circle, ArrowRight, Rocket, PartyPopper } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useOnboarding, ONBOARDING_STEPS } from "@/hooks/useOnboarding";
import { useNavigate } from "react-router-dom";

const homiMascot = "/images/homi-mascot-official.png";

export default function Onboarding() {
  const { completedSteps, completedCount, totalSteps, progress, isComplete, completeStep } = useOnboarding();
  const navigate = useNavigate();

  const phases = ["config", "actions", "week1"] as const;
  const phaseGroups = phases.map(phase => ({
    phase,
    label: ONBOARDING_STEPS.find(s => s.phase === phase)?.phaseLabel || phase,
    steps: ONBOARDING_STEPS.filter(s => s.phase === phase),
  }));

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            <img src={homiMascot} alt="Homi" className="h-12 w-12 object-contain" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground flex items-center gap-2">
              <Rocket className="h-6 w-6 text-primary" /> Onboarding
            </h1>
            <p className="text-sm text-muted-foreground">
              Seus primeiros passos no sistema. Vamos juntos! 🚀
            </p>
          </div>
        </div>
      </motion.div>

      {/* Progress bar */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">
                Configuração completa: {completedCount}/{totalSteps} etapas
              </span>
              <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                {progress}%
              </Badge>
            </div>
            <Progress value={progress} className="h-3" />
            {isComplete && (
              <div className="flex items-center gap-2 text-sm text-primary font-medium">
                <PartyPopper className="h-4 w-4" />
                Parabéns! Onboarding completo! 🎉
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Steps by phase */}
      {phaseGroups.map((group, gi) => (
        <motion.div
          key={group.phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + gi * 0.05 }}
        >
          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b border-border bg-muted/30">
                <h2 className="text-sm font-bold text-foreground">{group.label}</h2>
              </div>
              <div className="divide-y divide-border">
                {group.steps.map((step) => {
                  const done = completedSteps.includes(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-4 transition-colors ${done ? "bg-primary/5" : "hover:bg-muted/20"}`}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${done ? "text-primary line-through" : "text-foreground"}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                      {!done && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs shrink-0"
                          onClick={() => navigate(step.route)}
                        >
                          Fazer agora <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                      {!done && !step.autoDetect && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs text-muted-foreground shrink-0"
                          onClick={() => completeStep(step.id)}
                        >
                          Marcar ✓
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
