# Página pública pós-formulário — Casa Tua Canoas (/v/casa-tua-canoas) — Fase 1

## Ponto de atenção antes de aprovar
Já existe uma página pública `/casatuacanoas-quiz` (arquivo `CasaTuaCanoasQuiz`). Proposta: criar a nova página separada e **não mexer** na antiga. Se preferir substituir a antiga, me avise. Sem código antes do mockup: o primeiro passo do build é um mockup em HTML para você aprovar.

## Referência visual: site da Encorp (casa-tua-condominio-casas-canoas)
- **Vídeo:** o mesmo filme do site (YouTube PovnF-uY58k).
- **Fotos:** uso as fotos oficiais da galeria de lançamento do site (cerca de 30 disponíveis). Escolho 8 (fachada, pátio, sala, cozinha, suíte, piscina, clube, fogueira), converto para JPG leve (cerca de 1080 px, menos de 200 KB cada) e guardo no armazenamento de imagens do próprio CRM. Não vou apontar direto para o site da Encorp, para a página não depender dele. Se o seu kit trouxer fotos diferentes, é só trocar na lista única.
- **Estrutura e estilo:** mesma sequência de seções (hero com vídeo, diferenciais da casa, lazer, localização), fotos grandes, bastante respiro e detalhes de folhagem como no site. As cores e o logo continuam da Uhome (Montserrat, #4969FF).
- **Fica de fora de propósito:** as plantas e os preços que aparecem no site da Encorp, como você pediu.

## O que o lead vê (nesta ordem)
Logo Uhome + "Casa Tua · Canoas" → faixa verde de confirmação → título e subtítulo → vídeo (miniatura + play; o vídeo do YouTube só carrega ao tocar) → chips → galeria horizontal (6–8 espaços com placeholder neutro, lidos de uma lista única) → "Vida de condomínio, espaço de casa" → "Perto de tudo em Canoas" → quiz de 3 toques com barra de progresso → bloco de visita (4 horários + WhatsApp com máscara; botão só habilita com horário e telefone válidos) → tela "Combinado!" → rodapé.
Sem preço, tabela ou planta. Sem o termo "área privativa". Montserrat, azul #4969FF, fundo branco/cinza claro, mobile-first.

## 1. Arquivos
Criar:
- `src/pages/public/CasaTuaCanoasVisita.tsx` — página (fica abaixo de 300 linhas, compondo os blocos abaixo)
- `src/components/landing-casatua-canoas/VideoLite.tsx` — miniatura + iframe ao tocar (`youtube-nocookie.com`, id PovnF-uY58k)
- `src/components/landing-casatua-canoas/GaleriaSnap.tsx` — galeria com scroll-snap
- `src/components/landing-casatua-canoas/QuizToques.tsx` — 3 perguntas + progresso (estado local)
- `src/components/landing-casatua-canoas/ReservaVisita.tsx` — horários, máscara, validação, envio, tela final
- `src/config/landingCasaTuaCanoas.ts` — textos, chips, lazer, proximidades, perguntas, horários e **lista única de fotos**
- `supabase/functions/pagina-empreendimento-resposta/index.ts` — edge function pública
- Migration: tabela `pagina_empreendimento_respostas`

Alterar (apenas adições):
- `src/App.tsx` — 1 import lazy + 1 `<Route>` público
- `src/lib/routePatterns.ts` — adicionar `/v/casa-tua-canoas` em `PUBLIC_ROUTES` (a página não é rastreada como tela interna)
- `supabase/config.toml` — bloco `[functions.pagina-empreendimento-resposta] verify_jwt = false`
- `AGENTS.md` — uma regra: "páginas públicas de empreendimento gravam só via edge function, nunca direto na tabela"

Não mexer: receive-meta-lead, meta-leads-backfill, roleta/distribuição, pipeline_leads, auth, layout autenticado, pageRegistry, página `/casatuacanoas-quiz`.

## 2. Migration proposta
```sql
CREATE TABLE public.pagina_empreendimento_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empreendimento_slug text NOT NULL,
  form_ref text,
  telefone_digitado text NOT NULL,
  telefone_normalizado text,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  periodo_visita text NOT NULL,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  ip_hash text,
  status text NOT NULL DEFAULT 'pendente',
  lead_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.pagina_empreendimento_respostas TO service_role;
GRANT SELECT ON public.pagina_empreendimento_respostas TO authenticated;

ALTER TABLE public.pagina_empreendimento_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e diretor leem respostas"
ON public.pagina_empreendimento_respostas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'diretor'));

CREATE INDEX ON public.pagina_empreendimento_respostas (telefone_normalizado, created_at DESC);
CREATE INDEX ON public.pagina_empreendimento_respostas (ip_hash, created_at DESC);

CREATE OR REPLACE FUNCTION public.trg_pagina_resp_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.telefone_normalizado := public.normalize_telefone(NEW.telefone_digitado);
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER pagina_resp_normalize
BEFORE INSERT OR UPDATE ON public.pagina_empreendimento_respostas
FOR EACH ROW EXECUTE FUNCTION public.trg_pagina_resp_normalize();
```
- Sem acesso anônimo. Ninguém do app grava direto; só a edge function.
- `status` e `periodo_visita` validados pela edge function (sem CHECK, para facilitar mudanças).
- Normalização: usa a mesma `public.normalize_telefone` do trigger de `pipeline_leads`.
- Fica dentro do limite de 1 migration; aplicar fora do horário 08–19h se já houver outra no dia.

## 3. Esboço da edge function `pagina-empreendimento-resposta`
- Apenas POST + OPTIONS (CORS do `_shared/cors.ts`). Corpo limitado a 4 KB (checa `content-length` e o tamanho do texto lido).
- Validação com Zod:
  - `slug`: lista permitida (`casa-tua-canoas`)
  - `f`: texto opcional, até 40 caracteres, `[a-z0-9-_]`
  - `telefone`: 10–11 dígitos depois de limpar
  - `periodo`: um de `sabado_manha | sabado_tarde | domingo | dia_semana`
  - `respostas`: `{ quem?, quando?, peso? }`, cada um de uma lista fixa de valores
  - `utm`: só `utm_source/medium/campaign/content/term`, até 100 caracteres cada
- Rate limit simples consultando a própria tabela: IP (hash SHA-256 com sal, nunca o IP puro) no máximo 5 envios em 10 min; mesmo telefone no máximo 3 em 1 h. Acima disso: 429.
- Insere com a chave de serviço; responde apenas `{ ok: true }`. Nunca lê nem devolve dados de leads.
- Erros registrados em `ops_events`, sem telefone no log.

## 4. Rota no App.tsx
Uma linha junto das rotas públicas já existentes (`/casatua`, `/visita/:token`), antes do layout autenticado e fora do `RoleProtectedRoute`:
```text
<Route path="/v/casa-tua-canoas" element={<Suspense fallback={<PageLoader />}><CasaTuaCanoasVisita /></Suspense>} />
```
O caminho `/v/...` é novo e não conflita com nenhuma rota atual. A página lê `f` e as UTMs com `useSearchParams` e chama a função pelo cliente padrão (`supabase.functions.invoke`), sem login.

## 5. Riscos
- **Navegador do Facebook/Instagram:** pode bloquear o autoplay e ser lento. Mitigação: vídeo só ao tocar, fotos com lazy-load e tamanho reduzido.
- **Spam:** a função é pública. Mitigação: rate limit, validação estrita e limite de tamanho. Um captcha fica para depois, se necessário.
- **App carrega o bundle do CRM:** a rota é lazy, mas o primeiro carregamento inclui a base do app (e o service worker). Vou medir o tempo no celular durante a validação.
- **Duplicidade com `/casatuacanoas-quiz`:** podem existir duas páginas parecidas. Você decide qual fica.
- **LGPD:** a página só grava o telefone que a própria pessoa digitou. O rodapé pode ganhar um link para `/privacidade`.
- **Fotos pendentes:** até você enviar o kit, a galeria mostra placeholders.

## Validação (depois do build)
Mockup aprovado → build → teste no preview em 390px: vídeo abre ao tocar, botão só habilita com horário e telefone válidos, envio mostra "Combinado!", a linha aparece na tabela com `f` e UTMs, o 6º envio seguido recebe o bloqueio. Nada é criado em `pipeline_leads`.
