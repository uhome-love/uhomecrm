

# Plano de Limpeza — 3 Fases Seguras

## Escopo Total

**Deletar 3 páginas** + todos os componentes, banners, analytics, landing pages, edge functions e referências relacionadas a Melnick Day, Mega Cyrela e Anúncios no Ar.

---

## FASE 1 — Anúncios no Ar (baixo risco)

**Deletar:**
- `src/pages/AnunciosNoAr.tsx`

**Editar:**
- `src/App.tsx`: remover import `AnunciosNoAr` + rota `/anuncios`
- `src/components/AppSidebar.tsx`: remover 3 entradas "Anúncios no Ar" (linhas ~346, ~413, ~522)
- `src/components/layout/Sidebar.tsx`: remover 3 entradas "Anúncios no ar" (linhas ~67, ~126, ~200)

**Risco:** Zero — nenhum outro componente depende desta página.

---

## FASE 2 — Mega Cyrela (baixo risco)

**Deletar:**
- `src/pages/MegaCyrela.tsx`

**Editar:**
- `src/App.tsx`: remover import `MegaCyrela` + rota `/mega-cyrela`
- `src/components/AppSidebar.tsx`: remover entradas Mega Cyrela no sidebar (expanded ~675-687, collapsed ~708-714)

**Risco:** Zero — página isolada, sem dependências externas.

---

## FASE 3 — Melnick Day completo (risco moderado, mais arquivos)

### 3A — Páginas e componentes frontend

**Deletar arquivos:**
- `src/pages/MelnickDay.tsx` (página principal /melnick-day)
- `src/pages/MelnickDayLanding.tsx` (landing /melnickday e /md)
- `src/pages/CampaignAnalyticsPage.tsx` (admin analytics)
- `src/components/MelnickMetaBanner.tsx` (banner no AppLayout)
- `src/components/pipeline/MelnickCampaignAnalytics.tsx` (widget no Pipeline)
- `src/components/showcase/MelnickDayLayout.tsx` (layout vitrine)
- `src/components/showcase/CampaignHeader.tsx` (header campanha — só usado por MelnickDayLayout)

**Editar:**
- `src/App.tsx`: remover imports + rotas `/melnick-day`, `/melnickday`, `/md`, `/campaign-analytics`
- `src/components/AppSidebar.tsx`: remover entradas Melnick Day (expanded ~647-661, collapsed ~694-700)
- `src/components/AppLayout.tsx`: remover import + uso de `MelnickMetaBanner`
- `src/pages/PipelineKanban.tsx`: remover import + uso de `MelnickCampaignAnalytics`
- `src/pages/VitrinePage.tsx`: remover import `MelnickDayLayout`, cases `melnick_day`/`mega_cyrela` passam a usar `PropertySelectionLayout` (fallback seguro — vitrines existentes não quebram)
- `src/components/showcase/types.ts`: remover `"melnick_day"` do tipo `ShowcaseType`

### 3B — Referências em componentes que NÃO são deletados

- `src/components/pipeline/PipelineCard.tsx`: remover entrada `MELNICK_DAY` do `NON_EMP_TAGS` (linhas ~457-459)
- `src/components/pipeline/PipelineLeadDetail.tsx`: remover DropdownMenuItem "Marcar Melnick Day" (linhas ~451-462) e Badge condicional (linhas ~478-480)
- `src/components/oferta-ativa/CustomListWizard.tsx`: remover opção `melnick_day` do array CAMPANHAS (linha ~76)
- `src/pages/MinhasVitrines.tsx`: remover label condicional `melnick_day` (fallback para tipo genérico)
- `src/pages/WhatsAppLanding.tsx`: trocar default `campanha` de `"melnick_day_2026"` para `"campanha_whatsapp"`
- `src/pages/WhatsAppCampaignDispatcher.tsx`: remover entries `melnick_day_*` e `ofertas_meday` dos dicts de templates

### 3C — Edge Functions

**Deletar:**
- `supabase/functions/campaign-sms-click/` (exclusivo da landing Melnick Day SMS)
- `supabase/functions/campaign-activation/` (ativação de campanha Melnick Day)

**Manter:**
- `supabase/functions/receive-landing-lead/` — função genérica usada por TODAS as landing pages. As referências a `isMelnickDay` são inofensivas (nunca mais serão true), mas serão limpas por segurança.

---

## Resumo de Impacto

| Ação | Qtd |
|------|-----|
| Páginas deletadas | 5 (AnunciosNoAr, MegaCyrela, MelnickDay, MelnickDayLanding, CampaignAnalyticsPage) |
| Componentes deletados | 4 (MelnickMetaBanner, MelnickCampaignAnalytics, MelnickDayLayout, CampaignHeader) |
| Edge functions deletadas | 2 (campaign-sms-click, campaign-activation) |
| Arquivos editados | ~13 |

**Zero lógica de negócio core alterada.** Pipeline, vitrines e WhatsApp continuam funcionando normalmente.

