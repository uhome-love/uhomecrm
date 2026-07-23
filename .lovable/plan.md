## Problema
Thalia tem 6 leads na UI sem tarefa pendente, mas a roleta bloqueia com mensagem "mais de 10 leads desatualizados". A função `contar_leads_desatualizados` retorna 12 para ela.

## Diagnóstico confirmado
A função `contar_leads_desatualizados` exclui estágios `descarte` e `convertido`, mas **não exclui** `venda` (Ganho) e `caiu` (Caiu). A UI (`useCorretorKpisCarteira`) exclui os quatro tipos. Os 6 leads extras da Thalia são exatamente leads em `Ganho` ou `Caiu` sem tarefa pendente — etapas finais que não deveriam exigir tarefa para liberar a roleta.

## Plano de correção
1. **Migration**: atualizar `public.contar_leads_desatualizados` para excluir `venda` e `caiu` junto com `descarte` e `convertido`, alinhando com a regra do frontend.
2. **Backfill / revalidação**: executar `public.get_elegibilidade_roleta` para a Thalia e confirmar que `pode_entrar_roleta` vira `true` e `leads_desatualizados` cai para 6.
3. **Validação**: verificar se outras funções/policies dependem da contagem antiga e não serão afetadas. Nenhuma outra lógica de negócio deve contar leads ganhos/caidos como desatualizados.
4. **Teste no preview**: tentar credenciamento para tarde no perfil da Thalia no preview e confirmar liberação.

## Arquivos alterados
- `supabase/migrations/20260515214652_cf8995a1-2a45-46c0-8851-3032ed4a85df.sql` (função `contar_leads_desatualizados`) ou nova migration.

## Impacto
Corretores com leads em `Ganho`/`Caiu` sem tarefa pendente deixarão de ser injustamente bloqueados na roleta.