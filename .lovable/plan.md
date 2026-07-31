# Visitas do pipeline contam no Placar do Mutirão

## O que verifiquei agora (dados reais)

- O placar do Mutirão conta visitas **somente** pelo contador `visitas_count` do participante da sessão, que só é incrementado quando o corretor registra "visita agendada" **dentro** da tela do Mutirão.
- Hoje (31/07) existem **4 visitas marcadas no CRM** e **nenhuma** delas apareceu no placar — todos os 7 participantes da sessão ao vivo estão com 0 visitas e 0 pontos.
- A sessão de hoje está `ao_vivo` (10:00 → 23:00 BRT).
- Detalhe técnico relevante: `visitas.corretor_id` guarda o ID de login (auth), enquanto o placar usa o ID de perfil — por isso a ponte precisa converter os dois.

Resposta curta: **hoje não conta. Dá para fazer contar**, e o caminho abaixo faz isso sem mexer no fluxo do corretor.

## O que será feito

Quando **qualquer corretor** marcar uma visita no CRM (pipeline, gestão de leads, agenda — qualquer origem) enquanto houver um Mutirão ao vivo, o sistema passa a registrar automaticamente essa visita no placar:

- Conta na **meta de visitas do dia** (empresa e equipe).
- Vale **30 pontos** no ranking, igual à visita marcada dentro do mutirão.
- Dispara o **pop-up de celebração + som** no Placar TV e no Painel Ao Vivo, com nome do corretor, cliente e empreendimento.
- Corretor que não estava participando do mutirão entra automaticamente no placar (com sua equipe), com 0 ligações e a visita contabilizada.

Regras de contagem confirmadas:
- Conta pelo **dia em que a visita foi marcada** (criada hoje, horário BRT), não pela data da visita.
- Vale para **todos os corretores da empresa**, participando ou não do mutirão.
- Visitas marcadas dentro do próprio mutirão continuam contando **uma única vez** (proteção contra duplicidade).
- Se a visita for excluída/cancelada logo em seguida, o ponto não é revertido automaticamente (mesma regra de hoje).

## Detalhes técnicos

1. Migration:
   - Permitir `pipeline_lead_id` nulo em `oferta_ativa_ligacoes` (visita avulsa sem lead vinculado) e adicionar coluna `origem text default 'mutirao'`.
   - Trigger `AFTER INSERT ON public.visitas` (SECURITY DEFINER, com `EXCEPTION WHEN OTHERS` para nunca bloquear o agendamento):
     - busca sessão com `status='ao_vivo'` e `now()` dentro da janela; se não houver, sai;
     - resolve `profiles.id` a partir de `visitas.corretor_id` (auth id, com fallback para profile id);
     - dedup: se já existe `oferta_ativa_ligacoes` com `resultado='visita_agendada'` do mesmo corretor + mesmo `pipeline_lead_id` nos últimos 5 minutos, sai (é a visita criada pelo próprio mutirão);
     - `INSERT ... ON CONFLICT` em `oferta_ativa_participantes` (cria o participante se necessário, herdando gerente/equipe de `team_members`);
     - `visitas_count + 1`, `pontos + 30`, `ultima_acao_at = now()`;
     - insere linha em `oferta_ativa_ligacoes` (`resultado='visita_agendada'`, `pontos=30`, `origem='pipeline'`) — é essa linha que alimenta feed, pop-up e Placar TV;
     - insere `pulse_events` tipo `oa_visita` com `metadata.sessao_id` para o painel de Celebrações.
2. Frontend: nenhuma mudança de lógica necessária (ranking, feed e pop-up já leem dessas fontes). Único ajuste visual: etiqueta "via pipeline" no item do feed quando `origem='pipeline'`.

## Validação após o build

- Marcar uma visita de teste por fora do mutirão (lead de teste) e conferir ao vivo: contador de visitas do corretor, +30 pontos, barra da meta e pop-up no Placar TV.
- Marcar uma visita dentro do mutirão e confirmar que soma **apenas 30** (sem duplicar).
- Excluir a visita de teste ao final.
