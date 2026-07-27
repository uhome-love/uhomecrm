## Contexto (lido do banco e do código)

**Pipeline de leads** já está no modelo novo: `Novo Lead → Sem Contato → Qualificação → Aquecimento → Visita → Em Negociação (tipo=proposta) → Contrato (tipo=contrato_gerado) → Ganho (tipo=venda)`.

**PDN** já fala a mesma língua: `situacao ∈ (visita_realizada, em_negociacao, contrato, ganho)`.

**Negócios (`negocios`)** é o único fora do padrão: guarda `fase` legada (`novo_negocio, proposta, documentacao, vendido, distrato, perdido`) e sub-status texto livre (`proposta_situacao='aguardando_aceite'` em 301 linhas, `documentacao_situacao='leitura_contrato'` em 301 linhas, `negociacao_situacao` com 5 valores soltos).

Diagnóstico: alinhar `negocios` ao vocabulário canônico que já existe nos outros dois. Nada de inventar taxonomia nova.

## Modelo canônico único

**Fase** — 3 valores, iguais em `pipeline_stages.tipo` (do lead), `negocios.fase` e `pdn_entries.situacao`:

| # | fase (canônica) | pipeline_stages.tipo | pdn situacao   | absorve em `negocios` (legado)   |
|---|-----------------|----------------------|----------------|----------------------------------|
| 1 | `em_negociacao` | `proposta`           | `em_negociacao`| `novo_negocio`, `proposta`       |
| 2 | `contrato`      | `contrato_gerado`    | `contrato`     | `documentacao`                   |
| 3 | `ganho`         | `venda`              | `ganho`        | `vendido`                        |

**Sub-status por fase** (reaproveitando o que já é canônico em `leadHelpers.ts` / `pipeline_leads.flag_status`):

- `em_negociacao` → coluna `negociacao_situacao` (enum novo, **obrigatório**):
  `proposta_enviada, proposta_aprovada, aprovacao_bancaria, correspondente_bancario, aprovacao_proprietario, documentacao_enviada`.
- `contrato` → coluna `contrato_situacao` (nova, enum, **obrigatório**):
  `em_confeccao, gerado, em_leitura`.
- `ganho` → sem sub-status (já tem `data_assinatura` + `vgv_final`).

Sub-status **obrigatório**: FE bloqueia salvar sem escolher; BD tem CHECK "se `fase='em_negociacao'` então `negociacao_situacao IS NOT NULL`" e análogo para contrato. Backfill garante que ninguém entra na constraint com null (todo mundo já cai em um valor padrão via migração).

**Status** — situação do negócio, ortogonal à fase (sem `distrato`, conforme você definiu):

| status      | significado                              | absorve                                              |
|-------------|------------------------------------------|------------------------------------------------------|
| `ativo`     | vivo no board                            | `status='ativo'`                                     |
| `arquivado` | tirado do board (erro/duplicado)         | `status='arquivado'`                                 |
| `perdido`   | não fechou (inclui ex-distratos)         | `status='perdido'` **ou** `fase IN ('perdido','distrato')` |

Regras derivadas:
- Pipeline aberto = `status='ativo' AND fase IN ('em_negociacao','contrato')`.
- VGV assinado do mês = `fase='ganho' AND data_assinatura` no mês (regra preservada — mem://features/negocios/vgv-assinado-fase-vendido).
- Caídos do mês = `status='perdido'` no mês.

Resultado esperado (alinhado ao que você viu no Claude):
```
Em Negociação  ativo:  49 · R$ 20,3 mi
Contrato       ativo:   1
Pipeline aberto: 50 · R$ 20,3 mi
```

## Ordem de execução (cauteloso, sem quebrar nada)

**Regra:** cada migration roda primeiro em modo piloto (`BEGIN;…snapshot;…ROLLBACK;`), você aprova o diff, aí sim COMMIT. Respeitando o teto de 2 migrations/dia em 08–19h BRT (mem://rules/engineering).

### Etapa 1 — Migration 1 (backend, dados + colunas, SEM constraints ainda)

Uma migration só, transacional. Sem CHECK/NOT NULL nesta etapa — só normalização de dados e novas colunas nulas. Isso garante que se algo escapar, nada quebra.

Ações:

1. `ALTER TABLE negocios ADD COLUMN contrato_situacao text NULL`.
2. Backfill de `fase`:
   - `novo_negocio, proposta` → `em_negociacao`
   - `documentacao` → `contrato`
   - `vendido` → `ganho`
   - `perdido` → `fase='em_negociacao'` + `status='perdido'` (exceto se tiver `data_assinatura`, aí vira `ganho` + `status='perdido'`).
   - `distrato` → `fase='ganho'` + `status='perdido'` (sem coluna `distrato`, conforme decidido).
   - `cancelado` (se houver) → mesmo tratamento de `perdido`.
3. Backfill dos sub-status (garante que o CHECK futuro não estoura):
   - Onde `fase (nova) = 'em_negociacao'`:
     - `proposta_situacao='aguardando_aceite'` → `negociacao_situacao='proposta_enviada'`.
     - Se `negociacao_situacao` está null ou texto livre não-canônico → texto atual vai para `observacoes` com prefixo `"[migrado sub-status]"`, e `negociacao_situacao` recebe `proposta_enviada` como padrão seguro.
   - Onde `fase (nova) = 'contrato'`:
     - `documentacao_situacao='leitura_contrato'` → `contrato_situacao='em_leitura'`.
     - Se null → `contrato_situacao='em_confeccao'` (o mais conservador).
4. Preservar `fase_changed_at` (não recalcular).
5. Registrar linha em `ops_events` com contagens antes/depois (`fase`, `status`, sub-status).
6. **Não** dropar colunas legadas (`proposta_situacao`, `documentacao_situacao`) — mantidas por 1 release para reversão. Vão só parar de ser gravadas pelo FE.

Piloto (obrigatório antes do COMMIT): rodar tudo em `BEGIN;…ROLLBACK;` e devolver:
- diff `fase → count` antes/depois,
- diff `status → count` antes/depois,
- amostra de 20 linhas dos textos livres que foram para `observacoes`,
- linhas que ficariam sem sub-status obrigatório (esperado: zero).

Só depois da sua aprovação → COMMIT.

### Etapa 2 — Atualização de triggers/funções server-side (mesma janela, migration curta)

Auditar e ajustar tudo que assumia nomes antigos:

- `sync_lead_stage_on_venda`: trocar `NEW.fase='vendido'` por `'ganho'`.
- `trg_pdn_mirror_negocio`: incluir a matriz nova nas condições (`em_negociacao / contrato / ganho`, `status='perdido'`).
- Funções que criam/atualizam `negocios` a partir do pipeline: usar `fase='em_negociacao'` como default (não `novo_negocio` ou `proposta`).
- Auditar `stalled-deals-notify`, `generate-monthly-report` e RPCs de conversão pipeline→negócio via `rg` nos edge functions.

Sem CHECK constraints ainda.

### Etapa 3 — Frontend (deploy sem migration)

Trocas mecânicas, guiadas pelo grep dos nomes antigos:

- `src/hooks/useNegocios.ts`: reescrever `NEGOCIOS_FASES` para 3 keys (`em_negociacao, contrato, ganho`); remover `NEGOCIO_FASE_PERDIDO`; adicionar `NEGOCIO_STATUS` e helpers `isNegocioAberto / isNegocioGanho / isNegocioPerdido`; importar `NEGOCIACAO_SUBSTATUS` e `CONTRATO_SUBSTATUS` de `leadHelpers.ts` (não duplicar).
- `src/hooks/useNegocioActions.ts`: popup de transição só dispara em `fase='ganho'` (pede assinatura + VGV final). "Marcar perdido" vira ação de **status** com motivo obrigatório (não muda fase).
- Cards e drawer de negócio: dois selects contextuais **obrigatórios** — `negociacao_situacao` na fase 1, `contrato_situacao` na fase 2. Botão "Salvar" desabilitado até escolher. Toast claro se o BE devolver erro de CHECK (fase 4).
- `src/lib/metricDefinitions.ts`: `NEGOCIO_FASES_PROPOSTA` → `['em_negociacao']`; `NEGOCIO_FASES_ASSINADO` → `['ganho']`; `NEGOCIO_FASES_PERDIDO` → mantém para relatórios legados, mas todos os novos filtros usam `status='perdido'`.
- `src/components/dashboard-v4/V4PanelNegocios.tsx`: atualizar `BORDER_BY_FASE` para as 3 fases novas.
- `src/components/central-v2/sections/SectionNegocios.tsx`: KPI "Ativos" = pipeline aberto (fases 1+2 com status ativo). "Caíram" = `status='perdido'` no mês.
- Todo `SELECT`/filtro de negócios: incluir `status='ativo'` por padrão. Aba/filtro "Caídos" = `status IN ('perdido','arquivado')`.
- Arquivos a varrer com grep (`novo_negocio|documentacao|vendido|proposta[^_]|distrato`): `MeusNegocios.tsx`, `components/negocios/NegocioCard.tsx`, `components/pipeline/NegocioCard.tsx`, `NegocioDetailModal.tsx`, `DrawerNegocioTab.tsx`, `AddNegocioDialog.tsx`, `RelatorioConversao.tsx`, `RelatorioNegocios.tsx`, `PdnToolbar.tsx`, `usePdn.ts`, `lib/pdnSyncEngine.ts`, `CeoDashboard.tsx`, `TabEmpresa.tsx`, `useCorretorKpisConquistas.ts`, `usePipeline.ts`, `ranking/v2/RankingNegocios.tsx`, `hooks/useNegociosCount.ts`.
- Ficar de olho em `NEGOCIO_FASES_PROPOSTA` sendo consumido por RPC `get_kpis_por_periodo` / views `v_kpi_negocios`. Se as views projetam `fase` bruta, elas continuam funcionando (só passam a ver os nomes novos). Auditar antes do deploy.

Validação ao vivo (Lucas): abrir PDN, CEO Dashboard, MeusNegocios, RelatorioNegocios e conferir Em Negociação 49 / Contrato 1 / Ganho + VGV batendo.

### Etapa 4 — Migration 2 (endurecer, dia seguinte)

Só depois de 24h com o modelo novo rodando sem incidente:

1. CHECK constraints:
   - `fase IN ('em_negociacao','contrato','ganho')`.
   - `status IN ('ativo','arquivado','perdido')`.
   - `negociacao_situacao IN (...) OR NULL`.
   - `contrato_situacao IN ('em_confeccao','gerado','em_leitura') OR NULL`.
   - CHECK condicional: `(fase='em_negociacao' AND negociacao_situacao IS NOT NULL) OR fase<>'em_negociacao'` — idem contrato. (Só cria depois que a Etapa 1 já garantiu backfill; risco = 0.)
2. Cria `v_negocios_pipeline_kpi` como fonte única de KPIs (por corretor / gestor / total; pipeline aberto, assinados_mes, caidos_mes).
3. Repoint dos hooks pesados (`useDashboardGerenteV4Kpis`, `useCorretorKpisConquistas`, `SectionNegocios`) para a nova view.

### Etapa 5 — Limpeza (backlog, não urgente)

Depois de 1 release estável, dropar `proposta_situacao` e `documentacao_situacao` de `negocios`. Migration separada, com aviso.

## Guardrails contra quebrar nada

- Cada migration em `BEGIN;…ROLLBACK;` primeiro, com diff pra você aprovar. COMMIT só com go verbal.
- Colunas legadas mantidas por 1 release; código FE só para de gravá-las (leitura ainda tolera).
- CHECK constraints ficam na Etapa 4, um dia depois — não vão à produção junto com o backfill.
- `status='perdido'` absorve `distrato` (não perdemos histórico, só simplificamos vocabulário).
- Todos os `SELECT`s que hoje não filtram `status` continuam funcionando; ganham só filtro extra opcional.
- Rollback simples: cabeçalho da migration tem os UPDATEs reversos comentados (padrão vigente).

## Fora de escopo

- Não mexer no funil de leads (`pipeline_stages` já está no modelo certo).
- Não mexer em `oportunidades`, `pos_vendas`, `intermediacoes`.
- Não introduzir fase separada para "aprovação bancária" — vive como `negociacao_situacao` dentro de `em_negociacao`.
- Não criar fase/status `distrato`.
