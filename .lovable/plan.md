# Lia · Fase 0 — Fundação (uma migration, nada mais)

Escopo desta rodada: **só a Fase 0** do documento aprovado. Uma migration aditiva + o arquivo de prompt commitado. Nenhuma edge function, nenhuma tela, nenhuma alteração em pipeline, roleta, RLS existente ou CAPI.

## O que entra

### 1. Enum próprio de etapa
`ia_etapa`: entrada, bloqueado, atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado, migrado.
Etapa fora da lista é recusada pelo banco.

### 2. Tabelas novas (todas `ia_*`, aditivas)

- **ia_leads** — o card. Dados do lead, `meta_lead_id`, `campaign_id`, `form_id` (obrigatórios desde já por causa da guarda do CAPI de 08/08), telefone normalizado + últimos 8, `etapa` (enum, default `entrada`), resultado da checagem de entrada, `pausado`, `assumido_por`, `opt_out_at`, `pipeline_lead_id` (ponteiro para quando migrar), timestamps.
- **ia_mensagens** — a conversa. `ia_lead_id`, direção, autor, conteúdo, tipo, `idempotency_key` única, timestamp de origem, status de entrega.
- **ia_eventos** — auditoria. Transição de etapa (de/para), motivo, trecho da conversa que justificou, ator.
- **ia_followups** — fila de toques. Número do toque, agendado para, status (pendente/enviado/cancelado), enviado em.
- **ia_perfil_busca** — perfis capturados.
- **ia_apresentacoes** — agendamentos: data/hora BRT, status, quem conduz, confirmações.
- **ia_midias** — peças aprovadas: rótulo, URL, gatilho que libera.
- **ia_config** — linha única (constraint `PRIMARY KEY DEFAULT true`), nascendo com `enviar_habilitado = false`, `debounce_segundos`, tetos de mensagem e mídia, segredo do webhook (+ segredo anterior para rotação), `captura_lia` (`campaign_ids` e `form_ids` **vazios**), agenda, canal de notificação.
- **ia_prompt_versoes** — registro de qual versão está ativa, desde quando, quem trocou. Só log; o cérebro nunca lê texto de prompt do banco.

### 3. Acesso
Todas as tabelas: RLS ligada, `GRANT` para `authenticated` e `service_role`, sem `anon`. Políticas restritas a **admin** (via `has_role`) e ao service_role das functions. Nada da caixa da Lia aparece para corretor ou gestor.

### 4. Prompt no repositório
Cria `supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt` com o texto do LIA-Prompt-v3.1 e uma linha inicial em `ia_prompt_versoes` apontando para ele. O arquivo é a fonte de execução.

## O que NÃO entra nesta rodada
Webhook, cron, desvio em `receive-meta-lead`/`meta-leads-backfill`, cérebro, travas, sala ao vivo, conversão CAPI, tela, RPC de migração, coluna `autor` em `whatsapp_mensagens` (essa é Fase 4).

## Notas técnicas verificadas

- `base_leads.opt_out` existe (boolean) e `meta_supressao` tem `telefone` e `telefone_last8` — o opt-out da Fase 2 usa o que já existe, sem migration nova. `base_leads` **não** tem coluna de motivo; o motivo fica registrado em `ia_eventos`, não em `base_leads`.
- `whatsapp_mensagens` hoje tem `direction` e **não** tem `autor` — confirmado que a coluna nasce na Fase 4, como o plano prevê.
- Papel de acesso: o enum `app_role` não tem `ceo`; as políticas usam `admin`.
- Limite de migrations: esta é 1 de 2 do dia em horário comercial BRT. A Fase 4 fica para outro dia.

## Condição de pronto
Migration aplicada sem erro, linter de segurança limpo para as tabelas novas, `ia_config` com exatamente uma linha e `enviar_habilitado = false`, listas de captura vazias (comportamento de ingestão idêntico ao de hoje), e o arquivo de prompt no repositório.
