# Aposentar o Typesense do CRM

## Situação verificada agora

- **Site Uhome (projeto separado): zero uso.** Nenhuma referência a Typesense em 327 arquivos. A busca do site roda pela edge function própria `ai-search` + consulta direta ao banco.
- **CRM: existe código, mas o uso real é residual.** O índice ainda responde (testei a busca e ela retorna imóveis), porém os dados dele estão congelados em **28/03/2026** — o controle de sincronização (`typesense_sync_state`) também parou em 29/03/2026, com `total_indexed = 0`.
- **Rastros de uso humano do Radar estão mortos:** perfis de busca do lead (último em 23/05), interações com imóveis (último em 30/03) e imóveis indicados (zero registros).
- Os 100 "matches" recentes vêm do motor de match no banco, que não passa pelo Typesense.

Conclusão: o Typesense está sendo pago para servir um índice desatualizado há ~5 meses, consumido apenas por duas telas de baixa utilização no CRM.

## O que fazer

### Fase 1 — Trocar a fonte de busca (antes de cancelar)
Dois pontos consomem o Typesense hoje:

1. **Radar de Imóveis** (aba dentro do modal do lead) — já tem um caminho alternativo de busca direta no banco, usado hoje só como fallback quando o Typesense volta vazio. Passa a ser o caminho único.
2. **Busca por IA da página de Imóveis** (`ai-search-imoveis`) — passa a consultar o catálogo direto no banco, com os mesmos filtros (bairro, faixa de preço, dormitórios, vagas, situação).

Ganho colateral: as duas telas passam a ler o catálogo **atual**, não um índice de março.

### Fase 2 — Validação no preview
Abrir o Radar em um lead real (sem alterar nada) e a busca da página de Imóveis, comparando resultados com o catálogo. Só depois disso o Typesense é considerado dispensável.

### Fase 3 — Desligamento
- Remover as 3 edge functions do Typesense (`typesense-search`, `typesense-sync`, `typesense-admin`) e o botão "Reindexar Typesense" do Painel Admin.
- Remover os segredos `TYPESENSE_HOST` e `TYPESENSE_SEARCH_API_KEY` (e ajustar o `secrets-tripwire`, que hoje espera esses nomes).
- Só então cancelar a assinatura.

## Detalhes técnicos

- Arquivos tocados: `src/components/pipeline/RadarImoveisTab.tsx`, `src/hooks/useTypesenseSearch.ts`, `src/hooks/useAISearch.ts`, `src/lib/typesenseMapping.ts`, `src/pages/AdminPanel.tsx`, `supabase/functions/ai-search-imoveis/index.ts`, `supabase/functions/secrets-tripwire/expected.json`.
- Sem migration: a busca alternativa lê `properties`/`imoveis_catalog`, que já são as tabelas de origem do próprio índice.
- `typesense_sync_state` fica para trás como tabela órfã; pode ser removida numa faxina posterior.

## Ordem

Fase 1 e 2 primeiro, com sua validação no preview. O cancelamento (Fase 3) só depois que as duas telas estiverem rodando sem o Typesense.
