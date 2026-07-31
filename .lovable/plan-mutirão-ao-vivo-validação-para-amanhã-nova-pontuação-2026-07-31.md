# Mutirão Ao Vivo — validação para amanhã + nova pontuação

## 1. Diagnóstico da validação (verificado agora no banco/código)

**Sessão**
- Existe 1 sessão criada hoje 00:35 para 31/07: início 07:00 BRT, fim 23:00 BRT.
- Status atual: `agendada`. A tela do corretor e o Placar TV só enxergam sessão com status `ao_vivo` — enquanto estiver `agendada`, todo mundo vê "Nenhum Mutirão ao vivo agora".
- Ação necessária amanhã: em ⚙️ Configurações, clicar em "Colocar ao vivo" (não é automático).

**Fila de leads (esteira)**
- 3.328 leads carregados na fila da sessão de amanhã, todos em etapa Descarte, todos com telefone válido (0 sem telefone), 3.309 telefones distintos.
- Distribuição: verde 2.999 · amarelo 292 · verde_hot 37.
- Nenhum lead ativo do pipeline entrou na fila (os 39 não arquivados estão todos em Descarte aguardando o arquivamento de 24h) — exclusividade OK.
- Descartados novos entraram: inclui descartes de 29 e 30/07 (ex.: leads Meta descartados hoje).
- Ponto de atenção: a carga da fila é manual (botão "Popular fila"), rodou hoje 00:35. Descartes que acontecerem entre 00:35 de hoje e o começo do mutirão amanhã não estarão na fila até rodar de novo.
- Locks presos: 21, mas todos na sessão antiga de 23/07 — não afetam amanhã. Na sessão nova: 0 locks.

**Motor / ingestão**
- Sem erros de ingestão de lead nas últimas horas; cron de devolução automática ativo (04:00 BRT).

## 2. O que será feito

### A. Nova pontuação do ranking
Regra atual: ligação/não atendeu/sem interesse = 1 pt · aproveitado = 4 · visita = 10.

Regra nova:
- Tentativa (pulado, não atendeu, sem interesse, descarte definitivo): **0 ponto**
- Aproveitamento de lead: **5 pontos**
- Agendamento de visita: **30 pontos** (total do evento; não soma os 5 do aproveitamento)

Onde muda:
- `supabase/functions/oferta-ativa-registrar-resultado/index.ts` — tabela `PONTOS`.
- `src/components/oferta-ativa-ao-vivo/RankingPanel.tsx` — legenda "Visita = 10 pts · Aproveitamento = 4 pts · Ligação = 1 pt" → "Visita = 30 pts · Aproveitado = 5 pts · Tentativa = 0".
- `src/components/oferta-ativa/ScoringLegend.tsx` — tabela de pontos da Oferta Ativa clássica alinhada à nova regra.

Contadores de ligações, aproveitamentos e visitas continuam sendo registrados normalmente (só deixam de virar ponto); as abas "Ligações" e "Visitas" do ranking seguem funcionando.

### B. Checklist operacional para amanhã de manhã
- Repopular a fila logo antes do início (pega descartes de hoje/madrugada).
- Colocar a sessão `ao_vivo`.
- Conferir Painel Ao Vivo e Placar TV com a nova pontuação zerada.

## 3. Validação após o build
- Teste ao vivo no preview: abrir /oferta-ativa-ao-vivo como corretor, pegar um lead de teste, registrar "não atendeu" (deve somar 0), depois "aproveitado" (+5) e conferir no Painel Ao Vivo e Placar TV.
- Nenhum dado de lead real será alterado no teste (uso de lead de teste e cancelamento ao final).

## 4. Detalhes técnicos
- Somente a constante `PONTOS` da edge function muda o cálculo; o `rpc_placar_mutirao` e os painéis apenas leem `oferta_ativa_participantes.pontos`, então não há migração de banco necessária.
- Pontos já acumulados em sessões antigas não são recalculados (sessão de 23/07 já encerrada; a sessão de amanhã começa zerada).
