# Conferência e correção de Campanhas × Segmentos da Roleta

## Como funciona hoje (diagnóstico)
- A roleta resolve o segmento de um lead pelo **nome do empreendimento** em `roleta_campanhas` (match parcial: contém/está contido). `pipeline_leads.segmento_id` é cosmético — a distribuição ignora.
- Sem match de campanha: se a origem está em `origens_gerais` (hoje `jetimob, reengajamento`) → distribui sem filtro de segmento; senão → cai em **S3 Avulso**.
- `jetimob_campaign_map` define `empreendimento`+`segmento` na ENTRADA do lead (Meta/Jetimob).
- Fila do CEO = leads `aceite_status='pendente_distribuicao'`; o segmento só é definido no momento do disparo manual.

## Bugs/inconsistências encontrados
1. **Ambiguidade "Vivid Terrace" vs "Terrace"**: o match não prioriza exato. "Vivid Terrace" pode resolver para S2 (Terrace) em vez de S5. Precisa priorizar match exato.
2. **Variantes do Átrio** ("Átrio - Menino Deus", "Átrio - Qualificado v3") não casam com "Átrio - ABF" → caem em S3 Avulso em vez de **S4 Investimento**. Há 1 lead assim na fila do CEO agora.
3. **Casa Tua** está como "Altíssimo" no `jetimob_campaign_map` (deveria ser Produto Foco).
4. **Vértice - Las Casas** está como "Altíssimo" no Jetimob; você definiu que **toda** Las Casas é S2 Médio.
5. Imovelweb/Site hoje caem em S3 só por fallback; você pediu roteamento explícito por origem.

## O que será feito

### 1. Corrigir dados de `roleta_campanhas` (fonte da verdade da roleta)
- **S2 - Médio Padrão**: garantir ativos `Las Casas`, `Ápice Las Casas`, `Terrace` (cobre todas as variantes Las Casas/Ápice/Vértice e Terrace/Terrace-2026 por match parcial).
- **S4 - Investimento**: manter `Átrio - ABF` e `Shift`; **adicionar `Átrio`** (cobre "Átrio - Menino Deus", "Átrio - Qualificado v3", "atrio").
- **S5 - Produto Foco**: manter `Vivid`, `Vivid Terrace`, `Casa Tua`.
- Conferir que não há entrada conflitante empurrando Las Casas/Átrio para outro segmento.

### 2. Corrigir dados de `jetimob_campaign_map` (entrada de leads)
- Casa Tua (2231): segmento → Produto Foco.
- Vértice - Las Casas (3405): segmento → Médio (S2).
- Conferir/alinhar Átrio (3926→Investimento), Shift (3065→Investimento), Terrace (1713→Médio), Vivid Terrace (4076→Produto Foco) — já corretos, validar.

### 3. Ajuste na função `distribuir_lead_atomico` (migration)
- **Priorizar match exato** de empreendimento sobre parcial (`ORDER BY` por igualdade exata e maior comprimento), resolvendo "Vivid Terrace" → S5 corretamente.
- **Roteamento explícito por origem**: se `origem` for Imovelweb/Site → forçar **S3 Avulso** (skip do match de campanha), conforme solicitado.
- Aplicar a mesma priorização de match exato em `distribuir_lead_roleta` (versão legada) por segurança.

### 4. Corrigir leads errados na fila do CEO
- Após adicionar a campanha "Átrio", o lead "Átrio - Qualificado v3" passa a resolver para S4 no próximo disparo. Vou normalizar o `empreendimento` dele para a forma canônica e revisar qualquer outro pendente cujo segmento resolveria errado, ajustando para o correto.

## Validação final
- Rodar consulta de simulação: para cada empreendimento distinto de leads ativos, mostrar o segmento que a roleta resolveria, confirmando S2/S3/S4/S5 conforme sua especificação.
- Confirmar que Imovelweb/Site → S3 e que Vivid Terrace → S5 (não S2).

## Restrições respeitadas
- `roleta_campanhas` permanece a fonte canônica (sem usar `pipeline_leads.segmento_id`).
- Correções de dados via operações de dados; apenas as mudanças de função vão em 1 migration.
