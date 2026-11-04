export type EnvioProgramado = { limite_dia: number; espera_horas: number; inicio: string; fim: string; dias: number[] };
export const PROPOSTA_ENVIO: EnvioProgramado = { limite_dia:100, espera_horas:24, inicio:"09:00", fim:"20:00", dias:[1,2,3,4,5,6] };
export function validarEnvio(c: EnvioProgramado): string | null {
  if (!Number.isInteger(c.limite_dia) || c.limite_dia<1 || c.limite_dia>100) return "O piloto permite de 1 a 100 contatos por dia.";
  if (!Number.isInteger(c.espera_horas) || c.espera_horas<24 || c.espera_horas>2160) return "A espera após o descarte deve ser de pelo menos 24 horas.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(c.inicio) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.fim) || c.inicio>=c.fim) return "Informe um horário de início anterior ao fim.";
  if (!Array.isArray(c.dias) || !c.dias.length || c.dias.some(d=>!Number.isInteger(d)||d<0||d>6)) return "Selecione pelo menos um dia válido.";
  return null;
}
export function dentroJanelaEnvio(c: EnvioProgramado, now: Date): boolean {
  if (validarEnvio(c)) return false;
  const brt=new Date(now.getTime()-3*3600000);
  const hora=`${String(brt.getUTCHours()).padStart(2,"0")}:${String(brt.getUTCMinutes()).padStart(2,"0")}`;
  return c.dias.includes(brt.getUTCDay()) && hora>=c.inicio && hora<c.fim;
}