# HOMI inteligente — missões do dia + ações com confirmação

Nada foi alterado. Este plano é só leitura e proposta.

## 1. O que existe hoje (conferido)

**O que o HOMI lê sobre um lead** (`contexto_lead` / `readLeadHistory`): confirmado. Ele lê a etapa, o `flag_status`, o empreendimento, as últimas 8 atividades e as últimas 5 anotações. Não filtra lead arquivado. A busca por nome traz até 6 leads do corretor.

**O que ele NÃO lê:** visitas, `pipeline_tarefas`, `pipeline_historico`, formulário/anúncio de origem, `lia_conversas`, `whatsapp_respostas`, `oferta_ativa_tentativas`, `negocios`, `pipeline_parcerias`, `lead_property_matches` e `site_events`.
- `site_events`: só 6 de 378.612 eventos têm `pipeline_lead_id`. Na prática, não serve como fonte agora.
- `homi_memoria_lead`: está vazia (0 linhas).

**Ferramentas atuais:** são 22, entre elas `criar_tarefa`, `criar_visita`, `anotar_lead`, `registrar_resultado`, `visitas_a_confirmar`, `meu_dia` e `briefing_do_dia`.

**Modelos:**
- O modelo rápido (`HOMI_CHAT_MODEL`, gemini-3.6-flash) é usado em `homi-chat/index.ts`.
- O modelo de raciocínio (`HOMI_REASONING_MODEL`, gemini-3.1-pro-preview) está declarado, mas nenhuma função usa.

**Fila do dia (`useFilaDoDia`):** ela funciona por gatilhos, nesta ordem: Negócio, Pós-visita, No-show, Novo (menos de 24h), Retorno (tarefa vencida ou de hoje), Esfriando e, por último, Vermelho sem tarefa. A fila tem no máximo 40 leads. O "Sem contato" fica num bloco separado de cadência.
- **Divergência com o pedido:** hoje não existe a regra "no-show dos últimos 7 dias" (no-show entra sem limite de idade). Também não existe um bloco "confirmar visitas": as visitas de hoje só aparecem nos lembretes. Amarelo sozinho não entra na fila.

**Saúde do lead:** o código da tela (`leadSaude.ts`) e o banco (`lead_saude_status`) usam os mesmos prazos. Mas o amarelo é calculado de forma diferente:
- na tela, o amarelo vai até o menor valor entre 2× o prazo e o limite de estagnação menos 3 dias;
- no banco, vai sempre até 2× o prazo.
- Resultado: um mesmo lead pode aparecer com cores diferentes.

**`homi_saude_leads`:** esta lista conta leads arquivados, porque não tem filtro de `arquivado`. Ela já exclui venda, caiu, descarte e convertido.

**Telas e papéis (`pageRegistry`):**
- Parte das telas não declara papel e fica aberta a todos os logados: `/`, `/pipeline`, `/tarefas`, `/visitas`, `/agenda-visitas`, `/homi`, `/imoveis`, `/materiais`, `/minhas-vitrines`, `/oferta-ativa`, entre outras.
- Gestão (gestor/diretor/admin): `/central-do-gerente`, `/meu-time`, `/leads-estagnados`, `/busca-leads`.
- Direção (admin/diretor): `/ceo`, `/diretora`, `/financeiro`, `/base-leads`.
- Só admin: `/roleta`, `/admin`, `/central-nutricao`, `/auditoria`.

**Outros pontos:**
- As visitas já têm os campos `confirmed_at` e `cancel_reason`.
- Não existe uma tabela de uso e custo de IA.
- `whatsapp-notificacao` já envia templates Meta.
- `send-push` envia avisos no celular e remove inscrições inválidas.

## 2. Proposta

Cada fase passa por desenho → plano → sua aprovação → construção → conferência ao vivo.

**Fase 0 — Desenho da tela de missões (`/homi`)**
- Cartões de missão com a contagem de cada bloco (no-show, confirmar visitas, tarefas de hoje, vermelho/amarelo, sem contato).
- Lista de leads em cada missão, com o botão "Fazer com o HOMI".
- O chat vira uma gaveta lateral.

**Fase 1 — Dossiê do lead (só leitura)**
- Nova função `homi_dossie_lead(p_lead uuid)`, que respeita as permissões do corretor. Ela devolve um resumo por fonte, com data e fonte de cada fato:
  - etapa e histórico de etapas;
  - as 3 próximas e as 3 últimas visitas;
  - tarefas pendentes;
  - as últimas 5 atividades e 3 anotações;
  - a origem (formulário/anúncio/campanha);
  - negócio e parceria ativos;
  - as 3 últimas tentativas da Oferta Ativa;
  - as 3 últimas mensagens da Lia e do WhatsApp;
  - os 3 melhores imóveis indicados.
- `site_events` fica de fora até ter vínculo com o lead.
- Nunca vai histórico bruto para a IA.
- A ferramenta `contexto_lead` passa a usar o dossiê.

**Fase 2 — Missões do dia**
- Nova função `homi_missoes_do_dia(p_user uuid)`, calculada no banco e em horário de Brasília.
- Ela usa as mesmas regras da fila do dia e de `lead_saude_status`, e devolve os 5 blocos pedidos.
- **Decisão sua antes de construir:**
  - "no-show 7 dias" e "confirmar visitas" são regras novas. Hoje elas não existem na fila do dia.
  - Também é preciso escolher qual regra de amarelo vale: a da tela ou a do banco. A ideia é unificar as duas numa só.
- A lista `homi_saude_leads` passa a excluir leads arquivados.

**Fase 3 — Manual vivo do CRM**
- Um arquivo gerado a partir do `pageRegistry` e das regras: saúde, estagnação, roleta, e visita que só vira "realizada" depois do horário.
- Para cada tela: o que faz, quem acessa e o link direto.
- O HOMI usa o manual para explicar as regras e levar o corretor à tela certa.

**Fase 4 — Ações com prévia e confirmação**
- Novas ferramentas: concluir/reagendar tarefa, confirmar/remarcar visita (gravando `confirmed_at` e `cancel_reason`), mover etapa, marcar parceria, montar vitrine e descartar com motivo.
- Cada ação mostra uma prévia e só grava quando o corretor clica em "Confirmar".
- As gravações reaproveitam os fluxos que já existem: o modal de registrar atividade, `registrarResultadoVisita`, a mudança de etapa do Pipeline, `encerrar_parceria` e o descarte com classificação. Nenhuma ação passa por fora deles.

**Fase 5 — Escolha do modelo e qualidade**
- Modelo rápido para mensagens e perguntas comuns, com raciocínio baixo.
- Modelo de raciocínio só para o plano do dia, o resumo semanal e as perguntas escaladas.
- A instrução de cada tarefa leva só as ferramentas daquela tarefa, com a parte fixa em cache.
- A mensagem sugerida para cada lead é guardada até o histórico do lead mudar.
- Um verificador no código confere as regras do Método Uhome v1.0: "você", 1 pergunta, até 4 linhas e nenhuma frase proibida. Se a mensagem falhar, o HOMI tenta mais uma vez.

**Fase 6 — Testes de qualidade (evals)**
- Bateria de cerca de 40 casos: perguntas de dado, pedidos de ação (a prévia tem que aparecer e não pode gravar sozinho), regras do CRM e mensagens no padrão do Método.
- Os casos rodam com um lead de teste.

**Fase 7 — Uso de IA, registro de missões e avisos**
- Tabela `homi_ia_uso`: tokens e custo por chamada, por função e por corretor. Tem um teto diário configurável e alerta.
- Tabela `homi_missao_eventos`: missão vista, aberta e concluída.
- Nova função `homi-avisos`, às 08h30 e às 18h30 (horário de Brasília):
  - envia pelo template Meta preenchido com números do banco, sem IA;
  - o aviso da manhã tem um botão de resposta rápida;
  - limite de 4 avisos por dia para cada corretor;
  - registra a entrega.

## 3. Arquivos que serão alterados
- `src/pages/HomiWorkspace.tsx`, mais novos componentes em `src/components/homi/missoes/` e o hook `useHomiMissoes`.
- `supabase/functions/homi-chat/{index.ts,homi-tools.ts}` e `_shared/homi-brain.ts`.
- Novos: `_shared/homi-dossie.ts`, `_shared/homi-metodo-validador.ts` e `_shared/homi-manual.ts` (gerado).
- Nova função `homi-avisos` e o agendamento dela.
- Testes em `src/test/homi/` e `supabase/functions/homi-chat/*_test.ts`.

## 4. Migrations
No máximo 2 por dia, entre 08h e 19h (Brasília):
1. Dia 1: dossiê + missões + ajuste da lista de saúde.
2. Dia 2: `homi_ia_uso` + `homi_missao_eventos`.
3. Dia 3: agendamento dos avisos.

## 5. Riscos
- Regras diferentes entre a tela de missões e a fila do dia. Para evitar, a regra fica num lugar só, no banco.
- Custo de IA. Para evitar, há teto diário e o modelo forte só nos casos pedidos.
- Ação gravada errada. Para evitar, toda gravação exige confirmação e passa pelos fluxos que já existem.
- Avisos em excesso pelo WhatsApp. Para evitar, limite de 4 por dia e registro de entrega.

## 6. O que NÃO muda
- Pipeline (etapas e distribuição), Roleta, Oferta Ativa, Reengajamento/Lia e CAPI.
- O HOMI nunca envia mensagem para cliente e nunca grava sem confirmação.
- Contagens sempre por regra no banco, nunca por IA.
- Preço e disponibilidade só de fonte oficial.
