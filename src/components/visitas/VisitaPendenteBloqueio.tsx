import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useVisitas } from "@/hooks/useVisitas";
import { useQueryClient } from "@tanstack/react-query";
import VisitaResultadoDialog from "@/components/visitas/VisitaResultadoDialog";
import { registrarResultadoVisita } from "@/lib/registrarResultadoVisita";

const HORAS_TOLERANCIA = 2;
const DIAS_JANELA = 7;

function brtDate(offsetDays = 0): string {
  const d = new Date(Date.now() - 3 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Bloqueia a tela do corretor enquanto houver visita dele "marcada" cujo horário
 * passou há mais de 2h (BRT). Só sai registrando o resultado com feedback.
 */
export default function VisitaPendenteBloqueio() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const range = useMemo(() => ({ start: brtDate(-DIAS_JANELA), end: brtDate(0) }), [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const { visitas, updateVisita, updateStatus } = useVisitas({
    corretorId: user?.id,
    status: "marcada",
    startDate: range.start,
    endDate: range.end,
  });

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 5 * 60_000);
    const onFocus = () => { tick(); qc.invalidateQueries({ queryKey: ["visitas"] }); };
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(id); window.removeEventListener("focus", onFocus); };
  }, [qc]);

  const pendentes = useMemo(() => {
    if (!user?.id) return [];
    return visitas
      .filter((v) => v.corretor_id === user.id && v.status === "marcada" && ((v as { tipo?: string }).tipo || "lead") === "lead")
      .filter((v) => {
        const hora = (v.hora_visita || "23:59").slice(0, 5);
        const t = new Date(`${v.data_visita}T${hora}:00-03:00`).getTime();
        return t + HORAS_TOLERANCIA * 3600_000 < now;
      })
      .sort((a, b) => `${a.data_visita}${a.hora_visita}`.localeCompare(`${b.data_visita}${b.hora_visita}`));
  }, [visitas, user?.id, now]);

  const atual = pendentes[0];
  if (!atual) return null;

  const [y, m, d] = atual.data_visita.split("-");
  const quando = atual.data_visita === brtDate(0) ? "hoje" : `${d}/${m}`;
  const subtitulo = `${atual.empreendimento || "Visita"} · ${quando} ${(atual.hora_visita || "").slice(0, 5)}${pendentes.length > 1 ? ` · 1 de ${pendentes.length}` : ""} — registre o feedback para continuar usando o CRM.`;

  return (
    <VisitaResultadoDialog
      key={atual.id}
      open
      blocking
      onClose={() => { /* bloqueado: só fecha registrando */ }}
      nomeCliente={atual.nome_cliente}
      subtitulo={subtitulo}
      onSubmit={async (resultado, obs, feedback) => {
        await registrarResultadoVisita(atual, resultado, obs, feedback, { updateVisita, updateStatus, userId: user?.id });
        await qc.invalidateQueries({ queryKey: ["visitas"] });
      }}
    />
  );
}
