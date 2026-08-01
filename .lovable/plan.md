# Oferta Ativa — Construtor de campanha personalizado + auditoria das abas

Hoje o botão "Nova campanha" abre um diálogo quase cego: mostra "Empreendimento: Todos", um limite e uma data. Não dá para escolher o público dentro do próprio diálogo, nem definir quem vai ligar. Este plano transforma esse diálogo em um **construtor de lista** de verdade.

## Parte 1 — Construtor de campanha (o foco do pedido)

Diálogo maior, em 3 passos numa tela só:

**1. Público (quem entra na lista)**
- Empreendimento: **seleção múltipla** (hoje é um só, e só herdado da tela anterior)
- Safra: ano de início e fim da última conversão (atalhos: 2024+, 2023, "mais antigos")
- Situação no CRM: inéditos / já na Oferta Ativa / já no pipeline / todos
- Formulário de origem (opcional, multi)
- Somente com telefone · somente com e-mail · apenas nunca liberados em campanha
- **Ordem de seleção**: mais recentes primeiro (padrão), mais antigos, ou aleatório
- Contador ao vivo: "X leads batem no filtro · Y serão liberados"
- **Amostra**: lista dos 10 primeiros leads que entrariam, para conferir antes de criar

**2. Identidade da campanha**
- Nome (sugestão automática, editável)
- Objetivo/observação para o time (aparece no card do corretor)
- Script/roteiro: escolher um template existente da Oferta Ativa
- Limite de leads · data e hora de expiração (atalhos 24h / 3 dias / 7 dias)
- Máx. tentativas por lead e cooldown em dias (hoje ficam no padrão da lista)

**3. Quem vai ligar**
- Todos os corretores (padrão de hoje)
- Ou selecionar equipes e/ou corretores específicos — só eles enxergam a campanha em "Bases ativas"
- Liberar agora ou deixar agendada (status pendente até a data de liberação)

Depois de criar: toast com resumo e a campanha já aparece na aba "Campanhas ativas".

## Parte 2 — Auditoria aba a aba

Revisão ao vivo de cada aba de `/oferta-ativa`, corrigindo o que estiver fora do modelo de campanhas temporárias:

| Aba | O que será conferido |
|---|---|
| Campanhas ativas | Contadores (liberados / na fila / tentativas / aproveitados / conversão), botão Encerrar, escopo por corretor |
| Ao vivo | Se o painel reflete só campanhas dentro da janela |
| Ranking | Se o período e o recorte por equipe batem com o placar |
| Encerradas | Se o histórico mostra devolução à base e datas corretas |
| Reservados | Se os leads reservados respeitam a expiração da campanha |
| Meus resultados | Se o corretor vê os próprios números da campanha atual |
| Configurações | Radar e Templates funcionando; nada de importação legada |

Cada divergência encontrada vira correção na mesma fase, com validação clicando no preview.

## Detalhes técnicos

- **Migração** (1 migration): colunas em `oferta_ativa_listas` — `observacao text`, `template_id uuid`, `ordem_selecao text`, `escopo jsonb` (equipes/corretores) — e nova função `criar_campanha_da_base_v2(p_nome, p_filtro, p_config)` aceitando arrays de empreendimento/formulário, `com_email`, `ordem_selecao`, `max_tentativas`, `cooldown_dias`, `escopo`. A função atual continua existindo até o novo diálogo estar validado.
- `preview_campanha_da_base` ganha os mesmos parâmetros novos + retorno com amostra (`jsonb` com `total` e `amostra`).
- **Frontend**: `CriarCampanhaDialog.tsx` reescrito (dividido em `PassoPublico`, `PassoIdentidade`, `PassoEscopo` para não passar de 300 linhas); `useBaseLeads.ts` ganha `usePreviewCampanhaV2` e `useCriarCampanhaV2`; `BaseLeadsFiltro` passa a aceitar arrays.
- **Visibilidade por escopo**: `useOAListas` e `CorretorListSelection` filtram pelo `escopo` (vazio = todos), sem mexer nas RLS existentes.
- Nada é apagado: campanhas já criadas continuam válidas com escopo vazio.

## Ordem de execução

1. Migração (colunas + funções v2)
2. Novo diálogo construtor + preview com amostra
3. Escopo por equipe/corretor na visão do corretor
4. Auditoria aba a aba e correções
