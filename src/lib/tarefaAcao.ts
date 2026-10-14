// Texto da ação de uma tarefa (o que fazer), sem repetir "Próximo contato" nem o nome do cliente.
// Mesma lógica replicada em supabase/functions/tarefa-aviso-horario/index.ts.
const POR_TIPO: Record<string, string> = {
  ligacao: "Ligar para o cliente",
  ligar: "Ligar para o cliente",
  whatsapp: "Mandar WhatsApp",
  follow_up: "Fazer follow-up",
};

export function acaoDaTarefa(tipo: string | null, titulo: string | null, nomeLead?: string | null): string {
  if (tipo && POR_TIPO[tipo]) return POR_TIPO[tipo];
  let t = (titulo || "").split(" — ")[0].trim();
  t = t.replace(/^pr[oó]ximo contato\s*:?\s*/i, "").trim();
  if (nomeLead) {
    const n = nomeLead.trim().toLowerCase();
    const partes = t.split(":").map((p) => p.trim());
    if (partes.length > 1 && n.startsWith(partes[partes.length - 1].toLowerCase())) t = partes.slice(0, -1).join(": ");
    if (t.toLowerCase() === n || (t && n.startsWith(t.toLowerCase()))) t = "";
  }
  return t || "Fazer contato com o cliente";
}
