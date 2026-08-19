# História do lead invisível para o gerente — diagnóstico e correção

## O que está acontecendo (confirmado nos dados)

Não é carregamento. É permissão de leitura (RLS) na tabela de atividades do lead (`pipeline_atividades`), que é a fonte da aba **Narrativa** da História.

A regra de leitura atual só deixa o gestor ver uma atividade quando o campo **responsável** dela aponta para alguém da equipe dele. O problema: **50.136 das 55.075 atividades do sistema estão com o responsável em branco** (a maioria dos registros feitos pelo corretor grava só o "criado por").

Resultado:
- O corretor vê tudo (ele é o criador e/ou o dono do lead).
- O gerente vê a aba vazia, mesmo com o lead sendo da equipe dele.

Números do caso do Gabriel Vieira (gestor): **17.838 atividades de leads da equipe dele estão invisíveis** por essa regra.

As outras fontes da História (movimentações de etapa e anotações) já liberam gestor — por isso aparece "Sistema 1" e "Narrativa 0" na tela dele.

## Correção proposta

1. **Regra de leitura por dono do lead (1 migration)**
   Ampliar a política de SELECT de `pipeline_atividades`: o gestor passa a ver a atividade quando o **lead pertence a um corretor da equipe dele** (via `team_members`), independentemente do campo responsável. Diretoria e admin seguem vendo tudo; corretor continua vendo apenas o que é dele. Nada é afrouxado além disso.

2. **Preencher o responsável nos registros novos (frontend)**
   Nos pontos que criam atividade sem responsável (registro de atividade pela Agenda e pelo drawer do lead, ações rápidas, modo foco), passar o corretor dono do lead como `responsavel_id`. Isso deixa o dado correto daqui pra frente, sem depender só da regra ampliada.

3. **Backfill do responsável (mesma migration)**
   Preencher `responsavel_id` das atividades antigas com o corretor do lead quando estiver em branco, para que relatórios e filtros por responsável voltem a bater.

## Validação

- Antes/depois: contar as atividades visíveis para o Gabriel em 3 leads da equipe dele.
- Abrir um lead de teste no preview logado como gerente e conferir a aba História > Narrativa com os registros do corretor.
- Confirmar que corretor de outra equipe **não** passou a enxergar nada novo.

## Detalhes técnicos

- Tabela: `public.pipeline_atividades`, política `pa_select_scoped`.
- Nova condição adicional: `EXISTS (select 1 from pipeline_leads pl join team_members tm on tm.user_id = pl.corretor_id where pl.id = pipeline_atividades.pipeline_lead_id and tm.gerente_id = auth.uid() and tm.status = 'ativo')`.
- Backfill: `update pipeline_atividades a set responsavel_id = pl.corretor_id from pipeline_leads pl where pl.id = a.pipeline_lead_id and a.responsavel_id is null and pl.corretor_id is not null`.
- Frontend: `RegistrarAtividadeModal.tsx`, `QuickActionMenu.tsx`, `FocusModeModal.tsx`, `CallFocusOverlay.tsx`, `LeadTarefasTab.tsx` — incluir `responsavel_id` no insert.
- Regra de migrations respeitada: 1 migration só (DDL da política + backfill em um bloco).
