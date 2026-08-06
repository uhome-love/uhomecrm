# Remover a venda do Diogo Andrade (junho) e tratar como desistência

## O que foi encontrado

O negócio existe e já está marcado como desistência pela metade:

- Cliente: **Diogo Andrade** · Corretora: **Adriana Kaiser** · Empreendimento: **Terrace v2 - Qualificado**
- Data de assinatura: **30/06/2026** · VGV: **R$ 410.000**
- Situação atual: fase = `ganho`, status = `perdido`, motivo = "Desistência após assinatura"

A regra oficial (VGV fonte única) é `fase='ganho' AND status='ativo'`, então nos relatórios de VGV ele já não conta. Porém a tela **Vendas Realizadas** consulta apenas `fase='ganho'` + data de assinatura, **sem olhar o status** — por isso ele continua aparecendo como venda de junho.

Ele é o único caso com data de assinatura entre os 7 negócios em `ganho` + `perdido`, então nenhum outro registro some da lista com essa correção.

## O que será feito

### 1. Regularizar o registro do Diogo Andrade
Ajustar o negócio para refletir a desistência:
- fase: `ganho` → `contrato` (o contrato chegou a existir, mas a venda não se concretizou)
- status: permanece `perdido`
- data de assinatura: limpa (deixa de existir venda assinada em junho)
- VGV final: limpo; motivo da queda mantido como "Desistência após assinatura"

Resultado: sai de Vendas Realizadas, sai do VGV de junho da Adriana e do Terrace, e fica registrado como desistência.

### 2. Fechar a brecha na tela Vendas Realizadas
Adicionar o filtro de status ativo nas consultas de venda que hoje olham só a fase, para que qualquer desistência futura suma automaticamente da lista:
- `src/pages/VendasRealizadas.tsx` (consulta principal + as consultas de parceria)
- `src/hooks/useRankingsData.ts` (rankings de vendas)
- `src/hooks/usePdn.ts` (vendas do mês que alimentam o PDN)
- `src/hooks/useCorretorKpisConquistas.ts` e `src/pages/CheckpointGerente.tsx` (KPIs de venda do corretor/gestor)

## Detalhes técnicos

- Correção de dado via ferramenta de dados (UPDATE em `public.negocios`, id `c4f6ec9e-334d-4e0d-9f38-517a95bf55f5`). Sem migration, sem mudança de schema.
- O trigger `trg_enforce_data_assinatura_ganho` só bloqueia `ganho` + `ativo`; a atualização passa normalmente.
- O lead do pipeline continua onde está (etapa Aquecimento) — nenhuma alteração no pipeline, apenas no registro de negócio.
- Nas consultas de frontend, o filtro adicionado é `status = 'ativo'`, alinhado à regra VGV fonte única já usada nas RPCs.

## Validação

- Conferir Vendas Realizadas em junho/2026: Diogo Andrade não aparece e o total do mês cai R$ 410.000.
- Conferir Performance/Ranking da Adriana em junho: venda e VGV reduzidos de acordo.
- Conferir que as demais vendas de junho continuam intactas.
