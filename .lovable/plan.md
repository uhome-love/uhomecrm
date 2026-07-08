# Reorganização final do Pipeline Único

Consolidação das etapas, substatus inteligentes, emojis únicos, integração automática de visitas, aba de negócio editável inline e reestruturação do PDN do gestor — tudo preservando dados e sem quebrar o fluxo atual.

## 1. Etapas definitivas (renomear e consolidar)

O board ativo passa a ter **7 colunas** + **Ganho** fora do board (filtro):

```text
🆕 Novo Lead → 📵 Sem Contato → 🔎 Qualificação → 🔥 Aquecimento →
🏠 Visita → 🤝 Em Negociação → 📄 Contrato        [🏆 Ganho = filtro]
```

Mudanças de nome/consolidação (via migração, preservando leads):
- `Atendimento / Qualificação` → **Qualificação**
- `Nutrição / Aquecimento` → **Aquecimento**
- `Proposta / Negociação` → **Em Negociação** (passa a absorver a antiga *Aprovação / Documentação*)
- Leads que estavam em `Aprovação / Documentação` (tipo `documentacao`) são movidos para **Em Negociação** com substatus `documentacao_enviada`, e a coluna `documentacao` sai do board.
- `Contrato Gerado` → **Contrato**
- `Ganho` continua existindo, mas deixa de aparecer no board ativo.

## 2. Emojis únicos por etapa

Hoje vários caem no fallback `📍` ou repetem 🔍/🔥. Corrigir o mapa em `celebrations.ts` usando os **nomes reais** das etapas, com um emoji distinto cada:

| Etapa | Emoji |
|---|---|
| Novo Lead | 🆕 |
| Sem Contato | 📵 |
| Qualificação | 🔎 |
| Aquecimento | 🔥 |
| Visita | 🏠 |
| Em Negociação | 🤝 |
| Contrato | 📄 |
| Ganho | 🏆 |

Cores/bg (`PIPELINE_STAGE_COLORS` / `PIPELINE_STAGE_BG`) atualizadas para os novos nomes.

## 3. Substatus por etapa (aparecem no card + editáveis no modal)

Guardados em `pipeline_leads.flag_status` (padrão atual), exibidos via `CardMinimal`/`LeadFlagBadges` e editáveis no popup de transição e no modal do lead:

- **Qualificação** (`status_atendimento`): Contato inicial · Alinhando perfil · Busca de imóveis · Follow up · Alinhando visita
- **Aquecimento** (`prazo`): Retomar 30D · Retomar 60D · Retomar 90D
- **Visita** (`status_visita`): Visita marcada · Visita realizada · No-show — **atualização automática** (ver item 4)
- **Em Negociação** (`status_negociacao`): Proposta enviada · Proposta aprovada · Em aprovação bancária · Correspondente bancário · Aprovação proprietário · Documentação enviada
- **Contrato** (`status_contrato`): Em confecção · Gerado · Em leitura

Cada substatus com emoji/cor próprios em `leadHelpers.ts` (badge do card) e `LeadFlagBadges.tsx`.

## 4. Visita ↔ Agenda automática

- Ao **criar** visita na agenda → lead vai para etapa Visita com `status_visita = marcada` (já funciona).
- Ao marcar visita como **realizada** na agenda (`updateStatus`) → grava `status_visita = realizada` no `flag_status` do lead automaticamente.
- Ao marcar **não compareceu / no_show** → grava `status_visita = no_show`.
- Resultado da visita (`VisitaResultadoDialog`) mantém a movimentação existente, agora sincronizando o substatus.

## 5. Ganho fora do pipeline ativo (proposta de UX)

- **Ganho não vira coluna** do board ativo — entra em `HIDDEN_STAGE_TIPOS`.
- Adiciono no header do pipeline um **toggle/filtro "Ganhos"** que abre uma visão só-leitura dos leads na etapa Ganho (cards com botão **"Reativar lead"** para quando o cliente quiser comprar outra coisa — volta o lead para Novo Lead / Qualificação, preservando histórico e negócio anterior).
- Ao dar **Ganho** a partir de Contrato, o lead recebe `stage = Ganho`, dispara celebração de venda (já existe) e sai do board ativo automaticamente.

## 6. Aba Negócio inline editável (modal do lead)

`DrawerNegocioTab` deixa de ser só-leitura. Campos editáveis inline salvando em `negocios` e registrando no **Histórico do lead**:
- VGV (estimado/final), empreendimento/unidade, construtora
- Proposta (valor + situação), negociação (situação/pendência), documentação (situação)
- Data de assinatura e observações do negócio

## 7. PDN do Gestor por etapas

`usePdn` + `PdnGestor` reestruturados para colunas baseadas na **jornada real do pipeline** (não só na fase do negócio):

```text
VISITA REALIZADA → EM NEGOCIAÇÃO → CONTRATO → GANHO
```

- **Visita Realizada**: leads com `status_visita = realizada` (fonte: `flag_status` + tabela `visitas`).
- **Em Negociação / Contrato / Ganho**: leads nas etapas correspondentes (com VGV do negócio vinculado).
- Mantém overlay manual (`pdn_entries`), forecast, risco e export CSV.

## 8. Limpeza / integridade

- Remover do board colunas mortas/duplicadas (`Contato Iniciado`, `Busca`, `Possível Visita`, `Visita Marcada`, `Visita Realizada`, `Pós-Visita`, `Negócio`, `Negociação`, `Boas-vindas`, etc.) mantendo só as 7 ativas + âncoras ocultas.
- Preservar todos os dados (nenhum lead deletado; apenas remapeamento de `stage_id`).
- Ajustar mobile (`PipelineMobileView`) para espelhar as 7 etapas + filtro Ganhos.

## Detalhes técnicos

**Migração SQL** (1 migração):
- `UPDATE pipeline_stages` renomeando nomes e ajustando cor.
- Remapear leads de `documentacao` → `proposta` (Em Negociação) com `flag_status.status_negociacao='documentacao_enviada'`.
- Marcar etapas não usadas como fora do board (via `HIDDEN_STAGE_TIPOS` no código, sem apagar registros para preservar histórico).

**Arquivos afetados:**
- `supabase/migrations/*` (rename/remap de etapas)
- `src/lib/celebrations.ts` (emojis/cores por nome real)
- `src/lib/leadHelpers.ts` + `src/components/pipeline/LeadFlagBadges.tsx` (substatus novos)
- `src/components/pipeline/PipelineStageTransitionPopup.tsx` (popups de Em Negociação e Contrato com substatus)
- `src/components/pipeline/PipelineBoard.tsx` + `PipelineMobileView.tsx` (colunas ativas, filtro Ganhos)
- `src/components/pipeline/PipelineHeader.tsx` (toggle "Ganhos")
- `src/hooks/useVisitas.ts` (auto `status_visita` realizada/no_show)
- `src/components/pipeline/drawer/DrawerNegocioTab.tsx` (edição inline)
- `src/hooks/usePdn.ts` + `src/pages/PdnGestor.tsx` (colunas por etapa + Visita Realizada)
- `src/hooks/usePipeline.ts` (mapeamento etapa→fase negócio + reativar lead)

**Validação ponta a ponta:** `tsgo` limpo, testes (vitest) e Playwright headless (desktop + mobile) cobrindo: as 7 etapas com emojis únicos, substatus visíveis nos cards, transição Qualificação/Em Negociação/Contrato com substatus, visita marcada/realizada/no-show automática, aba Negócio editável salvando no histórico, Ganho saindo do board + filtro Ganhos com reativação, e PDN do gestor refletindo Visita Realizada → Em Negociação → Contrato → Ganho.
