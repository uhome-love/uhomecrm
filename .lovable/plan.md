# Plano — Seletor de Template Meta no Disparo

## Problema
Hoje o campo "Template Meta aprovado" é um **input de texto livre**, sujeito a erro de digitação e oculto para `descartados` e `visita_amanha`. O usuário quer **selecionar de uma lista** dos templates realmente aprovados na Meta (como na Meta Business Suite), com nome correto e idioma.

## Solução

### 1. Nova edge function: `meta-templates-list`
- `GET` que retorna `{ templates: [{ name, language, status, category, has_buttons }] }`
- Fluxo:
  1. Lê `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` (já existem).
  2. Resolve o WABA ID via `GET https://graph.facebook.com/v21.0/{phone_id}?fields=whatsapp_business_account` (cache em memória do isolate por 1h).
  3. Lista templates: `GET https://graph.facebook.com/v21.0/{waba_id}/message_templates?fields=name,language,status,category,components&limit=200`, paginando.
  4. Mantém apenas `status === "APPROVED"`.
  5. Marca `has_buttons` se algum component tiver `type === "BUTTONS"` (importante p/ disparos com SIM/NÃO).
- `verify_jwt = true` (uso interno autenticado).
- CORS padrão.

### 2. `DisparoCustomizadoCard.tsx` — trocar input por Combobox
- Novo hook `useQuery(["meta-templates"])` chamando a edge function (5 min stale).
- Substituir o `<Input>` por um **Combobox** (`@/components/ui/popover` + `Command`) com:
  - Busca por nome.
  - Badge de idioma (`pt_BR`) e indicador "🔘 com botões" quando aplicável.
  - Opção "✏️ Digitar manualmente" no rodapé (fallback) — abre input texto.
- **Mostrar o seletor SEMPRE que `canal === "meta"`** (inclusive descartados e visita_amanha), pré-preenchendo com o template default da `reengajamento_config` quando carregado.
- Salvar tanto `template_name` quanto `template_language` no `buildAudience()`.

### 3. Enqueue: respeitar override explícito
- Em `reengajamento-descartados-enqueue` e `visita-amanha-enqueue`: se `audience.template_name` vier preenchido, usar esse no lugar do default da config (e `audience.template_language` se vier; senão `pt_BR`).
- Hoje `descartados` e `visita_amanha` ignoram `audience.template_name` — pequena mudança para aceitar override.

### 4. Pré-carregar default da config no front
- Hook adicional que lê `reengajamento_config` (campos `meta_template_name`, `meta_template_language`) e pré-seleciona quando o usuário escolhe `descartados` ou `visita_amanha`.

## Fora de escopo
- Editor/criação de templates (continua no Meta Business Suite).
- Sync automático para tabela local — sempre que abrir, busca ao vivo (com cache 5min no front).
- Mudanças na auditoria de webhooks.

## Arquivos
- `supabase/functions/meta-templates-list/index.ts` (novo)
- `src/components/central-nutricao/DisparoCustomizadoCard.tsx` (combobox + lógica)
- `supabase/functions/reengajamento-descartados-enqueue/index.ts` (override do template)
- `supabase/functions/visita-amanha-enqueue/index.ts` (override do template)
