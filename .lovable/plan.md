# Plano de correção — Mutirão Inteligente ao Vivo

## Auditoria executada (ponta a ponta, perfil Adriana corretora)

Foram inspecionados: 16 arquivos frontend (hooks, telas, cards, popups, painéis), 5 edge functions e a RPC `oferta_ativa_lock_next_lead` no banco. Também foi executado um teste automatizado via Playwright com a sessão de Adriana no preview, simulando: onboarding, puxar lead, iniciar ligação, "Não atendeu", auto-next e navegação entre abas.

### Resultado do teste ao vivo
- Onboarding abriu corretamente com filtros multi-select e contagens de fila por empreendimento/segmento.
- Lead card carregou com lock confirmado, botão "Ligar agora" habilitado corretamente após `lockConfirmed=true`.
- Ligação iniciou, encerrou e "Não atendeu" foi registrado. Pontuação refletiu no ranking (Adriana: 1 ligação, 1 pt).
- Próximo lead apareceu automaticamente com preview otimista + lock rodando em paralelo.
- Ranking, Meta, Feed e histórico renderizaram. Abas de gestão/admin NÃO aparecem para corretora (validado via DOM).

## Bugs e fragilidades encontrados

### 1. CRÍTICO — Corretor pode acumular vários locks ativos (risco de travar a fila)
A RPC `oferta_ativa_lock_next_lead` não verifica se o corretor já possui um lock válido antes de conceder um novo. Com isso, cada chamada a "Puxar próximo lead" cria um lock adicional. Atualmente Adriana tem 5 locks ativos na sessão ao vivo. Cada lock mantém um lead fora da fila por até 15 minutos, reduzindo a fila disponível para todos os corretores. Se o corretor recarregar a página ou puxar sem registrar, os locks antigos permanecem.

### 2. MÉDIO — Histórico mostra spinner prolongado ao abrir a aba
O `HistoricoPanel` é montado/desenmontado pelo `TabsContent` do shadcn a cada troca de aba. A query de histórico é refeita do zero a cada montagem, e o componente fica em `isLoading` até a resposta da edge function. Em teste rápido, a aba ficou no spinner. A edge function responde corretamente, então o problema é a remontagem + falta de prefetch.

### 3. MÉDIO — Timer de 1s no `CorretorScreen` causa re-render global a cada segundo
O `setTick` a cada 1s dispara re-render de todo o `CorretorScreen`, incluindo `LeadCard`, painéis e modais. Não causa bug funcional, mas desperdiça ciclos e pode piorar a experiência durante chamadas.

### 4. BAIXO — Locks órfãos da sessão atual
Os 5 locks ativos da Adriana precisam ser limpos (backfill) para liberar a fila antes do horário de pico.

## Plano de correção

### Fase 1 — Integridade da fila (backend, prioridade máxima)

1. Alterar a RPC `public.oferta_ativa_lock_next_lead` para, quando `p_lock=true`, verificar se o corretor já possui um lock válido (`locked_by = p_corretor_id AND locked_until > now()`). Se existir, retornar o lead já bloqueado em vez de criar um novo lock.
2. Ajustar a edge function `oferta-ativa-proximo-lead` se necessário para tratar o retorno do lock existente (dados já populados, funciona sem mudanças).
3. Criar migration com a alteração da RPC.
4. Backfill: limpar locks `locked_by = '42a8402e...' AND sessao_id = '197f054f...'` para descongestionar a fila imediatamente.

### Fase 2 — UX do histórico (frontend)

1. No `CorretorScreen`, adicionar `forceMount` ao `TabsContent` do histórico (ou fazer prefetch assim que o ranking/participantes carregarem) para que a query já tenha dados quando o corretor clicar na aba.
2. Garantir que `HistoricoPanel` invalide a query ao registrar um resultado (já faz parcialmente; validar se a queryKey bate exatamente).

### Fase 3 — Performance do timer (frontend)

1. Extrair o timer do `CorretorScreen` para um componente `MutiraoTimer` pequeno, isolado, que re-renderize apenas a barra de contagem regressiva.

### Fase 4 — Validação ao vivo

1. Reexecutar o teste Playwright com Adriana: puxar 2 leads consecutivamente sem registrar e confirmar que só existe 1 lock ativo.
2. Verificar se o histórico carrega imediatamente ao abrir a aba.
3. Validar que ranking, feed, meta e onboarding continuam funcionando.

## Escopo

- Apenas `/oferta-ativa-ao-vivo` e seus componentes/edge functions.
- Não altera outras áreas do CRM.
- Não altera lógica de pontuação, gamificação ou layout visual.

## Não requer mockup

As mudanças são técnicas (backend e otimização de re-render). Nenhuma alteração visual significativa no card, ranking ou painel.