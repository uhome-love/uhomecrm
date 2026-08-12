# Quiz Casa Tua Santos Ferreira (`/casatuacanoas-quiz`) — visita agendada + pixel isolado

## (a) O que existe hoje

**Onde vive**
- Página única: `src/pages/CasaTuaCanoasQuiz.tsx` (391 linhas, DOM imperativo dentro de um `useEffect`, CSS embutido).
- Rota pública em `src/App.tsx`: `/casatuacanoas-quiz`, via `lazyRetry` (fora do AppLayout, sem auth). Não há pageRegistry envolvido.
- Fluxo: espia rápida → P1 tipologia → P2 prioridade → P3 forma de compra → nome → WhatsApp → Book (download PDF) → escolha: "garantir visita" (dia + turno) ou "falar com corretor" → tela final.

**Pixel (hoje)**
- `META_PIXEL_ID = "1426170849536314"` — sim, é o pixel de imóveis, inicializado nessa página (linha 16/124).
- Dispara `PageView` + eventos **custom** apenas: `QuizInicio_CasaTuaSF`, `QuizComecou_CasaTuaSF`, `QuizP1Tipologia_CasaTuaSF`, `QuizP2Prioridade_CasaTuaSF`, `QuizP3Compra_CasaTuaSF`, `QuizNome_CasaTuaSF`, `QuizWhatsApp_CasaTuaSF`, `GuiaBaixado_CasaTuaSF`, `VisitaAgendada_CasaTuaSF` / `FalarComCorretor_CasaTuaSF`.
- **Não** dispara o evento padrão `Lead`. Nenhum outro arquivo do app inicializa `fbq` além de `VagaPage.tsx` (pixel dedicado de recrutamento `2291720528296050`).

**Captura do lead**
- Já grava **cedo**: logo após o WhatsApp (`qZap`) chama `enviarLead("parcial", …)`; grava de novo no fim (`finish`).
- Endpoint: `POST {EDGE_BASE_URL}/functions/v1/receive-quiz-lead` com apikey anon.
- A função grava em `pipeline_leads`: stage `novo_lead`, `origem = 'Quiz'`, `corretor_id = null`, `aceite_status = 'pendente_distribuicao'` → **cai na Fila CEO**, não na roleta (o comentário no topo do arquivo dizendo "roleta via receive-landing-lead" está desatualizado). `campanha = "Casa Tua Santos Ferreira — Quiz"`, `plataforma = "Quiz Casa Tua Canoas"`, `empreendimento = "Casa Tua Santos Ferreira"`, `origem_detalhe = "casatua_canoas_quiz"`, respostas em `form_respostas`, `fbc/fbp/user_agent/event_source_url` preenchidos.
- Anti-duplicação: a 2ª chamada (fim) **enriquece** o lead parcial em vez de duplicar (match por telefone + origem Quiz + sem dono).
- Hoje não há nenhum lead gravado com `origem='Quiz'` no banco (funil ainda sem tráfego real).

**Final**
- Download do Book (PDF estático `/casatua/guia-casa-tua-santos-ferreira.pdf`) + tela de "visita pré-agendada" que é **só texto**: nada é escrito na tabela `visitas`, nenhum corretor é notificado, o lead fica em Novo Lead na Fila CEO. Dia+turno viram só texto no `message`/`form_respostas`.

**Plantão / visitação**
- Não existe no CRM nenhuma tabela de agenda/escala de plantão por empreendimento (só `visitas`, `visita_amanha_config`, `corretor_disponibilidade` — esta última é turno de roleta, sem empreendimento nem horário de stand).
- Existem **15 corretores alocados** ao empreendimento canônico "Casa Tua Canoas" (`corretor_alocacao`), e visitas históricas usam `local_visita` livre (ex.: "PLANTÃO CASA TUA", "STAND CASA TUA").
- Conclusão: **não dá pra cravar horário exato** hoje. O caminho correto é preferência **dia + turno**, com hora a confirmar.

## (b) Plano (aditivo, escopo estrito)

### Bloco B — Pixel isolado (rápido, sem backend)
Arquivo único: `src/pages/CasaTuaCanoasQuiz.tsx`
- Trocar `META_PIXEL_ID` de `1426170849536314` para o **novo dataset dedicado** (ID que o Lucas criar).
- Inicializar com `fbq('init', PIXEL, {}, {agent:'uhome-casatua'})` e disparar sempre com `trackSingleCustom` / `trackSingle` no ID dedicado, para nunca vazar evento para outro pixel caso o `fbq` já exista na página.
- Renomear os customs para o padrão pedido: `VisitaIniciou` (abriu), `VisitaContato` (nome+WhatsApp), `VisitaQuizCompleto` (3 perguntas + Book liberado), `VisitaAgendada` (dia+turno confirmados) — mantendo `FalarComCorretor` como custom separado.
- Confirmar (já é o caso) que o evento padrão `Lead` nunca é disparado.

### Bloco A — Terminar em visita agendada de verdade
1. **Migration aditiva** (só colunas nullable, nenhum drop):
   - `pipeline_leads`: `preferencia_visita_dia date NULL`, `preferencia_visita_turno text NULL`.
   - `visitas`: nenhuma coluna nova (já tem `pipeline_lead_id`, `empreendimento_canonico_id`, `origem_detalhe`, `hora_visita` nullable). Grava `origem = 'quiz'`, `status = 'agendada'`, `local_visita = 'Plantão Casa Tua · Av. Santos Ferreira, 3511 — Canoas'`, `hora_visita = null` (turno em `observacoes`).
2. **Edge function nova** `quiz-visita-agendar` (pública, verify_jwt=false, sem segredo — mesmo padrão de `receive-quiz-lead`):
   - Entrada: `pipeline_lead_id` (ou telefone), `dia`, `turno`.
   - Escolhe o corretor de plantão: round-robin entre os corretores de `corretor_alocacao` que têm o canônico Casa Tua Canoas, preferindo quem está `na_roleta` no turno atual; atribui o lead (`corretor_id`, `aceite_status='aceito'`) — se nenhum elegível, mantém o lead na Fila CEO e cria a visita com o CEO como responsável.
   - Move o lead para o stage `visita` (`a857139f-…`), grava `flag_status.status_visita = 'marcada'` e as preferências.
   - Insere em `visitas` com `pipeline_lead_id`, `empreendimento_canonico_id = 5f28344e-…`.
   - Notifica o corretor via `criar_notificacao` (+ notificação para admin/diretor, como o `receive-quiz-lead` já faz).
   - Registra atividade em `pipeline_atividades` (histórico do lead).
3. **Captura cedo**: manter o `enviarLead("parcial")` no passo do WhatsApp (já existe) e apenas garantir que ele **aguarde** a resposta e guarde o `lead_id` retornado, para o passo de visita reusar o mesmo lead em vez de depender do match por telefone.
4. **Frontend** (`CasaTuaCanoasQuiz.tsx`): após dia+turno, chamar `quiz-visita-agendar`; a tela final passa a mostrar "Visita agendada" com o nome do corretor quando houver. Book continua como bônus, download inalterado.

**Arquivos tocados:** `src/pages/CasaTuaCanoasQuiz.tsx`, `supabase/functions/quiz-visita-agendar/index.ts` (novo), 1 migration aditiva, `supabase/config.toml` (registro da função). Nada mais.

### Ordem sugerida
Fase 1 = Bloco B (pixel, 1 arquivo, validar no Events Manager). Fase 2 = Bloco A (migration + edge + frontend), validando com um lead de teste ponta a ponta.

## (c) Riscos e dependências do Lucas
- **Depende do Lucas:** criar o dataset/pixel dedicado no Gerenciador de Eventos e me passar o ID (sem ele o Bloco B não sai). Se quiser CAPI nesse dataset depois, precisa também do access token — fora do escopo agora.
- **Depende do Lucas (decisão):** confirmar o rodízio de plantão. Sem escala cadastrada, a regra proposta é round-robin entre os 15 alocados do Casa Tua Canoas; se existe uma escala real (planilha/WhatsApp), o ideal é cadastrar depois numa tabela de plantão — fase futura.
- **Risco:** visita criada sem hora exata polui relatórios de visitas se ninguém confirmar. Mitigação: entra como `status='agendada'` (não realizada) e o corretor confirma pelo fluxo de visita já existente.
- **Risco:** troca de pixel zera o aprendizado das campanhas atuais desse funil; migrar junto com a criação do conjunto de anúncios novo.
- **Risco baixo:** mudar os nomes dos eventos custom quebra públicos/conversões já criados no pixel antigo — como o funil ainda não tem lead gravado, o impacto é mínimo.
