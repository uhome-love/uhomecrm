## Diagnóstico

Os 4 reengajados de Átrio de hoje existem no backend e foram processados:
- Laura Heck de Oliveira
- Marcello
- Janaina Beck
- Andréa

Todos estão com:
- etapa = `Novo Lead`
- `arquivado = false`
- corretor atribuído
- fluxo de roleta executado

A causa real de “aparecem só 2 / não aparecem os 4” não é banco nem permissão.

### Causa principal
O frontend do pipeline esconde leads se `motivo_descarte` começar com `Inativado:` ou `Descarte:`.
Hoje 3 dos 4 reengajados ainda carregam esse valor antigo, mesmo já tendo voltado para `Novo Lead`:
- Laura: `Inativado: Não quer mais contato`
- Marcello: `Inativado: Cliente disse que está procurando somente em passo fundo.`
- Andréa: `Descarte: Sem interesse`

A Janaina aparece porque está sem `motivo_descarte`.

### Achados adicionais
- Houve respostas duplicadas em alguns leads do Átrio:
  - Marcello: 3 respostas
  - Andréa: 2 respostas
- Em Andréa houve notificação/distribuição duplicada para dois corretores antes do estado final consolidar.
- O histórico de atividade do Átrio não está padronizado em todos os casos.

## Plano de correção

### 1) Corrigir a regra de visibilidade do pipeline
Ajustar `usePipeline` para não esconder lead ativo só porque sobrou um `motivo_descarte` legado.

Regra nova:
- esconder apenas se o lead estiver realmente arquivado
- ou se a etapa atual for de descarte
- não esconder só por texto antigo em `motivo_descarte`

Resultado esperado:
- Laura, Marcello e Andréa voltam a aparecer imediatamente no pipeline
- a UI passa a refletir o estado atual real do lead

### 2) Corrigir o backend do reengajamento/roleta
Ao redistribuir lead reengajado via Átrio/roleta, limpar o estado antigo de descarte.

Ajustes:
- limpar `motivo_descarte`
- garantir `arquivado = false`
- manter `stage_id = Novo Lead`
- manter o vínculo com corretor e aceite corretamente

Ponto ideal para centralizar:
- `distribute-lead` como saneamento global de entrada pela roleta
- complementar `campanha-atrio-processar-resposta` para o caso específico do Átrio

Resultado esperado:
- novos reengajamentos não somem mais depois de distribuídos
- o estado persistido fica coerente com o que a UI espera

### 3) Endurecer idempotência do fluxo Átrio
Evitar duplicidade quando o mesmo lead responde mais de uma vez em sequência curta.

Ajustes:
- bloquear segunda redistribuição do mesmo lead em janela curta após resposta já processada
- deduplicar por lead + resposta recente, não só por `wamid`
- impedir segunda notificação/segunda distribuição quando o primeiro processamento já concluiu

Resultado esperado:
- sem dupla distribuição
- sem dupla notificação para corretores
- sem corrida em respostas como Marcello/Andréa

### 4) Padronizar histórico do lead
Garantir registro único e legível no histórico para reengajamento Átrio.

Registrar sempre:
- origem = disparo Átrio
- tipo de resposta
- se foi para roleta
- corretor final atribuído
- se houve reaproveitamento de lead descartado/inativado

Também farei backfill pontual dos casos de hoje que ficaram inconsistentes.

### 5) Backfill dos 4 leads de hoje
Aplicar correção nos registros já afetados:
- limpar `motivo_descarte` residual dos 3 leads ocultos
- completar atividade histórica faltante/inconsistente
- validar visualmente que os 4 aparecem no pipeline

## Validação final

Vou validar estes pontos após a implementação:
- os 4 reengajados aparecem no pipeline como `Novo Lead`
- Laura fica visível no pipeline do Eliézer e também na visão CEO
- Janaina, Marcello e Andréa aparecem normalmente
- histórico mostra a origem Átrio de forma consistente
- não há nova duplicidade de distribuição em respostas repetidas

## Detalhes técnicos

Arquivos mais prováveis da correção:
- `src/hooks/usePipeline.ts`
- `supabase/functions/distribute-lead/index.ts`
- `supabase/functions/campanha-atrio-processar-resposta/index.ts`

Dados já confirmados:
- o backend está saudável
- a consulta do pipeline retorna dados
- o problema é de regra de ocultação + limpeza incompleta do estado antigo de descarte