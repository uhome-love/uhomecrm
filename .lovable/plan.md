## Contexto

A página `/ranking` (`RankingEquipe.tsx`) está usando lógica de **score ponderado** para ordenar os 4 rankings, o que distorce a leitura. Além disso, há **inconsistências de fonte de dados** que precisam ser corrigidas para refletir os números reais do CRM.

Validei contra o banco (Abril/2026): 1740 leads, 277 visitas (142 realizadas), 11 vendas, 52 distratos. Os queries do hook `useRankingsData.ts` batem em estrutura, mas precisam de ajustes pontuais.

## O que mudar

### 1. Remover sistema de score — ordenar por métrica principal

Cada ranking passa a ser ordenado por **uma única métrica clara**, sem soma/pontuação:

| Ranking | Critério de ordenação |
|---|---|
| **Presenças & Leads** | `leads_recebidos` DESC (tiebreak: total de presenças DESC) |
| **Pipeline de Leads** | `ativos` DESC (tiebreak: `desatualizados` ASC) |
| **Visitas** | `realizadas` DESC (tiebreak: `criadas` DESC) |
| **Negócios** | `vgv_assinado` DESC (tiebreak: `assinados` DESC) |

A coluna "Score" da tabela vira a **métrica principal destacada** (ex.: "Leads", "Ativos", "Realizadas", "VGV Assinado").

### 2. Correções de fonte/período

- **Negócios — distratos**: trocar filtro de `updated_at` por **`fase_changed_at`** (timestamp real da mudança para distrato). Hoje qualquer edição posterior do registro empurra o distrato para o mês errado.
- **Negócios — vendas**: já usa `data_assinatura` + `fase='vendido'` ✅ (memória canônica respeitada).
- **Visitas — criadas**: usar `data_visita` no período (já está; é a data canônica). "Realizadas" = `status='realizada'` no mesmo recorte.
- **Visitas — status**: incluir contador de `marcada` (agendadas pendentes) além de `realizada` e `no_show`.
- **Presenças**: lógica de janela (`manha`/`tarde`/`noturna`/`dia_todo`) e domingo (via `getDay`) está correta — manter, mas exibir total de presenças explícito.
- **Pipeline de Leads**: stale `> 48h` em BRT (já correto). Remover do cálculo a métrica `aproveitamento` derivada (não mais usada como score).
- **Filtro de período**: confirmar que datas timestamptz usam `T00:00:00-03:00`/`T23:59:59-03:00` (já implementado) e datas puras (`data`, `data_visita`, `data_assinatura`) usam string `YYYY-MM-DD` direto (já implementado).
- **Filtro de equipe**: validar que admin pode ver "Todas" e gestor é forçado a sua própria equipe (já implementado, manter).

### 3. Ajustes visuais

- Tabela: coluna final passa a se chamar conforme a métrica principal (não mais "Score").
- Medalhas 🥇🥈🥉 mantidas no top 3.
- Header de cada ranking ganha uma legenda curta explicando o critério de ordenação ("Ordenado por leads recebidos no período").
- Manter tabs, filtros de período (Hoje/Semana/Mês/Personalizado) e navegação ‹ ›.

## Arquivos afetados

- `src/hooks/useRankingsData.ts` — remover campo `score`, ajustar ordenação, corrigir filtro de distrato (`fase_changed_at`).
- `src/components/ranking/v2/RankingTable.tsx` — renomear prop `scoreLabel` → `primaryLabel`, ajustar visual da coluna destaque.
- `src/components/ranking/v2/RankingPresencasLeads.tsx` — destaque = leads, adicionar coluna "Total presenças".
- `src/components/ranking/v2/RankingPipelineLeads.tsx` — destaque = ativos; manter colunas por etapa e desatualizados.
- `src/components/ranking/v2/RankingVisitas.tsx` — destaque = realizadas; mostrar criadas/realizadas/no_show.
- `src/components/ranking/v2/RankingNegocios.tsx` — destaque = VGV assinado formatado em R$.
- `src/pages/RankingEquipe.tsx` — sem mudanças estruturais (apenas se precisar ajustar legenda).

## Validação após implementação

1. Filtro **Mês = Abril/2026** deve mostrar números coerentes com:
   - Total leads recebidos somando ≈ 1740
   - Total visitas criadas ≈ 277, realizadas ≈ 142
   - Total VGV assinado de 11 negócios em Abril
   - Total distratos em Abril ≈ 52
2. Trocar para **Hoje** e **Semana atual** — confirmar que recorte muda.
3. Filtro de **Equipe** (admin) deve filtrar apenas corretores ligados ao gerente em `team_members`.
4. Top 3 do ranking de Negócios deve listar quem mais assinou VGV em Abril.