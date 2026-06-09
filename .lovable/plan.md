## Problema

Na tela **Vendas realizadas**, o "Ranking de Vendedores" credita o VGV **inteiro** da venda em parceria ao corretor principal e não dá nada ao parceiro.

Exemplo confirmado: venda **Edson Lopes / Connect JW (R$ 448.920)** de maio é parceria 50/50 entre **Rafaela Campos** e **Gustavo Niz**. O banco (`v_kpi_negocios`) já divide corretamente: R$ 224.460 para cada um. Mas o ranking da tela soma os R$ 448.920 completos só para a Rafaela e zero para o Gustavo nessa venda.

A lista de vendas (com o badge "🤝 Parceria 50%") e os KPIs da empresa continuam corretos — o ajuste é apenas na atribuição por vendedor no ranking.

## Causa técnica

Em `src/pages/VendasRealizadas.tsx`, o `useMemo` `corretorRanking` (linhas ~347-358) agrega por `v.corretor_id` usando o VGV cheio (`v.vgv_final || v.vgv_estimado`). Ele ignora completamente `parceriaPartners` / `fator_split`, que já vêm de `v_kpi_negocios` e estão disponíveis no componente.

## Solução

Reescrever apenas o cálculo do `corretorRanking` para ser ciente de parceria:

- Para cada venda em `filtered`:
  - Se for parceria (existe `parceriaPartners[v.pipeline_lead_id]` com 2+ `auth_user_ids`):
    - Distribuir `vgv * fator_split` (50% por padrão) para **cada** parceiro.
    - Resolver o vendedor pelo `auth_user_id` usando `authProfiles` (nome/avatar), agregando por `auth_user_id`.
    - Contar +1 venda para cada parceiro.
  - Caso contrário (venda normal):
    - Manter o comportamento atual: VGV cheio para `v.corretor_id`, resolvido por `profiles`.
- Como o agrupamento passa a misturar chaves de `profile.id` (vendas normais) e `auth_user_id` (parcerias), unificar a chave do mapa do ranking pelo `auth_user_id` do vendedor, usando `profileIdToAuthId` para converter o `corretor_id` das vendas normais. Assim a mesma pessoa não aparece duplicada quando tem venda própria e venda em parceria.
- Ordenar por VGV desc (como hoje).

Resultado: nessa venda, Rafaela e Gustavo recebem R$ 224.460 cada no ranking, em vez de R$ 448.920 só para a Rafaela.

## Escopo

- Arquivo único: `src/pages/VendasRealizadas.tsx` — somente o bloco `corretorRanking`.
- Sem mudanças de banco, migrations ou outras telas (os dados já estão corretos em `v_kpi_negocios`).

## Validação

- Filtrar maio/2026, conferir no Ranking de Vendedores que Rafaela e Gustavo recebem R$ 224.460 da venda Connect JW (somados aos demais negócios de cada um) e que ninguém aparece duplicado.
