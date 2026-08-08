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

## Parte 3b — Sete adições (08/08, aceitas)

**1. Debounce + lock por lead (Fase 2).** Antes de chamar o modelo, aguarda silêncio curto (`ia_config.debounce_segundos`, default 10, faixa 8–12) e agrupa tudo que chegou no intervalo numa única chamada. Lock por `ia_leads.id`: uma chamada ao cérebro por lead por vez; mensagem que chega durante a chamada entra no próximo turno em vez de abrir um paralelo.

**2. Pausar e assumir por lead nascem na Fase 0/2.** Colunas `ia_leads.pausado` e `ia_leads.assumido_por` criadas na Fase 0 e **honradas pelo `lia-brain` na Fase 2**: lead pausado ou assumido por humano = a Lia grava o que chega e não envia nada. Freio fino existe desde o primeiro envio, não só na tela.

**3. Sombra começa na Fase 2 — decisão travada.** Entra na Fase 2 uma **sala ao vivo mínima** em `/lia`: lista de conversas, thread em leitura, a sugestão que a Lia produziu, e um botão de enviar. Sem quadro, sem métricas, sem mesa de decisão — isso continua na Fase 3. Assim sombra e assistido rodam sem esperar a tela completa.

**4. Ordem de envio.** As mensagens do turno saem **em sequência confirmada**: a seguinte só parte depois do retorno da anterior, com intervalo curto entre elas. Nada de envio paralelo.

**5. Fonte do prompt.** O **arquivo em git é a fonte** que o `lia-brain` lê em execução. `ia_prompt_versoes` apenas **registra** qual versão está ativa, desde quando e quem trocou — o cérebro nunca lê texto de prompt do banco.

**6. Comportamento com o freio puxado.** O que chega continua sendo gravado normalmente em `ia_mensagens` e **nada sai**. A saúde mostra o **contador de conversas esperando** (e a mais antiga), para o custo do freio ser visível.

**7. Envio sem duplicar.** Chave de idempotência por mensagem enviada (`ia_mensagens.idempotency_key`, única): timeout do Evolution seguido de retry reaproveita a chave e não dobra a mensagem. A trava de texto repetido fica registrada como **segunda linha de defesa** para o mesmo problema, não como a única.

**Detalhe:** `ia_config` é **linha única** por constraint (`id boolean PRIMARY KEY DEFAULT true CHECK (id)`), para não existir configuração fantasma.

---

## Parte 3c — Levantamento dos IDs da campanha (08/08, só leitura)

Tudo abaixo veio de leitura na Graph API e no banco. Nada foi alterado.

- **Campanha** `120250952101260030` = "Casa Tua Canoas - Lia", objetivo `OUTCOME_LEADS`, **ACTIVE**, criada 08/08/2026 11:35 BRT.
- **Página**: `114448536946480` (UHome). Veio do `promoted_object` do conjunto `120250952101340030` (que também aponta o pixel `1426170849536314`, evento `SCHEDULE`).
- **Formulário**: `2244706092956252` — "Uhome - Casa Tua Canoas - Pré-lançamento-insta-LIA", **ACTIVE**, criado **08/08/2026 11:36 BRT**, `leads_count = 0`, página UHome. Campos: nome completo, telefone, e-mail. Confere com o que você descreveu.
- **Permissão**: o token do `receive-meta-lead` tem **`leads_retrieval` concedida**, e a leitura real funcionou — `GET /2244706092956252/leads` retornou `{"data": []}` (vazio porque ainda não há lead), **não** erro de permissão. Também tem token de página para a UHome, que é o que a listagem de formulários exige.
- **`roleta_campanhas`**: a campanha **não está lá**. Essa tabela nem casa por ID — as colunas são `empreendimento` (texto), `segmento_id`, `ativo`, `ignorar_segmento`, e a única linha relacionada é `empreendimento = 'Casa Tua'` (ativo, sem segmento). Nada foi removido.

**Achado que reforça a sua regra**: a campanha da Lia tem **vários conjuntos** (`...290030`, `...340030`, `...350030`) e **todos os anúncios apontam para o mesmo formulário** `2244706092956252` hoje. Basta um criativo novo para nascer um segundo formulário dentro da mesma campanha — exatamente o caso que o casamento só por `form_id` deixaria escapar.

### O que isso vira na Fase 0

`ia_config.captura_lia` (jsonb), com duas listas:

```text
campaign_ids: ["120250952101260030"]
form_ids:     ["2244706092956252"]
```

Regras da captura, aplicadas em `receive-meta-lead` e `meta-leads-backfill`:

1. Casa por **`campaign_id` OU `form_id`** — nunca só por formulário.
2. **Alerta obrigatório**: `form_id` desconhecido cujo `campaign_id` está na lista da Lia **não é tratado como lead comum** — vai para a caixa da Lia, registra `ia_eventos` + `ops_events` e dispara aviso ao CEO, porque é o sinal de que criativo novo criou formulário novo e a lista precisa ser atualizada.
3. **A campanha da Lia não entra em `roleta_campanhas`.** Cadastrar ali é o erro que manda o lead direto para corretor sem passar pela mesa de decisão. Fica registrado como proibição do plano.
4. **Enquanto as duas listas estiverem vazias, o comportamento do sistema é idêntico ao de hoje.** Elas só são preenchidas depois do teste de fumaça da Fase 1.

---

## Parte 3d — As três verificações (08/08, só leitura)

**1. Como `roleta_campanhas` casa — é `ILIKE` com curinga dos dois lados, mas na direção que te protege.**
O código (`receive-meta-lead`, linhas 446, 476 e 775) faz `.ilike("empreendimento", "%" + textoDoLead + "%")`, ou seja: **a coluna da tabela é comparada contra o texto do lead como padrão**. A linha ativa tem `empreendimento = 'Casa Tua'`; o lead da Lia chega como "Casa Tua Canoas - Lia" (ou o nome do formulário). `'Casa Tua' ILIKE '%Casa Tua Canoas - Lia%'` é **falso** — a coluna teria que conter o texto do lead, e não o contrário. Então **hoje não há colisão**: a campanha da Lia não casa com a linha 'Casa Tua'.

Mas você está certo no princípio, por dois motivos: (a) é `contém`, e basta alguém cadastrar amanhã uma linha `'Casa Tua Canoas - Lia'` ou `'Casa Tua Canoas'` para o casamento acontecer em silêncio; (b) a separação estaria dependendo de uma camada só. **Aceito a segunda camada e ela entra na Fase 0**: lista `captura_lia.campaign_ids` é consultada **antes** de qualquer resolução de empreendimento/segmento — se o `campaign_id` do lead está lá, o fluxo desvia para a caixa da Lia e **nunca chega** em `roleta_campanhas`, `jetimob_campaign_map` ou `distribuir_lead_atomico`. Exclusão explícita por ID, não por texto.

**2. Otimização dos conjuntos — são cinco, não três, e o cenário é pior do que você supôs.**

```text
conjunto              nome                        optimization_goal  billing_event  evento do pixel
120250952101350030    Fuga do Aluguel             QUALITY_LEAD       IMPRESSIONS    SCHEDULE      (PAUSED)
120250952101340030    Remarketing                 QUALITY_LEAD       IMPRESSIONS    SCHEDULE      (ACTIVE)
120250952101330030    Familia buscando casa.      QUALITY_LEAD       IMPRESSIONS    OTHER / LeadQualificado (ACTIVE)
120250952101320030    Looklike - Leads Moradia 1% QUALITY_LEAD       IMPRESSIONS    OTHER / LeadQualificado (ACTIVE)
120250952101290030    Semelhante 1%               QUALITY_LEAD       IMPRESSIONS    OTHER / LeadQualificado (ACTIVE)
```

Todos com `pixel_id = 1426170849536314`, `page_id = 114448536946480`, `lead_ads_form_event_source_type = onsite_crm_single_event`, `destination_type = ON_AD`.

Leitura: **todos otimizam por `QUALITY_LEAD`**, isto é, o Meta aprende com um evento de conversão vindo do CRM, não com o volume de formulários preenchidos. Dois conjuntos esperam **`Schedule`** e três esperam o evento personalizado **`LeadQualificado`**. Sua conclusão se confirma e vai além: **enquanto a caixa da Lia não devolver conversão, cinco conjuntos entregam no escuro** — e o mais crítico é que o evento certo depende do conjunto, então mandar só um dos dois deixa metade da campanha sem sinal.

Portanto, **o envio de conversão sai da Fase 5 e vira requisito da Fase 2**: no momento em que a Lia marca a apresentação, a caixa dispara **`Schedule`**; no momento em que ela classifica o lead como qualificado, dispara **`LeadQualificado`**. Os dois com `lead_id` do Meta (match perfeito, sem depender de hash), pelo mesmo caminho CAPI que já existe (dataset `1426170849536314`, `event_time = now()`, janela de 7 dias). Isso é escrita **para fora** do CRM, não no pipeline dos corretores, então não conflita com o isolamento da caixa.

**3. Nome da chave padronizado.** `ia_config.captura_lia` agora é o nome único, corrigido na Fase 1 e nas Decisões travadas. `form_ids_lia` não existe mais no plano.

---

## Parte 4 — Fases



**Fase 0 · Fundação (1 migration).** `ia_leads` (com `pausado`, `assumido_por`), `ia_mensagens` (com `idempotency_key` única), `ia_eventos`, `ia_followups`, `ia_perfil_busca`, `ia_apresentacoes`, `ia_midias`, `ia_config` (linha única), `ia_prompt_versoes`. Enum próprio de etapa (`entrada, bloqueado, atendendo, sem_resposta, qualificado, perfil_busca, nutricao, desqualificado, migrado`). GRANT + RLS restrita a `admin` e `service_role`. `ia_config` já nasce com: kill switch `enviar_habilitado=false`, `debounce_segundos`, segredo do webhook, **`captura_lia` com as duas listas vazias** (os IDs da Parte 3c entram como dado, não como migration), agenda, canal de notificação. Junto: alerta de ingestão com as duas condições, e o prompt versionado em `supabase/functions/lia-brain/prompt/`.



**Fase 1 · Entrada e caixa.** `lia-webhook` autenticado (query + instância + header quando houver), `lia-cron` de minuto, desvio em `receive-meta-lead` e `meta-leads-backfill` por **`ia_config.captura_lia`** (`campaign_ids` OU `form_ids`; ambas vazias = comportamento idêntico ao de hoje). Checagem de telefone na entrada. **Portão: teste de fumaça manual antes de qualquer ID entrar nas listas.** Testes com inserção manual em `ia_leads`.

**Fase 2 · Cérebro, travas, sala mínima e conversão de volta.** `lia-brain` com contexto montado por código e prompt lido do arquivo em git, saída em contrato JSON validado antes de gravar. Debounce + lock por lead antes da chamada. Travas em código depois do modelo e antes do envio: kill switch global, `pausado`/`assumido_por`, agenda real BRT, janela 08h–23h59 com colapso da madrugada, repetição, travessão e frases proibidas, arredondamento para baixo, 3 mensagens/turno em sequência confirmada, 3 mídias/conversa, zero áudio, idempotência de envio, opt-out gravado (Parte 2) antes do envio de encerramento. **Conversão CAPI de volta (Parte 3d.2): `Schedule` ao marcar apresentação e `LeadQualificado` ao qualificar, com `lead_id` do Meta** — sem isso os cinco conjuntos otimizam no escuro. Sala ao vivo mínima para sombra. Linha de base de 20 perguntas gravada antes; testes determinísticos escritos aqui.

**Fase 3 · Tela `/lia` completa (admin).** Quadro por etapa · sala ao vivo com realtime, assumir e pausar · fila de follow-up · mesa de decisão com os resumos de sete campos · saúde e freio (kill switch que existe desde a Fase 0, contador de conversas esperando). Nada entra em dashboard, forecast ou métrica de corretor.



**Fase 4 · Migração (1 migration: coluna `autor` + RPC idempotente).** Chave `ia_leads.id`. Cria card com atribuição manual (bypassa roleta), replica a thread **com timestamp original** e `autor='lia'`, resumo como `direction='note'`, cria a visita, registra em `pipeline_historico`, marca `migrado`. Telefone já ativo: anexa ao card existente e avisa o dono.

**Fase 5 · Liberação.** Sombra → assistido → autônomo, volume subindo devagar. Um teste de linha vermelha reprovado bloqueia o release.

### Regras de execução
Fase 0 e Fase 4 são as únicas migrations, em dias diferentes (limite de 2/dia entre 08h–19h BRT). Uma fase por rodada, validada no preview.

### O que NÃO é tocado
`pipeline_leads`, `pipeline_stages`, triggers e RLS existentes, roleta e distribuição, `evolution-webhook` atual, `whatsapp_mensagens` (exceto `autor` na Fase 4), reengajamento e Oferta Ativa. Exceção única e obrigatória: a gravação de opt-out em `base_leads` e `meta_supressao`.

### Decisões travadas
Instância `uhome-lia-canoas`, número novo e dedicado (a definir pelo Lucas antes do teste de fumaça). **`ia_config.captura_lia`** nasce com `campaign_ids` e `form_ids` vazias (nome único da chave, usado em Fase 0, Fase 1 e aqui). Fase 0 confirmada como primeira rodada, com o kill switch dentro dela.
