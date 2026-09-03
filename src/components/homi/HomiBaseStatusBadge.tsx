/**
 * Selo de saúde da base de conhecimento do HOMI.
 * Mostra quando o cérebro do HOMI foi reindexado pela última vez.
 * Fica âmbar quando passa de 48h (a rotina automática roda todo dia às 03:30 BRT).
 */
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBRT } from "@/lib/brtTime";

interface LinhaStatus {
  source_type: string;
  docs: number;
  chunks: number;
  ultima_atualizacao: string | null;
}

const ROTULO: Record<string, string> = {
  documento: "Método/Manual",
  material: "Hub de Materiais",
  academia: "Academia",
  script: "Scripts",
  empreendimento: "Empreendimentos",
  imovel: "Imóveis",
};

export default function HomiBaseStatusBadge() {
  const { data } = useQuery({
    queryKey: ["homi-base-status"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("homi_base_status");
      if (error) throw error;
      return (data ?? []) as LinhaStatus[];
    },
    staleTime: 60_000 * 10,
  });

  if (!data?.length) return null;

  const ultima = data
    .map((l) => l.ultima_atualizacao)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;
  if (!ultima) return null;

  const horas = (Date.now() - new Date(ultima).getTime()) / 36e5;
  const atrasada = horas > 48;
  const totalDocs = data.reduce((s, l) => s + Number(l.docs || 0), 0);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`hidden shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] sm:inline-flex ${
            atrasada
              ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
              : "border-border/60 bg-muted/40 text-muted-foreground"
          }`}
        >
          <Database className="h-3 w-3" />
          Base {horas < 24 ? "de hoje" : `há ${Math.floor(horas / 24)}d`}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="mb-1 font-medium">
          Base de conhecimento — {totalDocs} conteúdos
        </p>
        <p className="mb-1 text-xs">Atualizada em {formatBRT(ultima)}</p>
        <ul className="space-y-0.5 text-xs">
          {data.map((l) => (
            <li key={l.source_type}>
              {ROTULO[l.source_type] ?? l.source_type}: {l.docs}
            </li>
          ))}
        </ul>
        {atrasada && (
          <p className="mt-1 text-xs text-amber-500">
            Reindexação automática pode ter falhado.
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
