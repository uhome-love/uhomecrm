import { UserCheck, Shield, Briefcase, Users, HardHat, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileRole = "corretor" | "gestor" | "backoffice" | "rh" | "diretor" | "admin";

const PROFILES: Record<ProfileRole, { icon: any; title: string; desc: string; color: string }> = {
  corretor:   { icon: UserCheck, title: "Corretor",   desc: "Recebe leads, gerencia pipeline, agenda visitas, participa da roleta.", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  gestor:     { icon: Users,     title: "Gerente",    desc: "Gerencia um time de corretores, acompanha KPIs, PDN e presença.",       color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  backoffice: { icon: Briefcase, title: "Backoffice", desc: "Acessa pagadorias, documentação e retaguarda operacional.",             color: "text-slate-600 bg-slate-500/10 border-slate-500/30" },
  rh:         { icon: HardHat,   title: "RH",         desc: "Recrutamento, entrevistas e gestão de pessoas.",                          color: "text-pink-600 bg-pink-500/10 border-pink-500/30" },
  diretor:    { icon: Shield,    title: "Diretor",    desc: "Visão executiva sobre múltiplas equipes e diretoria.",                    color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/30" },
  admin:      { icon: Crown,     title: "CEO",        desc: "Acesso total ao CRM: usuários, configurações e todos os dados.",         color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
};

interface Props {
  value: ProfileRole;
  onChange: (r: ProfileRole) => void;
  allow: ProfileRole[];
}

export default function UserProfilePicker({ value, onChange, allow }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {allow.map((r) => {
        const p = PROFILES[r];
        const Icon = p.icon;
        const active = value === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "text-left rounded-lg border p-3 transition-all hover:border-primary/50",
              active ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border bg-card"
            )}
          >
            <div className="flex items-start gap-2.5">
              <div className={cn("p-2 rounded-md border", p.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{p.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.desc}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const ROLE_META = PROFILES;
