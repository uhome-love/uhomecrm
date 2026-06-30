## Resultado da auditoria — Leads Estagnados + Pipeline

### O que está CORRETO ✅
- **Limites por etapa** (`pipeline_estagnacao_config`): Contato Iniciado **15d**, Busca **15d**, Aquecimento **30d**. Demais etapas não estagnam por tempo (correto).
- **Cron** `processar-estagnacao-pipeline-diario` ativo, roda 10:00 BRT.
- **Decisões** (`decidir_lead_estagnado`): Devolver / Repassar / Roleta (Fila do CEO) / Descartar limpam todas as flags de estagnação, registram histórico e respeitam permissão (admin/diretor/gestor da equipe).
- **Categorias** coerentes entre `get_pipeline_estagnacao` (lista) e `get_lead_estagnacao_status` (card no lead): protege por tarefa futura, por parceria, por negócio e por pós-venda.
- **Aquecimento** com 2 avisos (no limite + 24h antes). Relógio de inatividade usa a maior data entre última ação humana e prazo de tarefa atrasada.
- 0 "confirmados" falsos (nenhum com negócio criado ou em pós-venda). Abas renomeadas (Estagnados/A estagnar) consistentes.

### Bugs encontrados 🐞

**Bug 1 — Leads "fantasma" (limbo).** Encontrei 2 leads (Deivid Aguiar e Larissa Lese, etapa "Sem Contato") que estão `estagnado = true` e `arquivado = true`, mas ganharam tarefa futura/ação **depois** de estagnar. Resultado: somem do pipeline do corretor (porque arquivados) **e** não aparecem na Central de Estagnados (porque a lista exclui quem tem tarefa futura). Ficam invisíveis para todos.

- Causa A: `get_pipeline_estagnacao` aplica o filtro "sem tarefa futura" também aos já confirmados — um confirmado nunca deveria sumir da central até ter uma decisão.
- Causa B: não existe "ressurreição" automática. Quando o corretor age de novo num lead já estagnado (regra "qualquer ação zera o relógio"), nada o traz de volta. O reset do cron só percorre as 3 etapas configuradas, ignorando "Sem Contato".

### Correções propostas

1. **Central sempre mostra confirmados** — ajustar `get_pipeline_estagnacao` para que leads `estagnado = true` apareçam independentemente de terem tarefa futura, até que uma decisão seja tomada. (Defesa contra novos casos de limbo.)

2. **Ressurreição automática (todas as etapas)** — em `processar_estagnacao_pipeline`, adicionar um passo que reativa qualquer lead `estagnado = true` que tenha **ação humana após `estagnado_em`** OU **tarefa pendente futura**: zera `estagnado/arquivado/avisos/prazo` e devolve ao fluxo do corretor. Hoje isso só acontece nas etapas configuradas; passará a valer também para "Sem Contato". Espelhar o mesmo reset em `processar_cadencia_sem_contato`.

3. **Backfill imediato** — reativar agora os 2 leads em limbo (Deivid e Larissa), já que têm tarefa para amanhã e ação recente.

### Detalhes técnicos
- Migrations: `CREATE OR REPLACE` de `get_pipeline_estagnacao` e `processar_estagnacao_pipeline` (+ reset no `processar_cadencia_sem_contato`). Sem alteração de schema, RLS ou tabelas.
- Backfill: `UPDATE pipeline_leads SET estagnado=false, estagnado_em=NULL, estagnado_aviso_em=NULL, estagnado_aviso2_em=NULL, estagnado_prazo_em=NULL, arquivado=false` nos 2 IDs.
- Nenhuma mudança de frontend necessária (a lista e o card já consomem as RPCs corrigidas).
