
# Refundação da Vitrine — CRM ↔ Site

## Diagnóstico (o que está quebrado hoje)

Auditei os dois projetos (CRM `uhomesales` e `Site Uhome`) e o banco do site. Achados confirmados:

1. **Vitrines órfãs no banco do site.** Todas as vitrines recentes (30/03) têm `corretor_id = NULL` E `created_by = NULL`. Consequência:
   - "Minhas Vitrines" no CRM filtra por `created_by = user.id` → **lista vazia para todos**.
   - A página `/vitrine/:id` no site não consegue resolver o corretor (nome/telefone/avatar) → bloco "Falar com consultor" some.

2. **Três caminhos diferentes para criar vitrine** (causa raiz dos NULLs):
   - `useCreateVitrine` (CRM) → `supabaseSite.from("vitrines").insert(...)` direto, com anon key. Depende de RLS permissiva e do `profiles.uhomesales_id` resolver.
   - `crm-bridge` edge function (Site) → service role, ignora RLS, mas só é chamada em fluxos antigos.
   - `vitrine-public` edge function (Site) → também faz inserts em alguns paths.
   Quando o profile do corretor não está sincronizado com `uhomesales_id`, o caminho 1 grava NULL silenciosamente em vez de falhar.

3. **Duas leituras diferentes da mesma vitrine pública**:
   - `Site/Vitrine.tsx` faz query direta na tabela `vitrines` + tabela `imoveis` (somente status `disponivel`).
   - `CRM/VitrinePage.tsx` chama edge function `vitrine-public` (que tem fallback rico: properties → site imoveis → Jetimob API).
   - Resultado: o link público no domínio `uhome.com.br/vitrine/:id` mostra menos imóveis do que a versão admin no CRM.

4. **Busca de imóveis na página `/imoveis` do CRM lê do site** (`siteImoveisRemote`), mas a vitrine pública lê da tabela `properties` do CRM como primária. Códigos selecionados no CRM podem não existir em `properties` (foram vistos via `imoveis` do site) e caem no Jetimob (lento, com timeout 8s) ou somem.

5. **Schema divergente**: `vitrines.imovel_codigos` (array de jetimob_id) vs `vitrine.imovel_ids` (esperado em alguns mapeamentos), causando bugs do tipo "vitrine vazia".

6. **Sem validação de criação**: o frontend faz `insert` e segue, sem checar se o registro voltou com FKs válidas.

---

## Solução: Contrato único, criação via edge function, leitura única

### Princípio
Toda criação e leitura de vitrine passa por **uma única edge function** no projeto do site. CRM nunca mais escreve direto na tabela `vitrines` via anon key.

```text
┌──────────────────┐                                ┌────────────────────┐
│   CRM /imoveis   │  POST  vitrine-bridge          │  Site Supabase     │
│  (selecionar     │ ─────────────────────────────► │  (service role)    │
│   imóveis)       │   action: "create_vitrine"     │                    │
│                  │   header: x-crm-token          │  - valida corretor │
│                  │ ◄───────────────────────────── │  - resolve profile │
│                  │   { id, public_url }            │  - insere c/ FKs   │
└──────────────────┘                                │  - retorna URL     │
                                                    └────────────────────┘
                                                              ▲
                                                              │ GET
┌──────────────────┐                                          │
│  Site público    │  GET  vitrine-public/:id  ───────────────┘
│  /vitrine/:id    │  (ÚNICA fonte, com fallback             
│                  │   properties → site imoveis → cache)    
└──────────────────┘                                         
```

### Etapas

**1. Banco de dados (site `huigglwvvzuwwyqvpmec`)** — migração:
- `ALTER TABLE vitrines`: `created_by` e `corretor_id` viram `NOT NULL` (para registros novos), com trigger `BEFORE INSERT` que **rejeita** insert sem ambos.
- Backfill das vitrines órfãs: tentar resolver `created_by` via `corretor_slug` ou marcar `tipo='orfa'` para auditoria.
- Adicionar `imoveis_resolvidos jsonb` (cache snapshot dos imóveis no momento da criação — fotos, preço, título), garantindo que a vitrine **nunca quebra** se o imóvel sair do ar depois.
- RLS: remover policies permissivas de INSERT anon. Apenas service role insere.
- Index em `(created_by, created_at desc)` para "Minhas Vitrines".

**2. Edge function `vitrine-bridge` (Site)** — endpoint único de criação:
- Recebe `x-crm-token` (já existe `CRM_BRIDGE_TOKEN`).
- Body: `{ crm_user_id, crm_user_email, imovel_codigos, titulo, lead_id?, lead_nome?, ... }`.
- Lookup `profiles` por `uhomesales_id = crm_user_id`. Se não achar, fallback por `email`. Se ainda não achar, **erro 422** com mensagem clara.
- Pré-busca os imóveis (`properties` CRM → `imoveis` site → Jetimob), monta `imoveis_resolvidos` snapshot, insere vitrine com todos os FKs preenchidos.
- Retorna `{ id, public_url, imoveis_count, missing_codes: [] }`.

**3. Edge function `vitrine-public` (Site)** — leitura única e robusta:
- Mantém a lógica atual de fallback (properties → site imoveis → Jetimob).
- **Adiciona** prioridade: se `imoveis_resolvidos` (snapshot) tem dados, usa ele primeiro. Garante que a vitrine sempre renderiza, mesmo se imóvel sair do catálogo.
- Resolve `corretor` por `created_by` (que agora nunca é NULL).

**4. CRM** — refatoração:
- `src/hooks/useCreateVitrine.ts`: substituir insert direto por chamada `supabase.functions.invoke('vitrine-bridge', { body: { action: 'create_vitrine', ... } })` via uma edge function de proxy no CRM (`call-vitrine-bridge`) que injeta o `CRM_BRIDGE_TOKEN`.
- `src/pages/MinhasVitrines.tsx`: também via bridge `list_vitrines` (já existe), em vez de query direta — autenticação por token, mais resiliente.
- `src/pages/VitrinePage.tsx` (a versão admin): chamar `vitrine-public` em vez de query direta. Elimina divergência.
- `src/pages/ImoveisPage.tsx`: ao selecionar imóveis para vitrine, **valida** que cada `codigo` existe em `properties` ou `imoveis` (uma checagem leve antes do submit) e mostra avisos.

**5. Site** — refatoração:
- `src/pages/Vitrine.tsx`: substituir as 2 queries diretas por uma única chamada `vitrine-public`. Elimina o filtro `status = 'disponivel'` que esconde imóveis, usando o snapshot.

**6. Backfill imediato** das 302 vitrines órfãs (script SQL único): tentar resolver `created_by` via `corretor_slug` ou registrar como inválida. As que não resolverem ganham `tipo = 'legacy_orphan'` e somem do filtro de "Minhas Vitrines".

**7. Observabilidade**:
- Edge function loga: criação OK, criação falha por profile não encontrado, render com snapshot vs catálogo ao vivo.
- Painel `/diagnostico-site` (já existe) ganha card "Saúde da Vitrine": % criadas com FKs OK nos últimos 7 dias, % renders via snapshot, vitrines órfãs.

---

## Resultado esperado

- **Criação atômica**: ou cria com tudo certo (corretor, imóveis snapshot) ou retorna erro claro. Nunca mais NULL silencioso.
- **Leitura única**: CRM e site renderizam idêntico, via mesma edge function.
- **Resiliência**: vitrine criada em março continua renderizando em dezembro mesmo se o imóvel saiu do Jetimob (snapshot).
- **"Minhas Vitrines" funciona** para todos os corretores a partir da próxima criação.
- **Busca em /imoveis** alimenta a vitrine sem inconsistência (mesma fonte, validação prévia).

---

## O que vou alterar (arquivos)

**Site Uhome:**
- `supabase/migrations/<timestamp>_vitrines_hardening.sql` — schema, trigger, backfill, RLS
- `supabase/functions/vitrine-bridge/index.ts` — novo (criação única)
- `supabase/functions/vitrine-public/index.ts` — adicionar uso de snapshot
- `src/pages/Vitrine.tsx` — usar `vitrine-public` em vez de query direta

**CRM (este projeto):**
- `supabase/functions/call-vitrine-bridge/index.ts` — novo proxy que injeta o token
- `src/hooks/useCreateVitrine.ts` — chamar via bridge
- `src/pages/MinhasVitrines.tsx` — chamar via bridge
- `src/pages/VitrinePage.tsx` — chamar `vitrine-public`
- `src/pages/ImoveisPage.tsx` — validação prévia de códigos selecionados
- `src/pages/DiagnosticoSite.tsx` — card "Saúde da Vitrine"

---

## Sequência de execução (após aprovação)

1. Migração no banco do site (schema + backfill).
2. Deploy `vitrine-bridge` e atualizar `vitrine-public` no site.
3. Deploy `call-vitrine-bridge` no CRM.
4. Refatorar hooks/pages do CRM.
5. Refatorar `Site/Vitrine.tsx`.
6. Validar criando 1 vitrine de ponta a ponta e abrindo no domínio público.

**Ponto de atenção**: a migração no banco do site exige acesso ao projeto Site Uhome — o usuário precisará aprovar lá também (a migração SQL deste projeto não atinge o banco do site).
