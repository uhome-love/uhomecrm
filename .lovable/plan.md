# Refatoração Completa: Vitrines + Imóveis

## Diagnóstico (raiz do caos)

A funcionalidade está rachada entre **DOIS bancos Supabase diferentes**, e cada peça do código escolhe o lado errado:

```text
                     ┌──────────────────────────┐
                     │  CRM (hunbxqzhvuemgntklyzb) │
                     │  • properties             │
                     │  • empreendimento_overrides│
                     │  • vitrines (LEGADO/morto)│
                     │  • vitrine_interacoes     │
                     └──────────────────────────┘
                                  │
   ┌─── useCreateVitrine ─────────┼──── INSERE NO SITE ✅ (correto)
   │                              │
   ├─── vitrine-public (edge fn) ─┴──── LÊ NO CRM   ❌ (errado!)
   │
   ├─── MinhasVitrines ────────────────► LÊ NO SITE ✅ (correto)
   │
   └─── getVitrinePublicUrl ────► uhome.com.br/vitrine/:id
                                   (página do projeto SITE,
                                    que lê no banco do SITE ✅)
```

### Bugs concretos hoje

1. **`vitrine-public` consulta `vitrines` no CRM** (`SUPABASE_URL` da função). A vitrine criada vive no SITE → resposta 404 “Vitrine não encontrada”. O retry de 3s no `VitrinePage` apenas mascara o erro.
2. **`VitrinePage.tsx` (CRM)** chama essa edge function e nunca renderiza nada. Mas o link público real é `uhome.com.br/vitrine/:id`, servido pela página `Vitrine.tsx` do projeto **Site Uhome**, que funciona — então quem abre o link no domínio público vê a vitrine; quem abre dentro do CRM (`/vitrine/:id` no domínio CRM) recebe erro.
3. **Duas tabelas `vitrines` paralelas** (CRM e Site) com schemas divergentes: CRM tem `imovel_ids`, `mensagem_corretor`, `dados_custom`, `tipo`; Site tem `imovel_codigos`, `mensagem`, `corretor_id`, `corretor_slug`. Código novo já escreve no Site; código velho ainda lê CRM.
4. **`vitrine_interacoes` (analytics)** é gravada no CRM, mas a vitrine existe no Site → analytics órfãos. `MinhasVitrines` mostra 0 cliques.
5. **`empreendimento_overrides`** (landing pages customizadas) só existe no CRM → vitrines `product_page` (Casa Tua, Orygem, Las Casas) precisam desse dado, mas a edge function tenta casar `imovel_codigos` (uuid do site) com `codigo` do override (string tipo `52101-UH`) → não bate → landing genérica.
6. **Tracking (`useVitrineTracking`)** chama `vitrine-public` com `vitrine_id` que não existe no banco que a função consulta → tracking silenciosamente falha.

## Solução: SITE como fonte única da verdade

A página pública vive no domínio do site, então o **banco do Site é a fonte canônica** de vitrines. O CRM passa a ser apenas autor/auditor.

### Etapa 1 — Edge function `vitrine-public` lê do banco do Site

Reescrever para que **todas** as queries de `vitrines` e `vitrine_interacoes` usem o `supabaseSiteClient`. O banco do CRM continua sendo usado só para:
- `properties` (catálogo CRM, fonte primária de imóveis)
- `empreendimento_overrides` (landing customizada)
- `profiles` (dados do corretor)
- chamadas internas (`nurturing-orchestrator`, `whatsapp-notificacao`)

Adicionar variáveis de ambiente para o Site (já hardcoded na função; mover para `Deno.env`):
- `SITE_SUPABASE_URL`
- `SITE_SUPABASE_SERVICE_ROLE_KEY` — precisa do **service role** do Site para escrever `visualizacoes`, `cliques_whatsapp` e `vitrine_interacoes` sem bater em RLS.

### Etapa 2 — Schema do Site recebe colunas que faltam

Migration no banco do Site (via SQL no projeto Site, descrito mas executado lá):
- Garantir que `vitrines` tenha: `subtitulo`, `tipo`, `dados_custom`, `expires_at`, `pipeline_lead_id`, `cliques_whatsapp`, `visualizacoes`. Algumas já existem; criar somente as faltantes.
- Criar `vitrine_interacoes` no Site com mesmo schema do CRM se não existir.
- RLS: `select` público para `vitrines` por id; `insert` em `vitrine_interacoes` público; `update` (contadores) restrito a service role.

> Nota: como migrations DB ficam no projeto Site (outro Lovable), entrego o SQL pronto e o usuário roda lá — ou eu posso aplicar via cross-project se houver permissão. **Pergunta de validação no fim.**

### Etapa 3 — `useCreateVitrine` salva também no CRM (auditoria leve)

Manter o insert principal no Site (já está). Adicional: gravar uma cópia mínima no CRM (`vitrines_audit` ou reutilizar `lead_imovel_events` com `event_type='vitrine_criada'`) para que dashboards do CRM e o vínculo com `pipeline_lead_id` continuem funcionando sem precisar fazer cross-DB join.

### Etapa 4 — `VitrinePage.tsx` (CRM) deixa de existir como página pública

Hoje o CRM tem rota `/vitrine/:id` que duplica a página do site e quebra. Duas opções (vou perguntar):
- **A:** Remover a rota do CRM. Qualquer link velho redireciona para `https://uhome.com.br/vitrine/:id`.
- **B:** Manter a rota CRM, mas reescrever `VitrinePage.tsx` para apontar para `supabaseSite` diretamente (sem edge function), igual à página do site.

### Etapa 5 — `useVitrineTracking` aponta para o banco certo

Como tracking precisa de `service_role` (escrever contadores/interações sem login), continua via `vitrine-public` — mas agora a função grava no Site.

### Etapa 6 — Resolver `empreendimento_overrides` para vitrines `product_page`

Casos como Casa Tua (`52101-UH`) usam código Jetimob como `imovel_codigos`. Vou:
1. Garantir que o `match` na edge function suporte tanto UUID (do Site) quanto código Jetimob.
2. Quando o código for UUID, fazer lookup no Site `imoveis.jetimob_id` para resolver para o código Jetimob antes de cruzar com `empreendimento_overrides`.

### Etapa 7 — QA end-to-end automatizado

Script de teste (Node, em `/tmp`) que:
1. Cria uma vitrine via `useCreateVitrine` (simulando insert direto no Site com 2 imóveis reais).
2. Chama `vitrine-public` com `action=get_vitrine` e valida resposta com >0 imóveis.
3. Acessa `https://uhome.com.br/vitrine/:id` e verifica HTTP 200.
4. Dispara `track_event` (whatsapp_click) e confere incremento.
5. Verifica que aparece em `MinhasVitrines` do criador.

## Mudanças por arquivo

| Arquivo | Mudança |
|---|---|
| `supabase/functions/vitrine-public/index.ts` | Reescrita: `vitrines` e `vitrine_interacoes` no Site; mantém `properties`/`overrides`/`profiles` no CRM. Resolução UUID↔Jetimob. |
| `supabase/config.toml` | (sem mudança; função já existe) |
| `src/hooks/useCreateVitrine.ts` | Acrescentar gravação de evento de auditoria no CRM (`lead_imovel_events`). |
| `src/pages/VitrinePage.tsx` | Conforme escolha A ou B (etapa 4). |
| `src/App.tsx` | Conforme escolha A: remover rota; B: manter. |
| `src/lib/vitrineUrl.ts` | Sem mudança — já aponta para uhome.com.br. |
| `src/hooks/useVitrineTracking.ts` | Sem mudança de assinatura, mas testes confirmam fluxo. |
| **Site (cross-project)** | SQL para garantir colunas faltantes em `vitrines` + criar `vitrine_interacoes` + RLS. |
| Secrets | Adicionar `SITE_SUPABASE_URL` e `SITE_SUPABASE_SERVICE_ROLE_KEY` ao CRM. |

## Riscos e mitigação

- **Vitrines antigas no CRM (`vitrines` legada)**: 23 registros (vi 10 nos últimos meses). Migrar via script único para o Site, preservando ID (UUIDs únicos não colidem entre bancos), antes de derrubar a leitura no CRM. Rollback: a tabela CRM permanece intocada (só leitura desligada).
- **Service role do Site**: o usuário precisa colá-la nos secrets do CRM. Se preferir, podemos usar a anon key + RLS policy específica para `update visualizacoes/cliques`, mas service role é mais simples e seguro (só edge function vê).

## O que preciso confirmar com você

Vou perguntar 2 coisas curtas antes de implementar (rota legada + onde está a service role do Site).
