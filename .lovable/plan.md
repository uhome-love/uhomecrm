# Auditoria e limpeza do "+ Filtros" do Pipeline

## O que a auditoria encontrou (verificado no código e nos dados)

Painel: `PipelineAdvancedFilters.tsx` (Sheet "+ Filtros"), aplicado por `applyFilters` em `PipelineKanban.tsx`.

Filtros que funcionam corretamente hoje:
- Etapas do funil, Origem do lead, Empreendimento, Dias sem ação, Visita marcada, Status do lead (em dia / atrasado / desatualizado), Supervisão gerente (Todos / Sem gerente / Com gerente).

Filtros quebrados ou enganosos:

1. **Temperatura** — as opções são Quente/Morno/Frio/Gelado, mas no banco 1.053 dos 1.652 leads ativos estão como `nao_definida` e 10 como `muito_quente`. Como o código só cai no cálculo automático quando o campo está vazio, `nao_definida` nunca casa com nenhuma opção: filtrar por temperatura some com a maioria dos leads e "Gelado" nunca retorna nada (valor inexistente no banco).
2. **Supervisão gerente → "Críticos (sem gerente)"** — filtra por `complexidade_score >= 40`, campo que sequer é buscado na consulta do pipeline. Resultado sempre vazio.
3. **Período de entrada** — o intervalo Personalizado corta o dia final às 00:00 (perde o último dia) e os cortes de hoje/semana/mês usam o fuso do navegador em vez de BRT.
4. **Corretor responsável** — duplica o filtro de corretor que já existe no cabeçalho do pipeline; os dois podem ficar em desacordo e confundir.
5. **Segmento** — só 578 de 1.652 leads têm segmento; funciona, mas precisa deixar claro que o restante fica de fora.
6. **Código morto** — campos legados `scoreMin` e `slaStatus` na interface de filtros e vários imports não usados.

## O que será feito

1. **Temperatura corrigida**: opções passam a ser Muito quente / Quente / Morno / Frio + "Sem temperatura definida"; o cálculo automático também passa a valer para leads `nao_definida`, para nunca haver opção que retorna zero por defeito de dado. "Gelado" sai.
2. **"Críticos (sem gerente)" removido** do seletor de supervisão (deixa Todos / Sem gerente / Com gerente, que funcionam).
3. **Período de entrada arrumado e ampliado**: Hoje, 7 dias, 30 dias, Este mês e Personalizado; intervalo personalizado incluindo o dia final inteiro; todos os cortes em BRT.
4. **Corretor**: removido do "+ Filtros" para gestores (fica só o filtro do cabeçalho, que é o oficial) — evita dois controles concorrentes.
5. **Segmento**: mantido, com rótulo indicando que só filtra leads já segmentados.
6. **Presets revisados**: os três atalhos salvos passam a usar apenas filtros que funcionam.
7. **Limpeza**: remoção dos campos legados e imports mortos, e o contador de filtros ativos passa a refletir exatamente os filtros existentes.
8. **Chips do cabeçalho**: cada filtro ativo mostra o valor (ex.: "Entrada: Hoje", "Temperatura: Quente") e pode ser removido individualmente.

Nada muda no banco, nas políticas de acesso ou nas regras de negócio — só a camada de filtro/apresentação.

## Detalhes técnicos

- `src/components/pipeline/PipelineAdvancedFilters.tsx`: ajustar `PipelineFilters` (remover `scoreMin`/`slaStatus`), `getCalcTemp` (usar também quando `temperatura === "nao_definida"`), bloco `periodoEntrada` em `applyFilters` (BRT + `endOfDay`), remover ramo `criticos` e a seção de corretor, atualizar `countActiveFilters` e os `PRESETS`; limpar imports.
- `src/components/pipeline/PipelineHeader.tsx`: rótulos dos chips ativos com o valor selecionado.
- Datas via helpers de `src/lib/brtTime.ts`.
- Filtros salvos no localStorage: leitura tolerante a chaves antigas para não quebrar o que o usuário já salvou.

## Validação

No preview: abrir "+ Filtros", aplicar um a um (temperatura, etapa, origem, empreendimento, dias sem ação, período de entrada, visita, status, supervisão) conferindo a contagem de cards a cada um; testar combinação de dois filtros, "Limpar tudo", salvar/aplicar/excluir um filtro salvo e a remoção pelos chips.
