# Lia · agente de atendimento WhatsApp (Casa Tua Santos Ferreira, Canoas)

Caixa isolada, dono único, sem escrever no pipeline dos corretores. Passagem para o pipeline só por botão.

---

## Parte 1 — Os cinco levantamentos (feitos, resultado real)

**1) `receive-meta-lead` falhando em silêncio — a falha existiu, mas já passou.**
Contagem semanal dos últimos 90 dias em `pipeline_leads`:

```text
semana        backfill   webhook(ig+fb+meta_ads)
04/05 a 08/06      0..16      30 / 228 / 221 / 204 / 178 / 123
15/06            202             9
22/06            203             6
29/06            278             5
06/07            118            89
13/07 em diante    9      211 / 283 / 306 / 269
```

O número "745 backfill x 207 webhook" é a janela 15/06–10/07, quando o webhook parou e o backfill segurou tudo. De 13/07 até hoje o webhook voltou: nos últimos 30 dias são **1.128 pelo webhook contra 58 pelo backfill** (o backfill agora só cata resíduo, que é o papel dele). Não há erro recorrente no log: em 30 dias, `receive-meta-lead` registra 23 `meta_native_webhook_partial` e 2 `Lead insert failed`, todos em 30/07 e nada depois.
Conclusão: não é bug aberto, foi **queda de assinatura do webhook no app Meta** naquele período. O que falta é **detecção** — hoje ninguém é avisado quando o webhook para. Proponho na Fase 0 um alerta simples: se em 6h houver leads via backfill e zero via webhook, alerta no `/admin/ingestao` + push ao CEO. Sem isso, a Lia herdaria o mesmo silêncio.

**2) `evolution-webhook` sem autenticação.**
O código já lê `apikey` do header ou da query, compara com `EVOLUTION_API_KEY` e **só loga** (`auth-log-only`, `ops_events.evolution_webhook_auth_missing`) — nunca recusa. Não dá para confirmar a versão do Evolution pelo código (só existe `EVOLUTION_API_URL` como segredo). Portanto o `lia-webhook` nasce com autenticação por **duas vias em série, sem depender de header customizado**: segredo obrigatório na **query string** da URL do webhook (`?k=<LIA_WEBHOOK_SECRET>`, suportado por qualquer versão) **mais** validação do `apikey` quando presente, mais checagem de que a `instance` do payload é a instância da Lia e nada mais. Se a versão em uso suportar header customizado, ele vira uma terceira camada sem mudar nada. Não estendo o `evolution-webhook` atual.

**3) Instâncias Evolution.**
`whatsapp_instancias` está **vazia** (0 linhas) e `whatsapp_mensagens` tem tráfego de uma única instância, `uhome-27f9fc2d`, parado desde **09/06/2026**. Ou seja: não há instância viva para reaproveitar. A Lia precisa de instância nova e dedicada, sugestão `uhome-lia-canoas`, com número novo, registrada em `ia_config`. Preciso da sua confirmação do número.

**4) Autoria da Lia em `whatsapp_mensagens`.**
Colunas hoje: `lead_id, corretor_id, instance_name, direction (in|out|note), body, media_url, whatsapp_message_id, timestamp, delivery_status, quoted_message_id, media_type`. **Não há coluna de autoria.** Durante o atendimento a conversa vive em `ia_mensagens` (a regra de privacidade em vigor manda logar em `whatsapp_mensagens` só quem está em `pipeline_leads`). Na migração, a menor mudança aditiva possível: **uma coluna `autor text NULL`** em `whatsapp_mensagens`, preenchida com `'lia'` nas linhas replicadas e `NULL` em todo o resto. Nada existente muda de comportamento.

**5) Opt-out hoje.**
Não existe `nao_recontatar` em `pipeline_leads` (só `telefone`, `telefone2`, `telefone_normalizado`). O opt-out real está em dois lugares: `base_leads.opt_out` / `opt_out_motivo` e `meta_supressao` (com `telefone_last8`). Como você previu, é **por telefone**, não por card — e é assim que a Lia vai checar: normaliza, e consulta `meta_supressao` + `base_leads.opt_out` + `pipeline_leads.telefone_normalizado` + `ia_leads`, na entrada **e** antes de cada envio.

---

## Parte 2 — Plano de build

### Fase 0 · Fundação (1 migration)
Cria as tabelas novas, todas aditivas, nenhuma alteração em `pipeline_leads`, stages, roleta, distribuição ou RLS existente: `ia_leads`, `ia_mensagens`, `ia_eventos`, `ia_followups`, `ia_perfil_busca`, `ia_apresentacoes`, `ia_config`, `ia_prompt_versoes`. Todas com `GRANT` + RLS restrita a `admin` (o enum é `admin/diretor/gestor/corretor/backoffice/rh`; CEO = admin) e `service_role` para as functions. Etapa IA como enum próprio (`entrada, bloqueado, atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado, migrado`) — etapa fora da lista é recusada pelo banco, não vira gravação genérica. Junto: alerta de webhook Meta parado (item 1) e commit do prompt em `supabase/functions/lia-brain/prompt/lia-canoas-v3.1.txt`.

### Fase 1 · Entrada e caixa
`lia-webhook` (autenticado como no item 2), `lia-cron` de minuto em minuto (poll da Graph API escopado aos `form_id` da Lia + fila de follow-up + confirmações) e o desvio nas duas functions existentes: `receive-meta-lead` e `meta-leads-backfill` consultam `ia_config.form_ids_lia`; se bater, grava em `ia_leads` e para ali. Lista vazia = comportamento idêntico ao de hoje. Checagem de telefone na entrada com os três desfechos (atende / Bloqueado com aviso ao dono / atende salvo opt-out).

### Fase 2 · Cérebro e travas
`lia-brain`: contexto montado por código (nunca por tool call), chamada pelo Lovable AI Gateway com constante única `LIA_MODEL`, saída no contrato JSON da seção 7, validada antes de qualquer gravação. As travas rodam **depois** do modelo e **antes** do envio, em código: agenda real em BRT (10h–20h, mínimo 2h, nunca passado), janela de envio 08h–23h59 com colapso da fila da madrugada em um envio, texto repetido, travessão e frases proibidas, arredondamento para baixo, teto de 3 mensagens/turno e 3 mídias/conversa, zero áudio, opt-out gravado antes do envio de encerramento, flag `qualificado LIA`.

### Fase 3 · Tela `/lia` (admin)
Quadro por etapa com contagem e tempo médio · sala ao vivo com realtime e os botões assumir e pausar · fila de follow-up com cancelar e antecipar · mesa de decisão com os resumos de sete campos · saúde e freio com estado da instância, volume, erro, bloqueios, janelas e kill switch de um clique. Nada disso entra em dashboard, forecast ou métrica de corretor.

### Fase 4 · Migração (1 migration: coluna `autor` + RPC idempotente)
Botão com destino, etapa de entrada e se a Lia segue nas confirmações. RPC única e idempotente (chave: `ia_leads.id`, dois cliques não geram dois cards): cria o card com atribuição manual direta (já bypassa a roleta), replica a thread em `whatsapp_mensagens` com `autor='lia'`, grava o resumo como `direction='note'`, cria a visita, registra em `pipeline_historico` e marca `migrado` com o ponteiro. Telefone já ativo: anexa ao card existente e notifica o dono. Perfil de busca e transferência vão para a mesa, nunca para a roleta. Notificações ao CEO (push, in-app, WhatsApp) em qualificado, perfil capturado e transferência, com escalonamento em D-1 para apresentação sem dono.

### Fase 5 · Testes e liberação
Linha de base de 20 perguntas gravada antes de qualquer mudança de comportamento. Os testes determinísticos da seção 10 como suíte no repositório; **um teste de linha vermelha reprovado bloqueia o release**, sem média ponderada. Liberação em sombra → assistido → autônomo, com volume subindo devagar.

### Regras de execução
Máximo 2 migrations por dia entre 08h e 19h BRT → Fase 0 e Fase 4 são as únicas migrations, em dias diferentes. Uma fase por rodada, validada no preview antes da próxima.

### O que NÃO é tocado
`pipeline_leads`, `pipeline_stages`, triggers e RLS existentes, roleta e distribuição, `evolution-webhook` atual, `whatsapp_mensagens` (exceto a coluna aditiva `autor` na Fase 4), reengajamento e Oferta Ativa.

### Decisões que preciso de você
1. Número e nome da instância dedicada (sugestão `uhome-lia-canoas`).
2. Os `form_id` da campanha da Lia.
3. Confirmar a Fase 0 como primeira rodada.
