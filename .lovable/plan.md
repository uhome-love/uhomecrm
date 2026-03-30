

## Plan: 6 Visual & Logic Corrections

### Files to modify

1. **`src/components/pipeline/PipelineCard.tsx`** — Corrections 1 & 2
2. **`src/components/pipeline/PipelineLeadDetail.tsx`** — Corrections 3 & 5
3. **`src/components/pipeline/LeadMatchesWidget.tsx`** — Correction 4
4. **`src/components/pipeline/WhatsAppFocusFlow.tsx`** — Correction 6

---

### Correction 1 — SLA-based day badge color (PipelineCard.tsx)

Replace the `daysBadge` useMemo (lines 136-140) with the `getSLAColor` function that uses `stage.tipo` and `daysInStage` to determine colors based on per-stage SLA limits (sem_contato: 1d, contato_iniciado: 2d, qualificacao: 7d, etc.). Apply returned `bg`/`color` to the badge span (lines 313-321).

### Correction 2 — Remove empty space in card body (PipelineCard.tsx)

Audit the card body container (line 285) and all child elements for any `min-h-*`, `h-*` fixed heights, `flex-1` causing empty stretch, or excessive `pb-*`. The `pipeline-card-body` div currently has `display: flex, flexDirection: column` — ensure no child has `flex: 1` or `min-height` creating gaps. Remove any spacer elements between content rows and the action bar.

### Correction 3 — Green dot when lead is on track (PipelineLeadDetail.tsx)

Lines 270-297: The current logic sets `isAtualizado = nextTask !== null` but the chip only shows green class when `isAtualizado` is true, using Tailwind `text-success-700 bg-success-50`. The issue is that `noContactAlert` is computed at line 212-220 and returns `null` when `nextTask` exists — so the chip IS green when there's a task. However, the dot color and chip styling need explicit hex values per the user's spec:
- `nextTask` exists → bg `#EAF3DE`, color `#27500A`, dot `#639922`, text "Em dia"
- `noContactAlert === 'critical'` → bg `#FCEBEB`, color `#A32D2D`, dot `#E24B4A`, text "Desatualizado"
- Otherwise → bg `#FAEEDA`, color `#854F0B`, dot `#EF9F27`, text "Atenção"

Replace the Tailwind class-based chip with inline styles using these exact colors.

### Correction 4 — Force compact horizontal list in LeadMatchesWidget.tsx

The file already uses the compact horizontal layout (lines 136-230). However, verify and ensure no grid/grid-cols/aspect-ratio exists anywhere. The current implementation matches the requested layout — 64x64 photos, flex row, score badge overlay, WhatsApp/Ver buttons on right. Confirm the container uses `border: 0.5px solid`, `borderRadius: 10`. This is already correct per lines 137 and 151-156. **No changes needed** unless the rendered output differs (which was the RadarImoveisTab issue, not this component).

### Correction 5 — HOMI tab briefing background & button borders (PipelineLeadDetail.tsx)

Lines 642-671: The briefing already has `background: 'var(--muted)'`. The Follow-up and Quebrar objeção buttons already have `border: '0.5px solid var(--border)'`. Change button background from `'transparent'` to `'var(--background)'` and border from `0.5px` to `1px` for visibility.

### Correction 6 — Filter WhatsApp messages by stage (WhatsAppFocusFlow.tsx)

The `WhatsAppFocusFlow` already filters messages by `stageTipo` via `STAGE_MESSAGES[stageTipo]` (line 31-77). The `WhatsAppTemplatesDialog.tsx` does NOT filter — it shows all 6 templates regardless of stage. Add filtering logic to `WhatsAppTemplatesDialog.tsx`:
- Define `templatesPorEtapa` mapping stage types to template IDs
- Show filtered templates first, then collapsible "Outros templates" section with remaining ones
- Add `stageTipo` prop to the component interface

---

### Technical summary

| # | File | Lines | Change |
|---|------|-------|--------|
| 1 | PipelineCard.tsx | 136-140, 313-321 | Replace daysBadge with getSLAColor using stage.tipo |
| 2 | PipelineCard.tsx | 285 | Audit/remove min-h, flex-1, excess padding |
| 3 | PipelineLeadDetail.tsx | 270-297 | Replace Tailwind chip classes with inline hex colors |
| 4 | LeadMatchesWidget.tsx | — | Already correct, verify no regressions |
| 5 | PipelineLeadDetail.tsx | 661, 667 | Change background to var(--background), border to 1px |
| 6 | WhatsAppTemplatesDialog.tsx | 72, 155-195 | Add stageTipo prop, filter templates by stage, collapsible "Outros" |

