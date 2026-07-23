# Plano: Parar os refreshes da tela do Mutirão Ao Vivo durante ligações

## Problema
A corretora Rafaela relatou que, enquanto ligava pelo `/oferta-ativa-ao-vivo`, a tela "deu um refresh e recarregou do nada", interrompendo o fluxo de trabalho. O dono do produto determinou: não pode haver refresh automático durante uma ligação; refresh só pode acontecer no final de uma ligação, e isso será discutido depois.

## Diagnóstico preliminar (confirmar no passo 1)
Existem dois mecanismos capazes de recarregar a página inteira (não apenas re-renderizar):

1. **Service Worker — `public/sw.js`**  
   A cada 5 minutos o SW busca `/version.json`. Se a versão mudar (ex: v9 → v10 após deploy), ele apaga o cache e executa `client.navigate(client.url)` para **todas as abas abertas**, recarregando a página sem aviso.

2. **Service Worker registration — `src/main.tsx`**  
   Também a cada 5 minutos chama `reg.update()` e, no evento `controllerchange`, faz `window.location.reload()`. Um novo deploy ativa isso.

Os mecanismos de re-render (não reload de página) também existem, mas não explicam o relato:
- `useMutiraoRanking` refetch a cada 15s + realtime `oferta_ativa_participantes`/`oferta_ativa_ligacoes`.
- `useMutiraoParticipantes` refetch a cada 20s + realtime.
- `HistoricoPanel` refetch a cada 60s.
- `FeedPanel` realtime em `pulse_events`.
- `MutiraoTimer` e timer do `LeadCard` são isolados e só re-renderizam seus próprios componentes.

Hipótese principal: **o Service Worker está forçando reload automático após deploys recentes** (v8, v9 e futuros). A tela do corretor não tem proteção contra isso durante uma chamada.

## Plano de ação

### Passo 1 — Confirmar a causa via Playwright + logs
- Acessar `/oferta-ativa-ao-vivo` como Rafaela (perfil de corretora).
- Abrir DevTools e verificar: (a) SW registrado, (b) `version.json` atual, (c) se `controllerchange` ou `client.navigate` foram disparados.
- Simular uma mudança de `version.json` e observar se a página recarrega.
- Resultado esperado: confirmar se o reload vem do SW, de chunk error, de auth ou de outro lugar.

### Passo 2 — Tornar o Service Worker menos agressivo (mudança global, mas segura)
- Em `public/sw.js`, remover o `client.navigate(client.url)` automático do `checkForUpdate`.
- Substituir por uma notificação via `postMessage` para os clients: `{type: 'NEW_VERSION_AVAILABLE', version: data.v}`.
- O client decide quando recarregar. Não haverá mais reload forçado por deploy.
- O SW continua fazendo Stale-While-Revalidate, então a app funciona normalmente até o usuário atualizar manualmente.

### Passo 3 — Proteger a tela do corretor contra qualquer tipo de reload durante ligação
Criar um hook `useMutiraoUpdateGuard` em `src/hooks/useMutiraoUpdateGuard.ts` que:
- Observa `ms.callState` do `useMutiraoSession`.
- Quando `callState === 'in_call'`, adiciona um `beforeunload` handler que avisa o usuário se algo tentar fechar/recarregar a aba.
- Quando `callState === 'in_call'`, suprime `reg.update()` e ignora mensagens `NEW_VERSION_AVAILABLE` (não mostra botão de atualizar enquanto ligar).
- Quando a ligação termina (`callState === 'ended'`), se houver update pendente, mostra botão discreto "Atualizar app" no topo do card.

### Passo 4 — Reduzir distrações/re-render durante a ligação
Em `CorretorScreen.tsx` e hooks filhos:
- Quando `callState === 'in_call'`:
  - Pausar realtime subscriptions (`RankingPanel`, `HistoricoPanel`, `FeedPanel`).
  - Suspender refetch automático de ranking/histórico/participantes.
  - Manter apenas o heartbeat a cada 30s (não muda UI) e o timer da ligação.
- Quando a ligação termina, reativar todos os canais e fazer um refetch manual para sincronizar.

### Passo 5 — Persistir o estado da ligação para evitar perda de lead em caso de reload real
- Salvar `current.fila_id`, `current.lead.id`, `callStart` e `callState` em `sessionStorage` com chave escopada por corretor.
- Ao montar `useMutiraoSession`, se encontrar estado de ligação em andamento (`in_call` e callStart < 30 min), restaurar o lead atual e continuar a ligação.
- Isso protege contra reloads que não conseguirmos evitar (ex: usuário apertar F5, crash de aba, atualização do navegador).

### Passo 6 — Adicionar indicador visual de "modo foco"
- Quando `callState === 'in_call'`, adicionar um badge/overlay discreto no topo do `LeadCard`: "Modo foco: atualizações pausadas".
- Isso dá feedback para a corretora de que a tela está protegida.

### Passo 7 — Validar ponta a ponta
- Simular ligação no preview.
- Forçar mudança de `version.json` e confirmar que a página **não** recarrega durante a ligação.
- Confirmar que, após encerrar a ligação, o botão de atualização aparece (se houver nova versão) e funciona.
- Confirmar que ranking/feed/histórico não piscam durante a ligação.
- Testar o restauro de estado via F5 durante uma ligação simulada.

## Arquivos que serão alterados
- `public/sw.js` — remove reload automático, envia mensagem para client.
- `src/main.tsx` — escuta mensagem do SW, não recarrega automaticamente durante chamada.
- `src/hooks/useMutiraoUpdateGuard.ts` — novo hook de proteção.
- `src/hooks/useMutiraoSession.ts` — persiste/restaura estado de ligação.
- `src/components/oferta-ativa-ao-vivo/CorretorScreen.tsx` — aplica update guard, pausa realtime durante chamada.
- `src/components/oferta-ativa-ao-vivo/LeadCard.tsx` — badge de modo foco.
- `src/hooks/useMutiraoRealtime.ts` — expor flag para pausar subscriptions (opcional, se necessário).

## O que NÃO será alterado
- Não vamos remover o Service Worker; ele ainda entrega PWA e resiliência offline.
- Não vamos desativar o ranking/feed em estado normal; só pausamos durante chamadas ativas.
- Não vamos implementar refresh automático a cada final de ligação agora (conforme pedido, será discutido depois).

## Riscos e mitigações
- **Risco:** SW menos agressivo pode fazer usuários ficarem com versão antiga por mais tempo.  
  **Mitigação:** manter o botão de atualização visível após o fim da ligação; em outras telas, mostrar um toast/banner discreto.
- **Risco:** Pausar realtime pode fazer ranking parecer desatualizado.  
  **Mitigação:** sincronizar imediatamente ao terminar a ligação.
- **Risco:** Restaurar estado de ligação pode restaurar um lead já resolvido.  
  **Mitigação:** validar se `fila_id` ainda existe e está com lock ativo; se não, limpar estado.

## Critérios de pronto
- [ ] Durante uma ligação no `/oferta-ativa-ao-vivo`, a página não recarrega automaticamente.
- [ ] Durante uma ligação, ranking/feed/histórico não atualizam (modo foco).
- [ ] Após encerrar a ligação, se houver nova versão, um botão de atualização aparece.
- [ ] Se o usuário der F5 durante uma ligação, o lead e o timer são restaurados.
- [ ] Nenhuma outra tela do CRM é quebrada pelo novo comportamento do SW.