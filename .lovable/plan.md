# Integração Google Calendar para Confirmação de Visitas

## Decisões aprovadas
- **Provedor único:** Google Calendar (OAuth próprio por corretor)
- **Fallback:** Bloqueia o envio do invite até o corretor conectar a conta
- **Criação de visita:** Modal do Lead (atual) + atalho na página Agenda

## Arquitetura

```text
Corretor → Configurações → "Conectar Google Agenda"
   ↓ OAuth Google (uma vez, ~30s)
   ↓ tokens salvos em corretor_calendar_integrations
   ↓
Agenda visita (modal Lead OU página Agenda)
   ↓
Edge function calendar-create-event
   ↓ usa refresh_token do corretor
   ↓ cria evento no Google Calendar dele
   ↓ adiciona cliente como convidado (sendUpdates: all)
   ↓
Cliente recebe e-mail oficial Google + WhatsApp com link do evento
```

## Fluxo OAuth (uma vez por corretor)

1. Corretor abre **Configurações → Integrações → Google Calendar**
2. Vê estado: "❌ Não conectado" + botão **Conectar Google Agenda**
3. Clica → redirect para `accounts.google.com/o/oauth2/v2/auth` com escopo `https://www.googleapis.com/auth/calendar.events`
4. Autoriza → Google redireciona para `/oauth/google/callback`
5. Edge function `google-oauth-callback` troca o `code` por `access_token` + `refresh_token`, salva criptografado
6. Volta para Configurações com "✅ Conectado como larissa@uhomesales.com"
7. Botão **Desconectar** limpa os tokens

## Pré-requisito: credenciais OAuth

Preciso que você crie no **Google Cloud Console** (te guio quando aprovar):
1. Projeto → habilitar **Google Calendar API**
2. **OAuth consent screen** → tipo External, scope `auth/calendar.events`
3. **Credentials → OAuth Client ID** → Web application
4. Authorized redirect URIs:
   - `https://uhomesales.com/oauth/google/callback`
   - `https://uhomeia.lovable.app/oauth/google/callback`
   - `https://id-preview--6e97ca96-8d59-451c-8ca6-c1b3d18c3c30.lovable.app/oauth/google/callback`
5. Você me entrega: **Client ID** + **Client Secret** → eu salvo como secrets `GOOGLE_OAUTH_CLIENT_ID` e `GOOGLE_OAUTH_CLIENT_SECRET`

Tudo gratuito. ~10 min de setup.

## O que será construído

### Backend

**Tabela nova `corretor_calendar_integrations`**
```
id uuid pk
corretor_id uuid (auth.users.id, unique com provider)
provider text ('google')
account_email text
access_token text (criptografado via pgsodium)
refresh_token text (criptografado)
token_expires_at timestamptz
scopes text[]
connected_at timestamptz
last_used_at timestamptz
status text ('active' | 'revoked' | 'error')
last_error text
```
RLS: corretor só vê/edita o próprio. Service role para edge functions.

**Edge functions (4)**
- `google-oauth-start` — gera URL de autorização com state assinado (CSRF)
- `google-oauth-callback` — troca code por tokens, salva
- `calendar-create-event` — cria evento no Google Calendar do corretor, retorna `event_id` + `htmlLink`
- `calendar-disconnect` — revoga tokens no Google e marca como `revoked`

**Helper `_shared/google-token.ts`** — refresh automático quando expirado.

**Tabela `visitas` ganha colunas:**
- `google_event_id text`
- `google_event_link text`
- `confirmacao_enviada_em timestamptz`
- `confirmacao_status text` ('pendente' | 'enviada' | 'falhou' | 'corretor_sem_calendario')

### Frontend

**Nova página `src/pages/IntegracoesPage.tsx`** (ou aba em Configurações existente)
- Card Google Calendar com status, e-mail conectado, botões Conectar/Desconectar
- Estrutura preparada para adicionar Outlook no futuro

**Nova rota `/oauth/google/callback`** — `src/pages/OAuthGoogleCallback.tsx`
- Mostra spinner, chama `google-oauth-callback`, redireciona para `/integracoes` com toast

**Hook `src/hooks/useCalendarIntegration.ts`**
- `useCalendarStatus()` → retorna `{ connected, email, provider }`
- `useConnectCalendar()` → abre OAuth
- `useDisconnectCalendar()`

**`CardScheduleVisitDialog.tsx` — bloco "Confirmação"**
- Se corretor **não conectado**: aviso amarelo "⚠️ Conecte sua Google Agenda para enviar convite. [Conectar agora]"
  - Botão "Marcar Visita" salva no CRM mas mostra alerta de pendência
  - OU bloqueia o submit até conectar (decisão sua: hoje proponho **salvar visita + alerta**, sem bloqueio total — a visita existe, falta só o convite)

  > Você pediu "bloquear envio até conectar" — vou interpretar como: **bloqueia o envio do invite**, não a criação da visita. A visita pode ser criada, mas o botão "Enviar convite" só aparece com Google conectado. Confirme se prefere bloquear até a criação inteira.

- Se conectado:
  - Checkbox "✅ Adicionar cliente como convidado (recebe e-mail Google)" — default ON
  - Checkbox "📲 Enviar mensagem WhatsApp com link do evento" — default ON
  - Preview da mensagem WhatsApp editável
  - Botão "Marcar Visita + Enviar Convite"

**Página Agenda (`src/pages/EscalaDiaria.tsx` ou onde estiver a lista de visitas)**
- Cada visita ganha menu de ações com:
  - "📲 Reenviar confirmação"
  - "🔗 Abrir no Google Calendar" (usa `google_event_link`)
- Botão "+ Nova visita" abre o `CardScheduleVisitDialog` ligado ao lead selecionado

**`OpportunityVisitasTab.tsx`**
- Mesmo botão de reenvio + status visível ("✅ Convite enviado às 14:32")

### Cron de lembrete (opcional nesta fase)
`cron-visita-lembrete` — 24h antes da visita, envia WhatsApp lembrando. Já fica preparado mas pode ativar depois.

## Detalhes técnicos importantes

**Criação do evento Google:**
```http
POST https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all
{
  "summary": "Visita — High Garden Iguatemi",
  "description": "Cliente: João Silva\nCorretor: Larissa\nTel: ...",
  "start": { "dateTime": "2026-05-07T14:00:00-03:00", "timeZone": "America/Sao_Paulo" },
  "end":   { "dateTime": "2026-05-07T15:00:00-03:00", "timeZone": "America/Sao_Paulo" },
  "location": "Stand do empreendimento",
  "attendees": [{ "email": "joao@cliente.com", "displayName": "João Silva" }],
  "reminders": { "useDefault": false, "overrides": [{ "method": "email", "minutes": 1440 }, { "method": "popup", "minutes": 60 }] }
}
```
`sendUpdates=all` faz o Google enviar e-mail oficial ao cliente automaticamente.

**Refresh token:** Google só entrega `refresh_token` na primeira autorização (`access_type=offline&prompt=consent`). Salvar com cuidado.

**Criptografia dos tokens:** usar `pgsodium` (extensão já disponível no Supabase) ou colunas `bytea` com `pgp_sym_encrypt`. Service role key como senha.

**Cliente sem e-mail:** se a visita só tem telefone, evento é criado sem `attendees` e o link do Google é enviado por WhatsApp. Aviso na UI: "Cliente não tem e-mail — convite irá só por WhatsApp".

**Timezone:** sempre `America/Sao_Paulo` no `start.timeZone` (regra BRT).

## Arquivos a criar/editar

**Criar:**
- `supabase/functions/google-oauth-start/index.ts`
- `supabase/functions/google-oauth-callback/index.ts`
- `supabase/functions/calendar-create-event/index.ts`
- `supabase/functions/calendar-disconnect/index.ts`
- `supabase/functions/_shared/google-token.ts`
- Migration: tabela `corretor_calendar_integrations` + colunas em `visitas`
- `src/pages/IntegracoesPage.tsx`
- `src/pages/OAuthGoogleCallback.tsx`
- `src/hooks/useCalendarIntegration.ts`
- `src/components/integracoes/GoogleCalendarCard.tsx`

**Editar:**
- `src/components/pipeline/CardScheduleVisitDialog.tsx` — bloco confirmação
- `src/components/pipeline/OpportunityVisitasTab.tsx` — botão reenviar + status
- `src/pages/EscalaDiaria.tsx` (ou página de Agenda) — atalho criar visita + reenviar
- `src/App.tsx` — rota `/oauth/google/callback` e `/integracoes`
- `src/components/layout/AppSidebar.tsx` — link "Integrações" em Configurações

**Secrets a adicionar (depois você confirma):**
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`

## Resultado para o corretor

1. Vai em **Configurações → Integrações**, clica "Conectar Google Agenda" (uma vez, 30s)
2. Agenda uma visita pelo Lead (ou pelo botão na Agenda)
3. Modal mostra: ✅ "Larissa@... conectada" + opções Google + WhatsApp
4. Clica "Marcar Visita + Enviar Convite"
5. Cliente recebe e-mail Google **e** WhatsApp com link do evento
6. Visita aparece na agenda do corretor automaticamente
7. Cliente clica "Sim/Não" no e-mail Google → status atualiza
8. Visível em todos os módulos com link "Abrir no Google Calendar"

## Próximo passo após aprovação

Eu começo pela infraestrutura OAuth. Antes de eu pedir os secrets, **você cria as credenciais no Google Cloud Console** seguindo o passo a passo que vou te dar. Sem isso o botão Conectar não funciona.
