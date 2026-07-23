# Plano: Distribuição 1 a 1 por Produto na Roleta

## Regra de negócio aprovada

- A roleta distribui **por produto/alocação**.
- **Só recebe leads** quem estiver: (a) credenciado e aprovado no turno, (b) ativo na roleta (`cd.na_roleta = true`), (c) alocado ao `empreendimento_canonico_id` do lead.
- Dentro de cada produto, os corretores elegíveis recebem leads de forma **igualitária 1 a 1** (menor número de leads daquele produto no turno primeiro; desempate por LRU/última distribuição).
- **Se nenhum corretor estiver alocado/ativo para o produto**, o lead **NÃO** cai no pool geral. Ele vai para **fila CEO** (`aceite_status = 'pendente_distribuicao'`, `motivo_pendencia = 'sem_alocado_produto'`) para distribuição manual pela gestão.
- Presença por credenciamento continua sendo a porta de entrada (`roleta_credenciamentos` + `roleta_fila`); a alocação define quem pode receber de cada produto.

## Problemas atuais confirmados na auditoria

1. **Duplicatas em `roleta_fila`**: corretores aparecem 2 a 4 vezes para a mesma (`data`, `janela`). A função `distribuir_lead_atomico` usa `DISTINCT ON (corretor_id)` que pega uma linha arbitrária, então os campos `leads_recebidos` e `ultima_distribuicao_at` podem estar inconsistentes.
2. **Fairness não é por produto**: a contagem `recebidos_no_turno` na RPC é por `segmento_id`, não por `empreendimento_canonico_id`. Um corretor pode receber vários leads de produtos diferentes dentro do mesmo segmento e ainda ser considerado "igual".
3. **Fallback para pool geral quando produto não tem alocado**: hoje, se `v_alocacao_match_count = 0`, a RPC desliga o filtro de alocação e distribui para qualquer corretor do segmento. Isso viola a regra "só quem está alocado recebe".
4. **Desbalanceamento real**: nos últimos 30 dias, Adriana Kaiser recebeu 2,43x a média e Guilherme Dias 1 lead. A combinação de duplicatas + contagem por segmento + fallback geral concentra leads em corretores de produtos de alto volume.

## Solução técnica

### Fase 1 — Corrigir a estrutura da fila (DDL + backfill)

1. **Consolidar `roleta_fila` para uma linha por (`corretor_id`, `data`, `janela`)**
   - Migration para criar tabela temporária consolidada, somar `leads_recebidos`, manter `ultima_distribuicao_at` mais recente e priorizar `ativo = true`.
   - Truncar `roleta_fila` e re-inserir os dados consolidados.
   - Adicionar **constraint UNIQUE (`corretor_id`, `data`, `janela`)**.

2. **Atualizar funções que escrevem na fila**
   - `roleta_marcar_presenca`: usar `ON CONFLICT (corretor_id, data, janela) DO UPDATE` para ativar/desativar em vez de inserir nova linha.
   - `credenciar_por_alocacao`: a aprovação (`aprovarCredenciamento`) deve fazer `INSERT ... ON CONFLICT ... DO UPDATE`.
   - `roleta-shift-cleanup` (edge function): no fim do turno, desativar (`ativo = false`) a linha consolidada, não criar nova linha.

3. **Sincronizar `corretor_disponibilidade.na_roleta`**
   - Garantir que a flag reflita a existência de fila ativa (`ativo = true`) para a janela atual.

### Fase 2 — Refatorar `distribuir_lead_atomico` para fairness por produto

4. **Agrupar fila por corretor antes do sorteio**
   - Substituir o `DISTINCT ON (corretor_id)` atual por uma CTE que agrega `roleta_fila` por `corretor_id`:
     - `leads_recebidos_hoje` = SUM(`leads_recebidos`) das linhas ativas daquele corretor hoje.
     - `ultima_distribuicao_at` = MAX entre as linhas ativas (NULL se nunca recebeu).
   - Filtrar apenas `ativo = true` e `rc.status = 'aprovado'` e `cd.na_roleta = true`.

5. **Contar recebidos por produto**
   - Criar CTE `recebidos_por_produto` que conta, para cada corretor, quantos leads daquele `empreendimento_canonico_id` ele recebeu naquele turno no dia (usando `distribuicao_historico` ou `roleta_distribuicoes`).
   - Esse será o **critério principal** de fairness 1 a 1.

6. **Novo algoritmo de escolha**
   - Pool A: corretores alocados ao produto (`v_emp_canonico_id = ANY(ca.empreendimentos)`) **E** elegíveis no turno (`ativo`, `na_roleta`, `rc.status = 'aprovado'`).
   - Se Pool A não for vazio:
     - Escolher quem tiver menos `recebidos_por_produto` no produto/turno.
     - Empate = `ultima_distribuicao_at` mais antiga (NULLS FIRST).
     - Novo empate = `leads_recebidos_hoje` total menor.
     - Empate final = `fila_id`.
   - Se Pool A for vazio:
     - Lead vai para **fila CEO**: `UPDATE pipeline_leads SET aceite_status = 'pendente_distribuicao', motivo_pendencia = 'sem_alocado_produto'`.
     - Retornar `success = false, reason = 'sem_alocado_produto'`.

7. **Atualizar após distribuição**
   - Incrementar `leads_recebidos` e `ultima_distribuicao_at` na linha consolidada da janela do corretor escolhido.
   - Gravar em `distribuicao_historico` e `roleta_distribuicoes` com `empreendimento_canonico_id` e `pool = 'alocado'` para auditoria.

8. **Configuração de rollback (feature flag)**
   - Adicionar `roleta_config.fairness_produto = true` (default true). Se desligado, volta ao comportamento atual (fallback geral). Isso permite rollback rápido em caso de emergência.

### Fase 3 — Auditoria e transparência

9. **Estender `distribuicao_historico`**
   - Adicionar colunas: `empreendimento_canonico_id`, `pool` ('alocado'|'segmento'|'geral'), `recebidos_no_turno_produto`, `pool_size`.
   - Preencher na RPC para auditoria exata.

10. **Melhorar `get_distribuicao_performance`**
    - Adicionar seção "por produto" com distribuições, aceites e leads pendentes por `empreendimento_canonico_id`.
    - Adicionar alerta de desbalanceamento por produto (ex: corretor com >2x a média dos co-alocados no produto).

11. **Criar/expandir painel de auditoria da roleta**
    - Reutilizar `DistributionDashboard.tsx` ou criar nova rota `/roleta/auditoria`.
    - Mostrar:
      - Leads distribuídos hoje por corretor × produto.
      - Corretores alocados a cada produto e quantos leads receberam no turno.
      - Alerta de desbalanceamento por produto.
      - Leads pendentes na fila CEO (`sem_alocado_produto`).

### Fase 4 — Front-end e edge functions

12. **Atualizar `supabase/functions/distribute-lead/index.ts`**
    - Nenhuma mudança de interface esperada; garantir que continue chamando `distribuir_lead_atomico` e logue `reason` quando for `sem_alocado_produto`.

13. **Atualizar `_shared/roleta-distribution.ts`**
    - Adicionar log de `pool` e `usou_filtro_alocacao` no resultado.

14. **Atualizar `DistributionDashboard.tsx`**
    - Exibir o novo bloco "por produto" com os dados da RPC estendida.

## Backfill e limpeza

15. **Consolidar `roleta_fila` atual**
    - Migration de consolidação para hoje e, se possível, últimos 7 dias (afeta LRU).
    - Garantir que `corretor_disponibilidade.na_roleta` reflita a existência de fila ativa.

16. **Auditar leads pendentes na fila CEO**
    - Verificar leads com `aceite_status = 'pendente_distribuicao'` e ajustar motivo para `sem_alocado_produto` quando for o caso.

## Critérios de pronto

- [ ] Cada corretor aparece no máximo 1 vez na `roleta_fila` por (`data`, `janela`).
- [ ] A RPC escolhe corretor com base em `recebidos_no_turno` **por produto** entre os alocados ao produto e ativos na roleta.
- [ ] Se todos os alocados ao produto já receberam o mesmo número de leads no turno, o próximo lead vai para quem está esperando há mais tempo.
- [ ] Se nenhum corretor alocado estiver ativo para o produto, o lead vai para fila CEO (`sem_alocado_produto`) — não cai no pool geral.
- [ ] `distribuicao_historico` registra `empreendimento_canonico_id` e `pool` para cada distribuição.
- [ ] Painel de auditoria mostra desbalanceamento por produto e fila CEO.
- [ ] Teste ao vivo: 6 leads de Casa Tua com 3 corretores alocados presentes → cada um recebe 2 leads (±1) no turno.
- [ ] Teste ao vivo: lead de produto sem alocados → aparece na fila CEO.
- [ ] Nenhuma regressão no fluxo de aceite/rejeição/timeout.

## Decisão confirmada

Você aprovou: **1 a 1 por produto, só para alocados ativos no turno; se não houver alocado, vai para fila CEO.**

Assim que aprovar este plano técnico, inicio a Fase 1 (DDL de consolidação da fila).