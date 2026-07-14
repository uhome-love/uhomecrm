# HOMI Copiloto — Fase 3: Contexto do lead + busca de imóvel simplificada

## Problema
Quando o corretor pede "escreve um follow-up pra Marilá", o Homi pergunta "qual o momento dela no funil?" em vez de olhar o histórico. Hoje a geração de mensagem não puxa nada do lead, e o `resumo_lead` só lê etapa + última atividade + próximas tarefas — nunca a timeline completa nem as anotações. Além disso, a busca de imóvel ainda tem muitos campos/chips e fica trabalhosa.

## Como vai funcionar (decisões aprovadas)
- Ao pedir mensagem/follow-up para um lead **pelo nome**, o Homi **lê o histórico sozinho** (timeline + anotações), mostra um **mini-resumo do que entendeu** e **em seguida já gera a mensagem** — sem ficar perguntando.
- Fontes: `pipeline_atividades` (timeline) + `pipeline_anotacoes` (observações do corretor), além de etapa/substatus já disponíveis.

---

## Parte 1 — Homi analisa o lead em vez de perguntar

**Nova ferramenta `contexto_lead`** (edge `homi-tools.ts`), read-only, escopada por RLS:
- Resolve o lead pelo nome (reusa `resolveLead`).
- Lê etapa (`pipeline_stages`) + substatus (`flag_status`), últimas ~8 entradas de `pipeline_atividades`, últimas ~5 `pipeline_anotacoes`, próximas tarefas e imóveis vinculados.
- Retorna resumo estruturado + textos crus para o modelo redigir com base real.

**Prompt do copiloto** (`homi-chat/index.ts`):
- Quando o pedido for **mensagem / follow-up / script para um lead nomeado**, **primeiro chamar `contexto_lead`** e **nunca perguntar "qual o momento no funil"** — deduzir do histórico.
- Fluxo "ler, mas confirmar antes": responde com **mini-resumo curto** ("Marilá está em Aquecimento, última ação foi visita marcada dia X, sem resposta desde então") **seguido da mensagem pronta** no mesmo turno.
- Só pergunta se não houver histórico nenhum (lead novo).

**UI** (`HomiActionCard.tsx`): cartão leve de contexto (etapa, última interação, nº de anotações) acima da mensagem gerada.

---

## Parte 2 — Busca de imóvel em campo único

- Substituir o `ImovelSearchCard` atual (bairro + chips de dorms + valor) por **um único campo de texto** ("Ex.: 2 dorms no Petrópolis até 600 mil").
- A ferramenta `buscar_imovel` já tokeniza texto livre; o formulário passa a enviar só `termo`. Dormitórios/valor continuam sendo **extraídos do texto** pelo modelo/tokenizer, sem chips na tela.
- **Resultados inalterados**: cada imóvel segue com **link personalizado** (`uhome.com.br/c/{slug}/imovel/{slug}`) e botões **Copiar mensagem** e **WhatsApp** com texto pronto.

---

## Parte 3 — Registrar resultado de contato

Nova ferramenta `registrar_resultado` (proposta com confirmação):
- "Liguei na Marilá e não atendeu" / "falei com o João, quer visitar sábado".
- Homi classifica (`nao_atendeu`, `atendeu_sem_interesse`, `atendeu_interessado`, `pediu_retorno`, `agendou_visita`) e monta cartão de confirmação.
- Ao confirmar (`useHomiActions`): grava em `pipeline_atividades` e **sugere a próxima tarefa** coerente (não atendeu → tentar amanhã; interessado → marcar visita), abrindo o composer pré-preenchido.

---

## Parte 4 — Detecção de leads esfriando

Nova ferramenta `leads_esfriando` (read-only):
- Lista leads sem atividade há X dias (padrão 5), ativos no pipeline, ordenados pelo tempo parado.
- Cada item com ações em 1 toque: **💬 Reengajar** (mensagem com contexto via `contexto_lead`), **📋 Tarefa**, **👤 Abrir lead**.
- Botão rápido novo no `HomiPanel` ("❄️ Esfriando") + linguagem natural.

---

## Parte 5 — Preparação de visita

Nova ferramenta `preparar_visita` (read-only):
- Para visitas de hoje/amanhã (ou lead nomeado), gera **briefing pré-visita**: quem é o lead, histórico resumido, imóvel de interesse e 2-3 argumentos de venda usando o conhecimento do empreendimento.
- Acessível pelo cartão "Visitas de hoje" (botão **📋 Preparar**) e por texto.

---

## Arquivos afetados
- `supabase/functions/homi-chat/homi-tools.ts` — `contexto_lead`, `registrar_resultado`, `leads_esfriando`, `preparar_visita`; leitura de histórico ampliada; `buscar_imovel` só com termo.
- `supabase/functions/homi-chat/index.ts` — registrar ferramentas + regras de prompt.
- `src/components/homi/HomiActionCard.tsx` — cartão de contexto, busca de imóvel campo único, resultado de contato, lista esfriando, briefing de visita.
- `src/contexts/HomiContext.tsx` — roteamento dos novos composers/resultados.
- `src/components/homi/HomiPanel.tsx` — botões rápidos "❄️ Esfriando" e "📋 Preparar".
- `src/hooks/useHomiActions.ts` — `confirmarResultado`.

Sem migração de banco. Toda escrita continua exigindo confirmação do corretor.

## Validação ponta a ponta (como corretora Adriana)
1. Follow-up de lead com histórico → mini-resumo + mensagem, **sem perguntar** o momento.
2. Lead sem histórico → pede o mínimo.
3. Busca "2 dorms Petrópolis até 600 mil" em campo único → resultados com link + mensagem pronta.
4. "Liguei e não atendeu" → cartão de resultado → confirma → atividade + próxima tarefa.
5. "Quais leads estão esfriando?" → lista com ações.
6. "Prepara a visita da Marilá" → briefing com imóvel + argumentos.
