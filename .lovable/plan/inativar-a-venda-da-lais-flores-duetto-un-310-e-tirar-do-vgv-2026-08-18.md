# Inativar a venda da Lais Flores (Duetto un. 310) e tirar do VGV

## O que os dados mostram

Negócio encontrado e confirmado:

- Cliente **Lais Flores** · Unidade **310** · Empreendimento **Duetto** · Corretora **Larissa Barbosa**
- VGV estimado e final: **R$ 380.000** · Data de assinatura: **12/08/2026**
- Situação hoje: fase `ganho`, status `ativo` — ou seja, está contando no VGV de agosto.
- O lead do pipeline está na etapa **Ganho**, não arquivado, vinculado a esse negócio.

## O que será feito

### 1. Regularizar o negócio (queda)
- fase: `ganho` → `contrato` (chegou até contrato, mas não se concretizou)
- status: `ativo` → `perdido`
- data de assinatura: limpa
- VGV final: limpo (mantém `vgv_estimado` só como referência histórica)
- motivo da queda: **"Desistiu do negócio"**

Resultado: sai do VGV de agosto (regra VGV fonte única = `ganho` + `ativo`), sai de Vendas Realizadas, sai do ranking da Larissa e do Duetto.

### 2. Inativar o lead definitivamente
- Sai da etapa Ganho, `arquivado = true`, `negocio_id` limpo
- `tipo_descarte = 'definitivo'` e `motivo_descarte = "Inativado: desistiu do negócio"`
- Fica fora do pipeline, da roleta, da oferta ativa e do reengajamento

### 3. Registrar no histórico
Inserir o movimento em `pipeline_historico` (Ganho → inativado, motivo desistência), para ficar rastreável e permitir reverter se necessário.

## Detalhes técnicos

- Alteração de dados apenas (ferramenta de dados): `UPDATE public.negocios` id `dc692fcb-eb48-4674-89b6-d40d16cc71ec` e `UPDATE public.pipeline_leads` id `e2d0d855-bf99-4839-a61a-8e52905cbe3c`. Sem migration, sem mudança de schema e sem mexer em código.
- O trigger que exige `data_assinatura` só bloqueia `ganho` + `ativo`; como a fase muda para `contrato` e o status para `perdido`, a atualização passa.

## Validação

- Vendas Realizadas de agosto/2026: Lais Flores não aparece e o total do mês cai R$ 380.000.
- Performance/Ranking da Larissa em agosto: uma venda e R$ 380.000 a menos.
- Pipeline com filtro Larissa: o lead da Lais Flores não aparece mais em nenhuma coluna nem no filtro "🏆 Ganhos".
- Conferir que nenhuma outra venda de agosto foi afetada.
