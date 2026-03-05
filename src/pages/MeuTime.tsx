import TeamManagement from "@/components/checkpoint/TeamManagement";

export default function MeuTime() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Meu <span className="text-primary">Time</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os corretores da sua equipe
        </p>
      </div>
      <TeamManagement />
    </div>
  );
}
