# Unificar Sem Contato + Redistribuição em Leads Estagnados

## Objetivo
Hoje existem dois mecanismos competindo para leads parados na etapa **Sem Contato**:
- **Reciclagem 72h → Fila CEO "Redistribuição"** (`reciclar_leads_sem_contato` + aba/botão na UI)
- **Cadência T1–T7 → descarte automático reengajável** (após aviso da 7ª tentativa + 24h)

Vamos unificar tudo na **Central de Leads Estagnados**: ao esgotar a cadência (T7 + prazo vencido), o lead vira **estagnado** na própria etapa Sem Contato e aparece na central para o gestor/CEO decidir (repassar / roleta / descartar). O fluxo antigo de Redistribuição 72h é removido por completo.

---

## 1. Backend — T7 passa a estagnar (não descartar)

Substituir a função `cadencia_sc_descartar_reengajavel(lead_id)`: em vez de mover o lead para a etapa **Descarte**, ela passa a:
- Marcar `estagnado = true`, `estagnado_em = now()` (mantém o lead na etapa **Sem Contato**, mantém o corretor atual).
- Registrar histórico e atividade ("Estagnado — cadência Sem Contato esgotada (T7 sem retorno)").
- Encerrar a cadência (`lead_cadencia_sem_contato.status = 'concluida'`).
- Notificar gestor/CEO/diretor (categoria `lead_estagnado`) apontando para a Central de Leads Estagnados.

A seção A de `processar_cadencia_sem_contato` (que detecta o vencimento do prazo de 24h e dispara `do_descarte`) continua igual — só muda o efeito final na função acima. O texto retornado ao `lead-escalation` passa de "descartado" para "estagnado".

## 2. Backend — Central passa a enxergar Sem Contato estagnado

`get_pipeline_estagnacao` hoje faz `JOIN pipeline_estagnacao_config` (só Busca, Contato Iniciado, Aquecimento), então um lead estagnado em **Sem Contato** não apareceria.
- Trocar o `JOIN` por `LEFT JOIN` na config, com `dias_limite` padrão de fallback.
- Garantir no `WHERE` que **qualquer** lead com `estagnado = true` apareça, mesmo fora dos estágios configurados.

`decidir_lead_estagnado` (repassar / roleta / descartar) já cobre o destino — sem alteração de lógica, apenas validar que funciona para leads na etapa Sem Contato.

## 3. Backend — Remover o fluxo de Redistribuição 72h

- **Parar a reciclagem 72h**: remover a chamada a `reciclar_leads_sem_contato` na edge function `lead-escalation` (bloco que move para Fila CEO "Redistribuição" e notifica). A função do banco pode ser descontinuada (`DROP`) ou apenas deixar de ser chamada.
- A **redistribuição por timeout de aceite da roleta** (leads `pendente_distribuicao` recém-distribuídos via `redistribuir_leads_pendentes` / `distribuir_lead_atomico`) **permanece intacta** — é outro fluxo.

## 4. Migração de dados — converter quem já está em Redistribuição

Leads atualmente na Fila CEO com `is_redistribuicao = true` (e não reativados por nutrição) serão convertidos para estagnados:
- Devolver ao corretor anterior (`corretor_id = corretor_anterior_id`), limpar `aceite_status = 'pendente_distribuicao'`/flags de redistribuição.
- Marcar `estagnado = true`, `estagnado_em = now()`.
- Registrar histórico da conversão.

## 5. Frontend — Remover UI de Redistribuição

- `src/components/pipeline/FilaCeoDispatchModal.tsx`: remover a aba **Redistribuição** (tab `redistribuicao`), seus memos (`leadsRedistribuicao`), contadores e textos. Mantém abas **Novos** e **Reengajamento**.
- `src/components/pipeline/PipelineHeader.tsx`: remover o botão/atalho "confirmar redistribuição".
- `src/pages/PipelineKanban.tsx`: remover o estado/contador de `is_redistribuicao` e o `openDispatch("redistribuicao")`.
- Ajustar tipagem `initialTab` para `"novos" | "reengajamento"`.

---

## Detalhes técnicos
- Etapa **Sem Contato** id: `2fcba9be-1188-4a54-9452-394beefdc330`.
- Colunas de estagnação já existem em `pipeline_leads`: `estagnado`, `estagnado_em`, `estagnado_aviso_em`, `estagnado_prazo_em`.
- O T7 estagnado **não** passa pelo aviso de 48h do motor de estagnação (já teve o ciclo T1–T7 + aviso de 24h); entra direto como `estagnado = true`.
- Como a etapa Sem Contato não está em `pipeline_estagnacao_config`, o `processar_estagnacao_pipeline` não reseta esses leads automaticamente — a saída é sempre pela decisão na central (correto para o caso).
- Notificações reutilizam `categoria = 'lead_estagnado'` já usada pelo motor.

## Ordem de execução
1. Migração: nova versão de `cadencia_sc_descartar_reengajavel` + `get_pipeline_estagnacao` (LEFT JOIN) — aprovação do usuário.
2. Edge function `lead-escalation`: remover bloco da reciclagem 72h e ajustar textos do T7.
3. Conversão de dados dos leads em redistribuição (insert/update).
4. Limpeza de UI (modal, header, kanban).
5. Validação end-to-end (simular T7 vencido, conferir aparição na central, testar repassar/roleta/descartar).

## Fora de escopo
- Não altera a redistribuição por timeout de aceite da roleta.
- Não altera os estágios já ativos no motor de estagnação (Busca, Contato Iniciado, Aquecimento).
- Não altera a etapa Descarte nem o reengajamento existente.