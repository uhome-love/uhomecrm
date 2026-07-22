# Plano: Landing Page de Materiais por Empreendimento

## Resumo
Criar uma landing page pública no site da Uhome para o corretor compartilhar com cliente uma **seleção manual de materiais de um empreendimento**. A arquitetura segue o mesmo padrão já validado das **vitrines**: o CRM gera um share via edge function, o site lê do próprio banco e renderiza com dados do corretor + WhatsApp CTA.

## Arquitetura
```
CRM (uhomecrm)                              Site Uhome (uhome-vision)
┌─────────────────────┐                    ┌─────────────────────┐
│  MateriaisPage      │  create_share      │  materiais_shares   │
│  corretor seleciona │ ─────────────────► │  (tabela pública)   │
│  empreendimento +   │  vitrine-bridge    │                     │
│  links + mensagem   │  service role      │  /materiais/:id     │
└─────────────────────┘                    │  renderiza landing  │
                                          └─────────────────────┘
```
- O share é gravado no **banco do site** para evitar CORS, latência e dependência de edge function no carregamento da página.
- Os materiais são persistidos como **snapshot** (nome, logo, categoria, título, URL), não como FK — assim não precisa sincronizar tabela `materiais_links` entre os dois projetos.

## Fases

### Fase 1 — Fundação (DB + Edge Function)
**No projeto do site:**
- Criar tabela `materiais_shares` com: `id`, `created_by`, `corretor_id`, `titulo`, `subtitulo`, `mensagem`, `empreendimento_snapshot` (nome, logo), `materiais_snapshot` (JSONB com categoria, título, URL, ordem), `visualizacoes`, `cliques_whatsapp`, `created_at`.
- RLS: `SELECT` anônimo permitido, `INSERT/UPDATE/DELETE` apenas via `service_role`.

**No CRM:**
- Criar edge function `materiais-bridge` (paralela à `vitrine-bridge`) com actions:
  - `create_share` — autenticada, resolve `profiles` do site por `uhomesales_id` e insere o share.
  - `get_share` — pública, usada apenas para fallback/diagnóstico.
  - `track_event` — pública, incrementa `visualizacoes` ou `cliques_whatsapp`.
- Reutilizar os secrets existentes `UHOMESITE_URL` e `UHOMESITE_SERVICE_KEY`.

### Fase 2 — Geração do link no CRM
- Adicionar botão **"Compartilhar seleção"** no `MaterialCard` (por empreendimento) e/ou no `MateriaisPage`.
- Abrir modal de configuração:
  - Empreendimento pré-selecionado.
  - Checkboxes para escolher quais materiais/links incluir.
  - Campos opcionais: título, subtítulo, mensagem personalizada do corretor.
  - Botão **"Gerar link de compartilhamento"**.
- Hook `useCreateMateriaisShare` similar a `useCreateVitrine`:
  - chama `materiais-bridge`;
  - copia link para clipboard;
  - retorna URL pública no site.

### Fase 3 — Landing Page no Site
**No projeto do site:**
- Adicionar rota `/materiais/:id` em `AppRoutes.tsx` e lazy page em `lazyPages.ts`.
- Criar página `MateriaisShare.tsx`:
  - Busca o share por `id` no Supabase do site.
  - Hero com nome/logo do empreendimento, título e mensagem do corretor.
  - Lista de materiais agrupados por categoria (mesmas categorias do CRM: Drive, Apresentação, Tabela, etc.).
  - Cada material renderiza como card/link com ícone e abre em nova aba.
  - Bloco do corretor com foto, nome, CRECI e botão **WhatsApp** (igual bloco da Vitrine).
  - Estados: loading, not found, empty.
  - Meta tags (title, description, OG) para compartilhamento bonito.

### Fase 4 — Rota de Corretor e Tracking
- Suportar `/c/:corretorSlug/materiais/:id` para manter o banner "Você está sendo atendido por..." e o WhatsApp direto do corretor.
- Incrementar `visualizacoes` ao abrir a página.
- Incrementar `cliques_whatsapp` ao clicar no botão.

## Mockup (pré-requisito antes de build)
Antes de qualquer código, serão gerados 3 mockups para aprovação visual:
1. **Modal do CRM** — como o corretor seleciona o empreendimento, escolhe os materiais e escreve a mensagem.
2. **Landing page pública** — como o cliente vê a página no site (desktop e mobile).
3. **Card do corretor** — foto, nome, CRECI e botão de WhatsApp na landing.

## Perguntas já resolvidas
- Projeto do site: [Site Uhome](/projects/8ba49a95-26f2-42d4-b8e7-98d251f7e32e).
- Escopo: menor dificuldade → usar snapshot no banco do site.
- Seleção: manual pelo corretor.
- Dados do corretor: sim, com foto, nome e WhatsApp.

## Próximos passos
1. Você aprova este plano.
2. Gero os 3 mockups visuais para aprovação.
3. Após aprovação dos mockups, implemento a Fase 1.
4. Valido ponta a ponta (CRM → site → WhatsApp CTA) antes de seguir para Fase 2.