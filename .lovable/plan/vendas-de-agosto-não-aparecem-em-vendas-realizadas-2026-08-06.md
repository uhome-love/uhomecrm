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
Ajustar o negócio do Rafael Andrade para: fase **ganho**, status **ativo**, data de assinatura **04/08** (data em que o card foi movido para Ganho — me diga se a data real for outra), VGV R$ 370.000, com o gerente/equipe carimbado. Assim ela entra em Vendas Realizadas de agosto, no VGV do mês e no ranking.

### Passo 2 — Venda da Thalia
Aguardar ela registrar no CRM. Nada será lançado por mim.

### Passo 3 — Data de assinatura obrigatória no Ganho (a trava definitiva)
Hoje a obrigatoriedade só existe na tela (o modal de "Confirmar Ganho" já exige data, VGV, empreendimento e unidade). Mas outros caminhos gravam Ganho sem passar por lá — arrasto do card, sincronização do PDN, ajustes diretos — e alguns preenchem a data automaticamente com "hoje", o que também mascara erro.

Proponho travar no banco:
- Um gatilho de validação em `negocios`: **nenhum negócio pode ficar em fase "ganho" sem data de assinatura preenchida** — a gravação é recusada com mensagem clara ("Informe a data de assinatura para marcar o negócio como Ganho").
- Tratar esse erro na interface, mostrando a mensagem ao corretor em vez de falhar em silêncio.
- Remover o preenchimento automático de "hoje" nos caminhos que hoje chutam a data (mover fase no drawer, board e PDN): passa a abrir o modal de Ganho pedindo a data real.
- Antes de ligar a trava, regularizar os negócios já em Ganho sem data (levantamento e correção em lote), senão qualquer edição neles passa a falhar.

### Passo 4 — Rede de proteção
Auditar leads que estão na coluna **Ganho** do pipeline mas cujo negócio não está em fase "ganho", está arquivado ou sem data de assinatura, e regularizar em lote.

## Detalhes técnicos
- Tela: `src/pages/VendasRealizadas.tsx` filtra `negocios` por `fase = 'ganho'` + `data_assinatura` no intervalo do mês. Nenhuma mudança de código é necessária nela.
- Trava: trigger `BEFORE INSERT OR UPDATE` em `public.negocios` (não CHECK constraint, seguindo a regra do projeto) validando `fase = 'ganho' → data_assinatura IS NOT NULL`.
- Caminhos que hoje preenchem data automática: `src/hooks/useNegocios.ts` (`moveFase`), `src/hooks/useNegocioActions.ts` (`moveFase`), `src/lib/pdnSyncEngine.ts` (linha ~211). O modal `FaseTransitionModal.tsx` já valida corretamente.
- Correções de dados (passos 1, 3 e 4) são DML em `public.negocios`.
- O gatilho `public.stamp_negocio_equipe_gerente()` já foi corrigido em 05/08 (`tm.corretor_id` → `tm.user_id`) — causa raiz fechada, falta limpar o rastro.

