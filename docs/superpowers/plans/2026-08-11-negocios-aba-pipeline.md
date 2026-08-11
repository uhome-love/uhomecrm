# Aba Negócios no Pipeline — Plano Completo (viabilidade + execução)

> Plano definitivo da aba de Negócios. Fluxo travado com o Lucas (11/08). Não refazer:
> as decisões estão fechadas. Fundação de dados primeiro, camada de experiência depois.

**Goal:** Transformar Negócios numa **aba do próprio pipeline** (não página nova), com o fluxo comercial real da Uhome em colunas, gerente e corretor no mesmo lugar, header limpo, sobre **uma fonte única** de dados — pra aumentar conversão e organização sem estressar o time.

**Architecture:** O pipeline já tem sistema de abas (`PipelineTabMode`). Negócios entra como um **novo modo** (`"negocios"`) ao lado de `"kanban"` (leads) — o toggle **🌱 Leads | 💼 Negócios** é a "divisão de momento". Colunas do modo negócio = passos comerciais reais, derivados do **`flag_status` do lead** (fonte única). A PDN vira **lente Equipe** e é aposentada.

**Tech Stack:** React 18 + TS + Tailwind + shadcn + Supabase. Bun 1.3.14. Deploy: `git push origin feat/nova-gestao:main`.

## Global Constraints
- **Uma fonte de dados por dimensão** (não recriar 2 pipelines): etapa mora no lead (`stage_id`); sub-status/passo no `flag_status` (enum); VGV/assinatura em `negocios`. `negocios.*_situacao` = lixo de backfill → aposentar.
- **Adoção = parecer o pipeline.** Mesmo card, mesmo modal, mesmo drawer. Toda "tela nova diferente" morreu.
- **BRT** em toda lógica temporal (`@/lib/brtTime`).
- **Coordenar com o Lovable:** `git fetch` + merge antes de publicar, nunca force-push.
- **Máx 2 migrations/dia, 08–19h BRT**, 1 mudança por rodada, validar no preview antes de publicar.
- **Não recriar** triggers de criação de negócio na visita (removidos de propósito).
- Preview isolada existe: `/negocios-preview` (admin), `NegociosWorkspace.tsx` + `useNegociosBoard.ts` — read-only, base do design.

---

## 1. Estudo de viabilidade (verificado no código)

| Pergunta | Achado real | Veredito |
|---|---|---|
| Dá pra ser aba no pipeline? | Pipeline **já tem abas**: `PipelineTabMode = "kanban" \| "time" \| "equipes"`, `activeTab`/`setActiveTab`, `roleTabs` por papel (`PipelineHeader.tsx`). | ✅ Natural — Negócios é +1 modo |
| Dá pra reusar card/modal/drawer? | `CardMinimal`, `PipelineLeadDetail` (modal), `DrawerNegocioTab`, `RegistrarAtividadeModal`, `CriarLembreteModal` já existem e são reusáveis. Preview já abre o modal real via `?lead=`. | ✅ Reuso total |
| A fonte de dados aguenta? | Sub-status real vive no `flag_status` (proposta_solicitada/enviada/aprovada, documentacao_enviada, aprovacao_bancaria/proprietario, em_confeccao, gerado, leitura). `negocios` = VGV/assinatura. | ✅ Fonte única viável |
| O que trava hoje? | `negocios.*_situacao` (313 backfills iguais), fase que descola do stage (22 divergências), VGV furo (`vgv_final` sempre em `pdnSyncEngine.ts:305`). | ⚠️ Fundação Base Única resolve |
| Risco de peso/lentidão? | `PipelineBoard.tsx` (1169 linhas) é pesado. O modo negócio deve **filtrar as mesmas queries** (não duplicar carga) e lazy-render colunas. | 🟡 Cuidado de implementação (não de produto) |

**Conclusão:** viabilidade **alta**. O caminho "aba" encaixa na arquitetura existente e reduz superfície (aposenta a PDN). O único risco é técnico (performance do board pesado), mitigável.

---

## 2. O fluxo canônico (travado com o Lucas)

**Momento Lead** (modo Leads): Novo → Sem Contato → Qualificação → Aquecimento → Visita → **Pós-Visita**.
**Momento Negócio** (modo Negócios), nasce no "Virar negócio":

| Coluna | Sub-status (micro) | Regra |
|---|---|---|
| **Pós-Visita** | interesse alto/médio/baixo · "vamos reservar?" | entrada; botão **Virar negócio** |
| **Documentação** | reserva unidade → pega docs → manda p/ aprovação (cadastro/crédito) → aprovado | nasce o negócio |
| **Proposta** | monta proposta (entrada % + financiado) → aprovação (**banco ou construtora**) → aprovada | **VGV obrigatório** |
| **Contrato** | em confecção → gerado → lê/valida/dúvidas → assinado | — |
| **Ganho** | assinado **+ pago** → consolidado | trava: `data_assinatura` + pagamento |

**Saídas:** ↩️ Regredir → **Aquecimento** (histórico + motivo) · 🗑️ Descartar (distrato + motivo) · 📦 Inativar.
**Gerente co-dirige** (reserva, aprovações) via lente Equipe. **Mês a mês com carry-over** (aberto atravessa o mês; "fechado" = assinatura no mês).

---

## 3. Header limpo (fim da poluição)

**Hoje** (`PipelineHeader.tsx`, 793 linhas) o header amontoa: busca + `PipelineFiltroBadges` + `PipelineSortDropdown` + select de corretor + select de gestor + `PipelineScopeBadge` + modo seleção + HOMI + tabs + faixa "Filtros ativos". Poluição.

**Alvo — um toolbar de 1 linha, calmo:**
```
[🌱 Leads | 💼 Negócios]   [🔎 busca]        [Filtros ▾]  [Ordenar ▾]  [⋯]
```
- **Toggle de momento** (Leads/Negócios) — o único elemento sempre visível à esquerda.
- **Busca** — inline, discreta.
- **"Filtros ▾"** — UM popover que reúne temperatura/segmento/saúde/em-risco (hoje espalhados em badges). Mostra um contador quando ativo ("Filtros · 2").
- **"Ordenar ▾"** — o sort atual, já com legenda.
- **"⋯"** (overflow) — o pouco usado: corretor/gestor (só gestor/CEO), modo seleção, atualizar, HOMI.
- **Chips de filtro ativo** só aparecem quando há filtro (removíveis), abaixo, discretos.
- **Regra:** no modo Negócios, os filtros trocam pra os do negócio (passo, VGV, parado, corretor) — mesmo componente, opções diferentes.

Ganho: menos ruído, mesma potência, um lugar previsível pra achar filtro.

---

## 4. Estrutura de arquivos

**Fundação (dados):**
- `supabase/migrations/*` — Base Única (ver [uhomesales-negocio-base-unica-plano] na memória): fase = espelho estrito (trigger), `flag_status.passo_negocio` como enum ordenado, predicado único de venda, deprecar `negocios.*_situacao`, corrigir VGV.
- `src/lib/negocioPasso.ts` — **novo**: enum canônico dos passos + `passoDe()` + `detalheDe()` (migra o que está no preview `useNegociosBoard`).

**Experiência (aba no pipeline):**
- `src/components/pipeline/PipelineHeader.tsx` — **modificar**: toggle Leads/Negócios; consolidar filtros no "Filtros ▾" + overflow.
- `src/pages/PipelineKanban.tsx` — **modificar**: `activeTab` ganha modo `"negocios"`; alterna as colunas (stages de negócio) e o data-source.
- `src/components/pipeline/PipelineBoard.tsx` — **modificar/estender**: renderizar colunas por passo quando modo=negócios (reusa `CardMinimal`).
- `src/components/pipeline/CardMinimal.tsx` — **estender**: variação "negócio" (VGV + detalhe do passo) sem quebrar a de lead.
- `src/components/pipeline/PipelineStageTransitionPopup.tsx` — **modificar**: ação **Virar negócio** no Pós-Visita (captura VGV, gradua). Já existe `criarNegocio` extraData.
- Ações **Regredir/Descartar/Inativar** — reusar `PdnRegredirDialog`, `DiscardLeadDialog` no ⋮ do card negócio.
- `PipelineLeadDetail.tsx` — **modificar**: histórico em 2 capítulos (lead colapsado + negócio ativo).

**Gestão (lente Equipe = PDN):**
- `useNegociosBoard.ts` → evoluir pra hook de produção (escopo por lente, mês+carry-over, forecast, "precisa de você").
- `/pdn` → redirect pra pipeline modo Negócios (aposenta `PdnGestor` aos poucos).

---

## 5. Fases de execução (1 por rodada, validar no preview, publicar seguro)

### Fase 0 — Baseline + preview (✅ feito)
Preview `/negocios-preview` com 5 colunas reais, modal real, lente Meus/Equipe. Baseline Base Única medido (6 fantasmas, 6 distratos, 16 VGV-furo, 22 divergências).
**Aceite:** já validado na tela com dado real.

### Fase 1 — Fundação Base Única (dados) — *pré-requisito de tudo*
Migrations em sequência (máx 2/dia): fase = espelho estrito (trigger lead→negócio); `flag_status.passo_negocio` enum ordenado (backfill do `status_negociacao`/`status_contrato`); predicado único de venda nas 3 views; deprecar `negocios.*_situacao`; corrigir VGV (`pdnSyncEngine.ts:305`). Ganho = `data_assinatura` (+ decisão sobre "pago").
**Validação:** reconciliação → 0; PDN/KPI/Vendas mostram o mesmo nº de vendas do mês; VGV editado em negociação grava `vgv_estimado`.
**Aceite:** baseline da Fase 0 zera (0 fantasma, 0 divergência).

### Fase 2 — Negócios como aba no pipeline (UI núcleo)
`activeTab="negocios"` no pipeline; colunas = passos (Pós-Visita → Documentação → Proposta → Contrato → Ganho); `CardMinimal` variação negócio (VGV + detalhe); toggle Leads/Negócios no header.
**Validação (preview→pipeline real):** trocar de aba mantém contexto; cards no visual do pipeline; clicar abre o modal real; performance ok (sem duplicar carga).
**Aceite:** corretor navega Leads↔Negócios sem sentir "outra tela".

### Fase 3 — Header limpo
Consolidar filtros no "Filtros ▾" + overflow "⋯"; toggle de momento à esquerda; chips de filtro ativo só quando houver. Filtros trocam por modo (lead vs negócio).
**Validação:** header numa linha; achar filtro em ≤1 clique; nada some.
**Aceite:** Lucas aprova "limpo" no preview.

### Fase 4 — Ações do fluxo (o que faz vender)
**Virar negócio** no Pós-Visita (captura VGV, gradua → Documentação). **Regredir**→Aquecimento (motivo), **Descartar** (motivo), **Inativar** no ⋮. **Drawer 2 capítulos** (lead colapsado + negócio). **Avançar passo** com disciplina (VGV obrigatório na Proposta; Ganho exige assinatura+pago).
**Validação:** fluxo ponta a ponta num lead teste (pós-visita→…→ganho) + regredir + descartar; depois apagar.
**Aceite:** um negócio percorre todos os passos e sai pelas 3 saídas corretamente.

### Fase 5 — Lente Equipe = PDN (gerente)
Escopo Equipe no hook; forecast + meta do mês (carry-over); **"Precisa de você"** (parados/sem VGV/sem próximo passo/aprovação); **avisar corretor** (reusa o mecanismo `pdn_entries`/PdnLeadDrawer); resumo por corretor; placar do gargalo pós-visita→negócio. `/pdn` → redirect.
**Validação:** números batem com a antiga PDN (mesmo dado, fonte única); gerente cutuca e o corretor recebe.
**Aceite:** gerente gere só na aba Negócios; PDN aposentada sem perda.

### Fase 6 — Diretora comercial + disciplinas
Visão consolidada (todas equipes): funil de conversão com vazamentos, ranking, ticket médio, ciclo (dias pós-visita→ganho), alertas (grandes parados, distratos com motivo). SLA por passo. Confirmação de **pagamento** no Ganho.
**Aceite:** a diretora vê onde intervir; distratos têm motivo; ciclo médio visível.

---

## 6. Validação, agilidade e qualidade (transversal)
- **1 fase por rodada**, tsc + build verdes, validar no preview logado antes de publicar.
- **Fetch+merge do Lovable** antes de cada publish; nunca force-push.
- **Teste ponta a ponta** com lead/negócio de teste em cada fase, depois apagar.
- **Reuso > reescrita**: card, modal, drawer, dialogs de descarte/regressão já existem.
- **Skills:** design (ui-ux-pro-max/frontend-design) nas fases de UI; code-review-expert/find-bugs antes de publicar as fases sensíveis (linha vermelha na Fase 1).

## 7. Ganhos esperados (por que isso aumenta venda e qualidade)
- **Conversão:** o gargalo Pós-Visita→Negócio vira ação visível ("Virar negócio" + placar) → mais leads viram negócio.
- **Menos vazamento:** VGV obrigatório + SLA por passo + parados à mostra → negócio não morre parado.
- **Organização:** um fluxo, um lugar, header limpo → corretor foca em fechar, gerente em destravar.
- **Confiança no número:** 1 predicado de venda → PDN, KPI e Vendas iguais; forecast real.
- **Adoção:** é o pipeline que o time já usa → sem curva, sem "ilha" que morre.
- **Menos manutenção:** aposenta a PDN (−1 tela), deprecia dados duplicados.

---

## Ordem recomendada
**Fase 1 (fundação) → 2 (aba) → 3 (header) → 4 (ações) → 5 (gerente) → 6 (diretora).**
A Fase 1 é pré-requisito (sem fonte única, a UI mente). Fases 2–3 são o que o Lucas vê primeiro no dia a dia. Cada fase entrega software testável sozinho.
