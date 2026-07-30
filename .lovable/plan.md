# Novo interesse atualiza o empreendimento do lead

## Problema

Quando um lead antigo volta com novo interesse (outra campanha/empreendimento), os receivers gravam apenas a observação `[NOVO INTERESSE ...]`. Os campos `empreendimento`, `campanha`, `origem_detalhe`, `formulario` continuam com os dados da entrada original.

Efeito confirmado na Fila CEO: Patrícia Zaikowski (novo interesse Terrace v3) e Janaina Lourenço (novo interesse Flow) continuam rotuladas como **Orygem** — empreendimento sem corretor alocado — e por isso caem em `sem_alocado_produto` em vez de irem para a roleta do empreendimento certo.

## O que muda

### 1. Atualizar a identificação do lead no novo interesse

Nos 4 receivers (`receive-meta-lead`, `receive-landing-lead`, `receive-rdstation-lead`, `receive-imovelweb-lead`), quando o novo touch traz um empreendimento resolvido, o update passa a incluir também:

- `empreendimento` = empreendimento do novo anúncio
- `campanha`, `campanha_id`, `origem_detalhe`, `formulario`, `form_id`, `form_name`, `plataforma` (os que a origem fornecer)
- `origem` atualizada para a origem do novo touch

Se o novo touch não resolver empreendimento (fica em "Avulso"/vazio), mantém o valor antigo — nunca sobrescreve com algo pior.

Os campos canônicos não precisam ser calculados na função: os triggers `a_resolve_empreendimento_canonico` e `trg_pl_empreendimento_canonico` já recalculam `empreendimento_canonico_id` sempre que `empreendimento`/`campanha`/`formulario` mudam.

### 2. Lead que estava em descarte

O fluxo continua: reset para Novo Lead, limpa corretor/gerente e envia para a roleta excluindo quem descartou. A diferença é que a atualização do empreendimento acontece **antes** da chamada de distribuição, então `distribuir_lead_atomico` passa a filtrar pelos corretores alocados ao empreendimento **novo**, e não mais ao original.

### 3. Histórico preservado

O texto de observação passa a ser acrescentado ao histórico (padrão `\n---\n` já usado no ImovelWeb) em vez de substituir, e passa a registrar de/para: `[NOVO INTERESSE data] Terrace v3 (Meta Ads) — antes: Orygem`. A atividade no lead e a notificação ao corretor (quando o lead está ativo) também citam o empreendimento novo.

### 4. Correção dos 2 leads já afetados

Atualizar Patrícia Zaikowski para Terrace v3 e Janaina Lourenço para Flow (empreendimento + campanha/origem_detalhe), deixando os triggers recalcularem o canônico, e reprocessar a distribuição pela roleta do empreendimento correto.

## Detalhes técnicos

- Arquivos: `supabase/functions/receive-meta-lead/index.ts`, `receive-landing-lead/index.ts`, `receive-rdstation-lead/index.ts`, `receive-imovelweb-lead/index.ts`.
- A montagem do `updatePayload` de novo interesse fica igual nos quatro (mesmos campos, rótulo de origem diferente).
- `_shared/reactivateDiscardedToRoleta.ts` não precisa mudar: recebe o lead já atualizado.
- Sem migration de schema. A correção dos 2 leads é operação de dados.

## Validação

- Reenviar um payload sintético de lead descartado com empreendimento diferente do original e conferir: `empreendimento`/`empreendimento_canonico_id` atualizados, observação com histórico, distribuição para corretor alocado ao empreendimento novo.
- Conferir na Fila CEO que a prévia deixa de mostrar "Orygem" para esses casos.
