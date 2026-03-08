import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";

export default function OnboardingWidget() {
  const { showOnboarding, completedCount, totalSteps, progress } = useOnboarding();
  const navigate = useNavigate();

  if (!showOnboarding) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              🎯 Onboarding: {completedCount}/{totalSteps} etapas
            </p>
            <Progress value={progress} className="h-2 mt-1.5" />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0"
            onClick={() => navigate("/onboarding")}
          >
            Ver progresso
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
