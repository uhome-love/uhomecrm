## 1. Higienização — Inativar + Arquivar 172 leads (respondeu NÃO)

Atualizar via insert tool (UPDATE em massa):
- Filtro: `stage_id = Descarte` AND `reengajamento_status = 'respondeu_nao'` (172 leads)
- Setar:
  - `ativo = false`
  - `arquivado = true`
  - `tipo_descarte = 'definitivo'` (impede reengajamento futuro)
  - `motivo_descarte = COALESCE(motivo_descarte,'') || ' [Inativado em 13/05/26: respondeu NÃO ao reengajamento]'`
  - `data_arquivamento = now()`

Efeito imediato: somem da Oferta Ativa, Nutrição, listas mensais e do cron de auto-archive 24h.

## 2. Segunda mensagem de reengajamento (2ª onda)

### 2.1 Migração — colunas em `reengajamento_config`
- `mensagem_template_2 TEXT` — placeholder texto livre (Evolution / fallback)
- `meta_template_name_2 TEXT` — nome do template Meta da 2ª onda
- `mensagens_variantes_2 TEXT[]` — variantes spintax opcional
- `wave2_min_dias_apos_wave1 INT DEFAULT 5` — janela mínima entre ondas

### 2.2 Migração — colunas em `pipeline_leads`
- `reengajamento_wave2_at TIMESTAMPTZ` — quando a 2ª foi enviada
- Permitir novos valores no `reengajamento_status`: `enviado_wave2`, `respondeu_sim_wave2`, `respondeu_nao_wave2` (campo é texto, não enum, então só convenção)

### 2.3 Edge function `reengajamento-descartados-enqueue`
- Aceitar query param `?wave=2` (default 1, mantém comportamento atual)
- Quando `wave=2`:
  - Filtro: `reengajamento_status = 'enviado'` AND `reengajamento_wave2_at IS NULL` AND `reengajamento_enviado_at < now() - wave2_min_dias_apos_wave1`
  - Excluir: `respondeu_sim`, `respondeu_nao`, `telefone_invalido`, leads já não em Descarte
  - Usa `mensagem_template_2` / `meta_template_name_2` / `mensagens_variantes_2`
  - Marca `reengajamento_wave2_at = now()` e `reengajamento_status = 'enviado_wave2'`
- Listener de respostas (`receive-evolution-webhook` / `receive-meta-webhook`) precisa interpretar SIM/NÃO de leads `enviado_wave2` e gravar `respondeu_sim_wave2` / `respondeu_nao_wave2` (mantém SIM → roleta).

### 2.4 UI — `src/components/central-nutricao/ReengajamentoTab.tsx`
- Nova seção "**2ª onda de reengajamento**" no card de configuração:
  - Campo texto "Mensagem 2 (placeholder)" → `mensagem_template_2` (vazio por padrão)
  - Campo "Template Meta 2 (nome aprovado)" → `meta_template_name_2`
  - Input "Dias mínimos após 1ª mensagem" → `wave2_min_dias_apos_wave1`
  - Botão "**Disparar 2ª onda agora**" → chama edge function com `?wave=2`
- KPI extra: "Wave 2 enviados / respondidos" (count de `enviado_wave2`, `respondeu_sim_wave2`, `respondeu_nao_wave2`)
- Aviso visual quando `mensagem_template_2` estiver vazio: "Preencha a mensagem antes de disparar".

## Ordem de execução
1. Migration (colunas em `reengajamento_config` e `pipeline_leads`)
2. Update em massa dos 172 (insert tool) — pode rodar em paralelo após migration aprovada
3. Edge function: suporte a `?wave=2` + webhooks ajustados
4. UI: card "2ª onda" + botão de disparo + KPIs

## Notas técnicas
- `reengajamento_status` é TEXT livre (não enum), então não precisa alterar tipo.
- Webhooks de resposta atuais (Meta + Evolution) detectam SIM/NÃO por keyword; só preciso ramificar a gravação conforme `wave2_at IS NULL`.
- Cron de auto-archive 24h do Descarte já exclui `ativo=false` → os 172 ficam permanentemente fora.
- Sem alteração no fluxo da 1ª onda (default `wave=1` continua funcionando idêntico).
