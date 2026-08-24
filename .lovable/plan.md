# Filtro de data de entrada no Pipeline

## Situação atual (verificada)

O filtro já existe, mas está escondido e com falhas:

- Em "Filtros avançados" existe o bloco **Período de entrada** com as opções Hoje / Esta semana / Este mês / Personalizado.
- Ele filtra pela data de criação do lead (`created_at`) — que é de fato a data de entrada no CRM (não existe coluna `data_lead` em `pipeline_leads`).
- Problemas encontrados:
  1. Está enterrado dentro do popover de filtros avançados; quem não abre nem sabe que existe.
  2. No modo Personalizado, o fim do intervalo usa 00:00 do dia final — o último dia fica de fora.
  3. O chip que aparece no header diz só "Período", sem mostrar qual período está ativo.
  4. Os cortes de dia/semana/mês usam o fuso do navegador, não BRT explícito.

## O que será feito

1. **Filtro visível no header do Pipeline**: um seletor rápido "Entrada" ao lado dos controles atuais, com Hoje, 7 dias, 30 dias, Este mês e Personalizado (intervalo de datas). Continua sincronizado com o mesmo estado dos filtros avançados — mudar num lugar reflete no outro.
2. **Correção do intervalo personalizado**: passa a incluir o dia final inteiro (até 23:59:59).
3. **Cortes em BRT**: hoje/semana/mês calculados no fuso de Brasília, usando o helper de tempo já existente no projeto.
4. **Chip informativo**: em vez de "Período", o chip mostra o valor ativo (ex.: "Entrada: Hoje", "Entrada: 01/08–15/08") e permite remover com um clique.
5. **Contagem visível**: o cabeçalho já mostra o total de leads filtrados; será mantido para o usuário conferir quantos entraram no período.

Nada muda no banco, nas políticas de acesso nem nas regras de negócio — é só apresentação e filtragem no front.

## Detalhes técnicos

- `src/components/pipeline/PipelineAdvancedFilters.tsx`: ajustar `applyPipelineFilters` (bloco `periodoEntrada`) para usar limites BRT e `endOfDay` no custom; adicionar as opções "7 dias" e "30 dias".
- `src/components/pipeline/PipelineHeader.tsx`: novo seletor compacto de entrada (Popover + botões + Calendar `mode="range"` com `pointer-events-auto`), lendo/escrevendo `filters.periodoEntrada`, `periodoCustomStart`, `periodoCustomEnd`; melhorar o rótulo do chip ativo.
- Datas formatadas com os helpers de `src/lib/brtTime.ts`.
- Sem alteração em `PipelineKanban.tsx` além do repasse já existente de `filters`.

## Validação

Testar no preview: aplicar Hoje / 7 dias / 30 dias / Personalizado, conferir a contagem de cards, remover o chip e confirmar que o board volta ao estado completo; conferir que o filtro persiste ao trocar de aba/visão.
