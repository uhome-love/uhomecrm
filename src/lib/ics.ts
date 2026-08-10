// ─────────────────────────────────────────────────────────────────
// ics — gera um arquivo .ics (iCalendar) pra adicionar um lembrete/visita
// ao calendário do celular. Nível 1 (download); o sync por assinatura é depois.
// ─────────────────────────────────────────────────────────────────

interface EventoICS {
  titulo: string;
  descricao?: string | null;
  /** yyyy-mm-dd (BRT) */
  data: string;
  /** HH:MM (BRT) ou null = dia inteiro */
  hora?: string | null;
  local?: string | null;
  /** duração em minutos (eventos com hora). Default 30. */
  duracaoMin?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Escapa texto conforme RFC 5545 (vírgula, ponto e vírgula, barra, quebra de linha). */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function somaMinutos(data: string, hora: string, min: number): string {
  const [y, m, d] = data.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm);
  dt.setMinutes(dt.getMinutes() + min);
  return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
}

/** monta o conteúdo .ics de um evento único. */
export function montarICS(ev: EventoICS): string {
  const [y, m, d] = ev.data.split("-");
  const uid = `${ev.data.replace(/-/g, "")}-${Math.abs(hashStr(ev.titulo + ev.data + (ev.hora ?? "")))}@uhomesales`;
  // DTSTAMP fixo do dia (sem hora exata pra não depender de fuso do gerador).
  const dtstamp = `${y}${m}${d}T090000`;

  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//UhomeSales//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (ev.hora) {
    const start = `${y}${m}${d}T${ev.hora.replace(":", "")}00`;
    const end = somaMinutos(ev.data, ev.hora, ev.duracaoMin ?? 30);
    linhas.push(`DTSTART;TZID=America/Sao_Paulo:${start}`);
    linhas.push(`DTEND;TZID=America/Sao_Paulo:${end}`);
    // Alarme 30min antes
    linhas.push("BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", `DESCRIPTION:${esc(ev.titulo)}`, "END:VALARM");
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${y}${m}${d}`);
  }

  linhas.push(`SUMMARY:${esc(ev.titulo)}`);
  if (ev.descricao) linhas.push(`DESCRIPTION:${esc(ev.descricao)}`);
  if (ev.local) linhas.push(`LOCATION:${esc(ev.local)}`);
  linhas.push("END:VEVENT", "END:VCALENDAR");

  return linhas.join("\r\n");
}

/** Baixa o .ics — o celular abre o calendário pra adicionar; o desktop salva o arquivo. */
export function baixarICS(ev: EventoICS) {
  const conteudo = montarICS(ev);
  const blob = new Blob([conteudo], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.titulo.replace(/[^\w\s-]/g, "").slice(0, 40).trim() || "lembrete"}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
