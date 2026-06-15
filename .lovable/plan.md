# Reengajamento: roteamento de respostas (Fila do CEO + inativação limpa)

## Objetivo
Quando um lead que recebeu um disparo (ex: template `casatua_junho25k`) responder:

- **Positivo** — botão "Quero informações" ou texto tipo "quero informações", "sim", "tenho interesse":
  → **Reativar** o lead e **enviar SEMPRE para a Fila do CEO** (nunca distribuir automático pela roleta), com **registro no histórico de que é um lead reengajado pelo template** (nome do template).
- **Negativo** — botão "Não tenho interesse, obrigado" ou texto "não quero mais", "não tenho interesse":
  → Transformar o lead em **inativo (descarte definitivo + arquivado)** e **removê-lo da lista de descartados** para limpar a base.

## Situação atual (já existe)
O webhook `whatsapp-webhook` já:
- Casa a resposta ao disparo via `wamid` em `reengajamento_meta_disparos`.
- Classifica SIM/NÃO por botão ou texto (já cobre "quero" e "não tenho interesse").
- No SIM (origem descartados/oferta ativa) chama `reativar_lead_nutricao_manual`, que hoje **manda para a roleta** (`distribuir_lead_atomico`) — precisa mudar para Fila do CEO.
- No NÃO já marca descarte definitivo, mas **não arquiva** (não some 100% da lista de descartados).

A audiência de "descartados" já exclui `tipo_descarte = definitivo`, `reengajamento_status = respondeu_nao*` e `arquivado = true`.

## Mudanças

### 1. Nova função no banco (migration)
Criar `public.reativar_lead_para_fila_ceo(p_lead_id uuid, p_template_name text)`:
- Faz o mesmo que `reativar_lead_nutricao_manual` (cancela parcerias/tarefas pendentes, move para stage "Novo Lead", limpa descarte/arquivado, `reativado_por_nutricao = true`, `reengajamento_status = 'respondeu_sim'`).
- Define `corretor_id = NULL` e `aceite_status = 'pendente_distribuicao'` — é exatamente o critério da Fila do CEO.
- **NÃO** chama `distribuir_lead_atomico` (o lead permanece na Fila do CEO, conforme regra "Fila CEO Manual Only").
- Registra em `pipeline_historico` e `observacoes` que o lead foi **reengajado pelo template `<p_template_name>`** e enviado para a Fila do CEO.
- `SECURITY DEFINER`, `search_path = public`, com GRANT execute para `service_role`/`authenticated`.

### 2. Edge function `whatsapp-webhook`
- No bloco de resposta positiva (`buttonResp === "sim"` com origem `descartados`/`oferta_ativa_lista`/`legacy`): trocar a chamada de `reativarLeadNutricao` por `reativar_lead_para_fila_ceo`, passando `metaDispatch.template_name`.
- Registrar `pipeline_atividades` com título indicando "🔥 Reengajado pelo template `<template>` → Fila do CEO".
- (Opcional) Criar `notifications` para admins/CEO avisando novo lead reengajado na fila.
- No bloco de resposta negativa (`buttonResp === "nao"`): além do que já faz, definir `arquivado = true` para **remover definitivamente da lista de descartados** (regra "Inativar = permanent hide"), mantendo o carimbo de motivo e o registro de histórico.
- Garantir que a detecção positiva/negativa continue cobrindo os textos/botões citados (já coberto pelos regex atuais — validar).

### 3. Validação
- Deploy das funções.
- Simular payloads de webhook (botão "Quero informações" e botão "Não tenho interesse, obrigado") via `supabase--curl_edge_functions` apontando para `wamid` de teste em `reengajamento_meta_disparos`.
- Conferir no banco: lead positivo aparece na Fila do CEO (`corretor_id IS NULL` + `aceite_status='pendente_distribuicao'`) com histórico do template; lead negativo fica `tipo_descarte='definitivo'`, `arquivado=true` e some da audiência de descartados.

## Detalhes técnicos
- Fila do CEO = `pipeline_leads` com `corretor_id IS NULL` e `aceite_status = 'pendente_distribuicao'` (usado por `PendingLeadsPanel`/`FilaCeoDispatchModal`).
- Stage "Novo Lead": `d3843b2f-2fa1-4c31-9129-4eb0ed21f019`. Stage "Descarte": `1dd66c25-3848-4053-9f66-82e902989b4d`.
- Sem alteração de UI da Central de Disparos; mudança é no roteamento de respostas (backend).
