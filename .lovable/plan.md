# Limpar o "nurturing" da história do lead e mostrar a origem real do reengajamento

## O problema (confirmado nos dados)

O lead SPINELLI (555183309161) entrou hoje com:
- origem: "Reengajamento (Nutrição)"
- empreendimento: vazio
- campanha: vazio

E na aba História aparecem 3 linhas técnicas de "nurturing_sequencia" (Score 0 → 15, Sugestão IA, respondeu via whatsapp). Existem 1.491 registros desse tipo no histórico, o último gerado hoje.

Duas causas confirmadas:

1. Mesmo sem nutrição ativa, o webhook do WhatsApp chama o orquestrador de nutrição a cada resposta. O orquestrador grava 3 atividades técnicas (score, sugestão de IA, evento) na timeline do lead. É ruído: o corretor não precisa ver score nem prompt de IA.

2. O sistema tenta descobrir o empreendimento pelo template do disparo, mas só olha a tabela `reengajamento_meta_disparos`. O disparo do SPINELLI foi registrado apenas na fila de disparo (`reengajamento_dispatch_queue`, template `casatuacanoas_novidade`, telefone +5551983309161). Além disso, o telefone que chegou pelo WhatsApp veio sem o nono dígito, então a busca por telefone também não casa. Resultado: lead nasce sem empreendimento e sem campanha, e o corretor não sabe do que se trata.

Também confirmado: o mapa de template → empreendimento devolve só "Casa Tua", sem separar Canoas de Porto Alegre.

## O que fazer

### 1. Tirar o ruído de nutrição da História
- Parar de gravar as 3 atividades técnicas (score, "Sugestão IA para abordagem", "Evento: whatsapp_respondeu") na timeline do lead. O orquestrador continua calculando score internamente, mas sem poluir a história.
- Esconder na aba História as atividades do tipo `nurturing_sequencia` já existentes (1.491 registros ficam no banco, apenas deixam de ser exibidas na Narrativa).

### 2. Registrar a entrada correta do lead reengajado
Quando um lead nasce (ou é reativado) por resposta a um disparo, gravar UMA linha de entrada legível, por exemplo:

```text
🔄 Reengajamento — Casa Tua Canoas
Template: casatuacanoas_novidade · Respondeu "Sim, quero informações" em 18/08 16:36
```

E preencher no próprio lead: `empreendimento`, `campanha` (nome do template) e origem legível, para que apareçam no cabeçalho do lead e nos filtros.

### 3. Corrigir a descoberta do empreendimento/template
- Procurar o disparo também em `reengajamento_dispatch_queue`, não só em `reengajamento_meta_disparos`.
- Casar telefone pelos últimos 8 dígitos (tolerante ao nono dígito), como o resto do CRM já faz.
- Ampliar o mapa de templates: separar Casa Tua Canoas de Casa Tua (POA) e cobrir os templates em uso hoje.

### 4. Corrigir o passado (leads já criados assim)
Backfill nos leads criados por reengajamento sem empreendimento: preencher empreendimento e campanha a partir do template do disparo mais recente daquele telefone, e trocar a observação técnica pela linha legível de origem.

## Detalhes técnicos

- `supabase/functions/nurturing-orchestrator/index.ts`: remover os três `insert` em `pipeline_atividades` com `tipo: "nurturing_sequencia"` (linhas ~227, ~264/276 e ~295); manter a atualização de score/estado.
- `supabase/functions/whatsapp-webhook/index.ts`:
  - `empreendimentoFromTemplate`: adicionar `casatuacanoas*` → "Casa Tua Canoas" antes do match genérico de "casatua".
  - `resolveReengEmpreendimento`: passar a devolver `{ empreendimento, template }`, consultando `reengajamento_meta_disparos` e, como fallback, `reengajamento_dispatch_queue`; match por wamid e por últimos 8 dígitos.
  - Nos dois pontos de criação de lead (OA e remetente novo) e no ramo de lead existente: gravar `empreendimento`, `campanha = template`, e uma atividade `tipo: "entrada"` com o título "🔄 Reengajamento — {empreendimento}" em vez do texto atual.
- `src/components/pipeline/LeadHistoricoTab.tsx`: filtrar `a.tipo === "nurturing_sequencia"` na montagem da timeline (a sub-aba Sistema também deixa de listá-las).
- Migration de backfill: `update pipeline_leads` para leads com `reativado_por_nutricao = true` e `empreendimento is null`, usando o template mais recente casado por últimos 8 dígitos.
- Sem mudança de schema, sem novas tabelas, sem alteração no motor de disparo.
