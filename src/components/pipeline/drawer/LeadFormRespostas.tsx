import { MessageCircleQuestion } from "lucide-react";

export interface FormResposta {
  pergunta: string;
  resposta: string;
}

interface LeadFormRespostasProps {
  respostas: unknown;
  formulario?: string | null;
}

function parse(raw: unknown): FormResposta[] {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(value)) return [];
    return value
      .map((r: any) => ({
        pergunta: String(r?.pergunta ?? r?.question ?? "").trim(),
        resposta: String(r?.resposta ?? r?.answer ?? "").trim(),
      }))
      .filter((r) => r.pergunta && r.resposta);
  } catch {
    return [];
  }
}

/**
 * Respostas do formulário do anúncio (Meta/landing).
 * Genérico: cada empreendimento tem as suas próprias perguntas.
 */
export function LeadFormRespostas({ respostas, formulario }: LeadFormRespostasProps) {
  const itens = parse(respostas);
  if (itens.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <MessageCircleQuestion className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-primary">
          Respostas do formulário
        </span>
        {formulario && (
          <span className="text-[10px] text-muted-foreground truncate">· {formulario}</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {itens.map((item, i) => (
          <li key={`${item.pergunta}-${i}`} className="min-w-0">
            <p className="text-[11px] text-muted-foreground leading-snug break-words">
              {item.pergunta}
            </p>
            <p className="text-[12px] font-semibold text-foreground leading-snug break-words">
              {item.resposta}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LeadFormRespostas;
