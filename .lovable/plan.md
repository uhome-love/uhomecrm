## Passo 2 — Persistir `meta_lead_id` em todo lead Meta novo

Plano aprovado. Reemitindo idêntico para acionar o modo build.

### 2.1 Escopo confirmado

**Única function que cria lead com `origem = "Meta Ads"` é `receive-meta-lead`.** Grep em todas as edge functions confirma. `meta-leads-backfill` reencaminha para ela (linha 489), então herda a mudança de graça — nada a alterar lá.

**Furo conhecido:** o caminho Meta → Jetimob → `crm-webhook` cria leads com `origem = "jetimob"`/`"site_uhome"` e sem `leadgen_id` (Jetimob não repassa). Não corrigível sem projeto Jetimob-API. O Controle 5 mede a materialidade.

### 2.2 Três mudanças cirúrgicas em `receive-meta-lead/index.ts`

**A. INSERT (linha 787).** Adicionar `meta_lead_id: externalLeadId || null` no payload.

**B. Reativação por telefone (bloco linha 565–609).** Estender `.select(...)` com `meta_lead_id`; se `existing.meta_lead_id IS NULL` E `externalLeadId` presente E nenhum outro `pipeline_lead` já usa esse `externalLeadId` → gravar. Nunca sobrescrever.

**C. Reativação por 23505 unique violation (bloco linha 815–920).** Mesma regra do (B) nos dois `.select` (por email e por telefone).

**Check anti-ambiguidade 1↔1** em (B) e (C):
```typescript
if (externalLeadId && !dup.meta_lead_id) {
  const { data: outroLead } = await supabase
    .from("pipeline_leads")
    .select("id")
    .eq("meta_lead_id", externalLeadId)
    .neq("id", dup.id)
    .maybeSingle();
  if (!outroLead) updatePayload.meta_lead_id = externalLeadId;
  else logOps("warn", "system", "meta_lead_id_ja_em_outro_lead",
    { externalLeadId, este_lead: dup.id, outro_lead: outroLead.id });
}
```

**Log de payload sem ID** (antes do insert, quando `origem = "Meta Ads"`):
```typescript
if (!externalLeadId && !isJetimobSite) {
  logOps("warn", "business", "meta_lead_id_ausente_no_payload",
    { campaign_id: campaignId, form_name: formName, source: platform });
}
```

### 2.3 Cinco controles com portões

1. **Cobertura 24h** — `≥95%` de `meta_lead_id NOT NULL` entre leads novos com origem Meta.
2. **Determinismo** — zero `meta_lead_id` duplicado entre pipeline_leads.
3. **Idempotência** — nenhum valor de backfill sobrescrito.
4. **Payloads sem ID** — visibilidade de campanha/formulário problemático via `ops_events`.
5. **Furo Jetimob** — `origem = 'jetimob'` deve ser `≤5%` do total Meta+Jetimob nos últimos 7 dias.

**Portões para avançar ao Passo 3:** Controle 1 ≥95%, Controle 2 = 0, Controle 5 ≤5%. Qualquer falha, paro e trago números.

### 2.4 Ordem de execução

1. Aplico as mudanças em `receive-meta-lead/index.ts` (~25 linhas).
2. Deploy automático.
3. Aciono `meta-leads-backfill` em modo recente para enriquecer leads recentes que caem no bloco (B).
4. Reporto **imediatamente**: quantos leads enriquecidos + resultado do **Controle 5** (Jetimob material sim/não).
5. Se Controle 5 > 5%: paro, discutimos se atacamos o caminho Jetimob antes de seguir.
6. Se Controle 5 ≤ 5%: registro timestamp do deploy e aguardo 24h.
7. Rodo Controles 1-4 e envio quadro completo antes do Passo 3.

Clique em **Implement plan** para eu executar.
