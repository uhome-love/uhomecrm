# Auditoria PDN x Pipeline "Em Negociação" — diagnóstico e plano de correção

## O que foi auditado (dados reais de produção, hoje)

Pipeline (leads não arquivados nas etapas de negócio):
- Pós-Visita: 61 · Em Negociação: 30 · Contrato: 3 · Ganho: 77
- Todos os 33 leads em Em Negociação/Contrato têm corretor preenchido e todos os corretores estão em `team_members` — **o escopo do gestor não é a causa**.

Overlay do gestor (`pdn_entries`):
- 20 linhas com `oculto = true`
- 33 linhas com `caiu = true` (2 delas com mês 2026-03)
- 4 linhas com `grupo_override` preenchido

## Causa confirmada do caso relatado

O lead **Henrique Lohse** (etapa "Em Negociação", corretor Larissa Barbosa, não arquivado) tem uma entrada em `pdn_entries` com `oculto = true`, criada em 21/07. O PDN filtra `rows = allRows.filter(r => !r.oculto)`, então ele some do Kanban mesmo continuando ativo no pipeline. Para comparação: **Daniel Siqueira** tem entrada sem `oculto` e aparece normalmente.

Ou seja: o sumiço não é falha de query nem de RLS — é o overlay "Removido da planilha" grudado no negócio para sempre.

## Bugs estruturais encontrados (além do caso pontual)

1. **`oculto` é permanente e cego ao ciclo de vida.** Uma vez removido da planilha, o negócio nunca volta sozinho — nem quando muda de etapa, nem quando vira mês novo, nem quando o corretor registra atividade. O único caminho de volta é o painel "Removidos da planilha", que fica escondido atrás de um toggle.
2. **`oculto` / `caiu` atravessam meses.** O overlay ligado a negócio/lead é carregado sem filtro de mês (só as linhas manuais filtram por `mes`). Uma marcação feita em julho continua escondendo/derrubando o negócio em agosto, setembro etc. Já existem 2 entradas com mês `2026-03` marcadas como caiu.
3. **Leads arquivados nas etapas de negócio somem.** 4 leads arquivados estão parados em Pós-Visita/Em Negociação e 6 negócios com `fase` ativa estão em lead arquivado — o PDN filtra `arquivado = false` e não sinaliza nada.
4. **Divergência negócio x etapa do lead.** 8 negócios com `fase in (em_negociacao, contrato)` e `status = ativo` estão em leads que já estão em outra etapa do pipeline. O PDN segue a etapa do lead, `Vendas/Negócios` seguem `negocios.fase` → contagens diferentes entre telas.
5. **1 negócio ativo sem `pipeline_lead_id`** — invisível no PDN em qualquer cenário (o fallback de mês só cobre `fase = 'ganho'`).
6. **Sem visibilidade do que foi escondido.** Não há badge/contador permanente nem motivo/autor/data no card oculto, então o gestor não descobre que o número está incompleto.

## Plano de correção (em fases, validando cada uma)

### Fase 1 — Desentupir e dar visibilidade (frontend, sem migration)
- Aplicar `oculto` e `caiu` **somente ao mês da entrada**: linhas ligadas a negócio/lead passam a considerar o overlay do mês selecionado; marcações de meses anteriores deixam de esconder o negócio no mês corrente.
- Auto-restaurar quando o negócio **muda de etapa** depois da data em que foi ocultado (`stage_changed_at > updated_at` do override) — negócio que andou volta para a planilha.
- Header do PDN: badge fixo `N ocultos` e `N caídos` sempre visível (não só quando o painel está aberto), com clique abrindo o painel.
- No painel "Removidos da planilha": mostrar etapa atual, quem ocultou e quando, além do botão Restaurar.

### Fase 2 — Painel de divergências (frontend)
Novo bloco "Divergências" no PDN listando, com ação de correção:
- negócios ativos em lead arquivado (6);
- negócios com `fase` diferente da etapa do lead (8);
- negócios ativos sem lead vinculado (1);
- leads em etapa de negócio sem registro em `negocios`.

### Fase 3 — Higienização dos dados (após aprovação, um item por vez)
- Revisar caso a caso as 20 entradas `oculto` e as 31 `caiu` de 2026-07 e limpar as que já não fazem sentido.
- Reconciliar os 8 negócios com fase divergente e os 6 em leads arquivados.

## Detalhes técnicos

- Arquivos-alvo da Fase 1: `src/hooks/usePdn.ts` (montagem de `allRows`, índices `overrideByNegocio` / `overrideByLead` passam a considerar `mes`), `src/pages/PdnGestor.tsx` (badges e painel de ocultos), `src/components/pdn/PdnHeader.tsx`.
- Nenhuma migration nas Fases 1 e 2; nenhuma escrita em `pipeline_leads` ou `negocios` — o PDN continua sendo overlay puro.
- Fase 3 é operação de dados (tool de insert/update), executada só com aprovação item a item.
