# Vendas de agosto não aparecem em Vendas Realizadas

## O que a auditoria mostrou (só leitura, nada alterado)

Hoje **não existe nenhuma venda com data de assinatura em agosto/2026** no banco. A tela está correta: ela lista negócios com fase "ganho" e data de assinatura dentro do mês. Sem data de assinatura em agosto, nada aparece.

As duas vendas do The Arch estão em situações diferentes:

**1. Venda da Larissa — Rafael Andrade (The Arch, R$ 370.000)**
- O lead **foi movido para Ganho no pipeline em 04/08** pela Larissa.
- Mas o negócio ligado a ele ficou em **fase "contrato", status "arquivado" e sem data de assinatura**.
- Causa: até a noite de 05/08 existia um erro no gatilho do banco que carimba o gerente da equipe (o mesmo que travou a venda da Renata). Quando a Larissa moveu o card em 04/08, a gravação do negócio falhou silenciosamente — o card mudou de coluna, o negócio não. O gatilho já foi corrigido, mas esse registro ficou para trás. O status "arquivado" também exclui o negócio de qualquer visão.

**2. Venda da Thalia (The Arch)**
- **Não existe nenhum registro dela em Ganho/Contrato em agosto.** Os únicos negócios ativos da Thalia são Susana Silva (Shift, em negociação) e Guilherme Fehlauer (em negociação, R$ 360.000).
- Ou seja: a venda não chegou a ser registrada no CRM — ou foi tentada e não gravou, sem deixar histórico de movimentação para Ganho.

## O que proponho fazer

### Passo 1 — Regularizar a venda da Larissa
Ajustar o negócio do Rafael Andrade para: fase **ganho**, status **ativo**, data de assinatura **conforme a data real**, VGV R$ 370.000, com o gerente/equipe carimbado. Assim ela entra em Vendas Realizadas de agosto, no VGV do mês e no ranking.

### Passo 2 — Registrar a venda da Thalia
Preciso dos dados reais para lançar (não vou inventar): nome do cliente, unidade, VGV e data da assinatura. Com isso eu crio/ajusto o negócio e movo o lead para Ganho.

### Passo 3 — Rede de proteção (evitar que se repita)
Auditar todos os leads que estão na coluna **Ganho** do pipeline mas cujo negócio não está em fase "ganho" ou está sem data de assinatura / com status arquivado, e regularizar em lote. Depois disso, avaliar um aviso na tela quando alguém mover para Ganho e a gravação do negócio falhar, em vez de falhar em silêncio.

## Detalhes técnicos
- Tela: `src/pages/VendasRealizadas.tsx` filtra `negocios` por `fase = 'ganho'` + `data_assinatura` no intervalo do mês. Nenhuma mudança de código é necessária nela.
- Correções dos passos 1 e 3 são alterações de dados (DML) em `public.negocios`; o passo 3 pode incluir também `pipeline_leads` desalinhados.
- O gatilho `public.stamp_negocio_equipe_gerente()` já foi corrigido em 05/08 (`tm.corretor_id` → `tm.user_id`) — a causa raiz está fechada, falta só limpar o rastro.

## Pendente de você
- Data real da assinatura da venda do Rafael Andrade (uso 04/08 se não houver outra).
- Dados da venda da Thalia: cliente, empreendimento/unidade, VGV e data de assinatura.
