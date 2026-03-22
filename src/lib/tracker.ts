import { supabase } from "@/integrations/supabase/client";

// ── SESSION ID ────────────────────────────────────────

function getSessionId(): string {
  let id = sessionStorage.getItem('uhome_session');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('uhome_session', id);
  }
  return id;
}

// ── IDENTIDADE DO VISITANTE ───────────────────────────

function getIdentidade() {
  return {
    session_id: getSessionId(),
    email:      localStorage.getItem('uhome_email') ?? null,
    telefone:   localStorage.getItem('uhome_telefone') ?? null,
    user_id:    localStorage.getItem('uhome_user_id') ?? null,
  };
}

export function identificarVisitante(dados: {
  email?: string;
  telefone?: string;
  user_id?: string;
}) {
  if (dados.email)    localStorage.setItem('uhome_email', dados.email);
  if (dados.telefone) localStorage.setItem('uhome_telefone', dados.telefone);
  if (dados.user_id)  localStorage.setItem('uhome_user_id', dados.user_id);
  flushFila();
}

// ── FILA DE EVENTOS (antes de se identificar) ─────────

async function flushFila() {
  const fila = JSON.parse(sessionStorage.getItem('uhome_fila') ?? '[]');
  if (fila.length === 0) return;
  sessionStorage.removeItem('uhome_fila');
  for (const item of fila) {
    await enviarEvento(item.tipo, item.dados);
  }
}

// ── ENVIO DO EVENTO ───────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
async function enviarEvento(tipo: string, dados: Record<string, any> = {}) {
  const identidade = getIdentidade();
  const params = new URLSearchParams(window.location.search);

  try {
    await supabase.functions.invoke('site-events', {
      body: {
        tipo,
        dados,
        identidade,
        pagina:       window.location.pathname,
        timestamp:    new Date().toISOString(),
        utm_source:   params.get('utm_source'),
        utm_medium:   params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      },
    });
  } catch (err) {
    console.warn('[Tracker] Falha:', err);
  }
}

// ── EVENTO GENÉRICO ───────────────────────────────────

export async function trackEvento(tipo: string, dados: Record<string, any> = {}) {
  const identidade = getIdentidade();
  const temIdentidade = identidade.email || identidade.telefone || identidade.user_id;

  if (!temIdentidade) {
    const fila = JSON.parse(sessionStorage.getItem('uhome_fila') ?? '[]');
    fila.push({ tipo, dados, timestamp: new Date().toISOString() });
    sessionStorage.setItem('uhome_fila', JSON.stringify(fila.slice(-20)));
    return;
  }

  await enviarEvento(tipo, dados);
}

// ── EVENTOS ESPECÍFICOS ───────────────────────────────

export const track = {
  visitouImovel: (imovel: any) =>
    trackEvento('visitou_imovel', {
      imovel_id:     imovel.id,
      imovel_slug:   imovel.slug,
      imovel_titulo: imovel.titulo,
      imovel_bairro: imovel.bairro,
      imovel_preco:  imovel.preco,
      imovel_codigo: imovel.jetimob_id ?? imovel.codigo,
    }),

  enviouLead: (lead: any) => {
    identificarVisitante({ email: lead.email, telefone: lead.telefone });
    return trackEvento('enviou_lead', lead);
  },

  agendouVisita: (ag: any) => {
    identificarVisitante({ telefone: ag.telefone });
    return trackEvento('agendou_visita', ag);
  },

  cadastrou: (user: any) => {
    identificarVisitante({ email: user.email, user_id: user.id });
    return trackEvento('cadastrou', { nome: user.nome, email: user.email });
  },

  logou: (user: any) => {
    identificarVisitante({ email: user.email, user_id: user.id });
    return trackEvento('logou', { email: user.email });
  },

  favoritou: (imovel: any) =>
    trackEvento('favoritou_imovel', {
      imovel_id:     imovel.id,
      imovel_titulo: imovel.titulo,
      imovel_preco:  imovel.preco,
      imovel_bairro: imovel.bairro,
      imovel_codigo: imovel.jetimob_id ?? imovel.codigo,
    }),

  buscouIA: (query: string, filtros: any) =>
    trackEvento('buscou_ia', { query, filtros }),

  salvouBusca: (filtros: any) =>
    trackEvento('salvou_busca', { filtros }),

  clicouWhatsapp: (contexto: string) =>
    trackEvento('clicou_whatsapp', { contexto }),
};
