# Lia · agente de atendimento WhatsApp (Casa Tua Santos Ferreira, Canoas) — v2

Caixa isolada, dono único, sem escrever no pipeline dos corretores. Passagem para o pipeline só por botão. Esta versão incorpora as correções da sua resposta de 08/08.

---

## Parte 1 — Levantamentos (mantidos)

1. **`receive-meta-lead`**: não há bug aberto. O webhook caiu entre 15/06 e 10/07 e voltou em 13/07 (últimos 30 dias: 1.128 webhook x 58 backfill). O que falta é detecção.
2. **`evolution-webhook`**: autenticação hoje é log-only (`apikey` em header/query, comparado com `EVOLUTION_API_KEY`, nunca recusa). O `lia-webhook` nasce recusando.
3. **Instâncias**: `whatsapp_instancias` vazia; último tráfego em `whatsapp_mensagens` é de `uhome-27f9fc2d`, parado em 09/06/2026. Canal WhatsApp está morto no CRM hoje.
4. **Autoria**: `whatsapp_mensagens` não tem coluna de autor. Menor mudança aditiva = `autor text NULL` (Fase 4).
5. **Opt-out**: por telefone, em `base_leads.opt_out`/`opt_out_motivo` e `meta_supressao` (`telefone_last8`). Não existe `nao_recontatar` em `pipeline_leads`.

---

## Parte 2 — Correções aceitas (o que muda no plano)

**Alerta de ingestão com duas condições.** Além de "backfill trazendo lead e webhook zerado em 6h", dispara também **campanha ativa gastando com zero leads em 6h**. Sem a segunda, formulário morto fica igual a sábado fraco.

**Segredo do webhook.** `?k=<segredo>` continua sendo a via que não depende de versão, com três condições: (a) **nunca logar URL crua** — log só de path + instância + resultado; (b) o segredo **vive em `ia_config`**, com rotação programada e aceitação de dois valores durante a virada; (c) **par obrigatório** com a checagem de instância. Antes de fechar a Fase 1 eu **consulto a versão do Evolution no próprio servidor** (endpoint de versão da API); se houver suporte a header customizado, ele entra como terceira camada.

**Portão de fumaça na Fase 1.** Antes de qualquer `form_id` apontar para a Lia: enviar e receber pela instância nova com o número do Lucas dos dois lados, conferindo `delivery_status` e a chegada pelo `lia-webhook`. A lista de `form_id` só deixa de ser vazia depois desse teste passar.

**Timestamp original na replicação.** A cópia de `ia_mensagens` para `whatsapp_mensagens` leva o `timestamp` de origem (e `whatsapp_message_id` quando existir), nunca a hora da replicação. Ordem da thread preservada.

**Opt-out escreve fora da caixa (obrigatório).** Quando a Lia registra recusa de contato ela grava, na mesma transação: `base_leads.opt_out = true` + `opt_out_motivo` ('lia_canoas' + texto), linha em `meta_supressao`, e o evento em `ia_eventos`. **É a única escrita fora da caixa autorizada nesta fase, e ela não é opcional.** Se `base_leads` não tiver a pessoa, cria a linha mínima para o opt-out existir.

**`telefone_last8` é decisão consciente.** O casamento por 8 dígitos pode gerar falso positivo. Para opt-out, errar bloqueando é o lado seguro — fica **registrado como decisão** no plano e como comentário na migration, para ser o primeiro lugar a olhar se alguém reclamar de não ter recebido contato.

**Kill switch nasce na Fase 0.** `ia_config.enviar_habilitado` (default `false`) criada na Fase 0 e **honrada pelo `lia-brain` na Fase 2**, antes de qualquer envio. A tela com o botão continua na Fase 3.

**Testes redistribuídos.** Linha de base de 20 perguntas **gravada antes da Fase 2**. Testes determinísticos das travas **escritos dentro da Fase 2**, junto com as travas. A Fase 5 fica só com a liberação em três degraus.

---

## Parte 3 — Os três buracos, agora cobertos

**3.1 Disponibilidade e geração de horários.** `ia_config.agenda`: dias da semana, janela 10h–20h, duração 20min, intervalo entre chamadas, capacidade simultânea, antecedência mínima de 2h, **peso maior para sábado** quando o lead está flexível. Os horários oferecidos são **gerados em código** cruzando essa configuração com o que já está em `ia_apresentacoes`, sempre em BRT. A Lia nunca inventa horário: ela escolhe de uma lista que o código produziu.

**3.2 Biblioteca de mídia.** Tabela `ia_midias`: peça, tipo, URL, ordem, **gatilho que a libera** e ativo/inativo. Nasce com as quatro peças aprovadas — mapa de implantação, imagens do club house, plantas das duas tipologias, link do Google Maps. O teto de **3 mídias por conversa** e o **zero áudio** são aplicados em código, não no prompt.

**3.3 Número da notificação ao CEO.** Não sai pela instância da Lia — misturaria tráfego interno com o número comercial que precisa manter qualidade. Padrão desta fase: **push + in-app** (canais que já existem no CRM). WhatsApp interno só se você quiser, e nesse caso por outro número, configurado em `ia_config.notificacao_canal`.

---

## Parte 4 — Fases

**Fase 0 · Fundação (1 migration).** `ia_leads`, `ia_mensagens`, `ia_eventos`, `ia_followups`, `ia_perfil_busca`, `ia_apresentacoes`, `ia_midias`, `ia_config`, `ia_prompt_versoes`. Enum próprio de etapa (`entrada, bloqueado, atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado, migrado`). GRANT + RLS restrita a `admin` e `service_role`. `ia_config` já nasce com: kill switch `enviar_habilitado=false`, segredo do webhook, `form_ids_lia` vazio, agenda, canal de notificação. Junto: alerta de ingestão com as duas condições, e o prompt versionado em `supabase/functions/lia-brain/prompt/`.

**Fase 1 · Entrada e caixa.** `lia-webhook` autenticado (query + instância + header quando houver), `lia-cron` de minuto, desvio em `receive-meta-lead` e `meta-leads-backfill` por `ia_config.form_ids_lia` (lista vazia = comportamento idêntico ao de hoje). Checagem de telefone na entrada. **Portão: teste de fumaça manual antes de qualquer form_id entrar.** Testes com inserção manual em `ia_leads`.

**Fase 2 · Cérebro e travas.** `lia-brain` com contexto montado por código, saída em contrato JSON validado antes de gravar. Travas em código depois do modelo e antes do envio: kill switch, agenda real BRT, janela 08h–23h59 com colapso da madrugada, repetição, travessão e frases proibidas, arredondamento para baixo, 3 mensagens/turno, 3 mídias/conversa, zero áudio, opt-out gravado (Parte 2) antes do envio de encerramento. Linha de base de 20 perguntas gravada antes; testes determinísticos escritos aqui.

**Fase 3 · Tela `/lia` (admin).** Quadro por etapa · sala ao vivo com realtime, assumir e pausar · fila de follow-up · mesa de decisão com os resumos de sete campos · saúde e freio (botão do kill switch que já existe desde a Fase 0). Nada entra em dashboard, forecast ou métrica de corretor.

**Fase 4 · Migração (1 migration: coluna `autor` + RPC idempotente).** Chave `ia_leads.id`. Cria card com atribuição manual (bypassa roleta), replica a thread **com timestamp original** e `autor='lia'`, resumo como `direction='note'`, cria a visita, registra em `pipeline_historico`, marca `migrado`. Telefone já ativo: anexa ao card existente e avisa o dono.

**Fase 5 · Liberação.** Sombra → assistido → autônomo, volume subindo devagar. Um teste de linha vermelha reprovado bloqueia o release.

### Regras de execução
Fase 0 e Fase 4 são as únicas migrations, em dias diferentes (limite de 2/dia entre 08h–19h BRT). Uma fase por rodada, validada no preview.

### O que NÃO é tocado
`pipeline_leads`, `pipeline_stages`, triggers e RLS existentes, roleta e distribuição, `evolution-webhook` atual, `whatsapp_mensagens` (exceto `autor` na Fase 4), reengajamento e Oferta Ativa. Exceção única e obrigatória: a gravação de opt-out em `base_leads` e `meta_supressao`.

### Decisões travadas
Instância `uhome-lia-canoas`, número novo e dedicado (a definir pelo Lucas antes do teste de fumaça). `form_ids_lia` nasce vazia. Fase 0 confirmada como primeira rodada, com o kill switch dentro dela.
