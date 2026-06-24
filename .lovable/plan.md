
# Central de Reengajamento Inteligente — Máxima Entrega + Auditoria Completa

## Diagnóstico

O template converte muito bem (~10% de "sim" sobre entregues); o gargalo é **entrega**, não conteúdo. Causa: **erro 131049 da Meta** ("healthy ecosystem engagement") — limite de frequência/qualidade por número remetente e por destinatário. Com 1 número, o ganho vem de: (1) não queimar disparo com quem já recebeu marketing recentemente, (2) manter a qualidade do número no verde, (3) reaproveitar de forma inteligente quem a Meta recusou. Em paralelo, faremos uma **auditoria completa da central** (UI, montagem do disparo, ao vivo e webhooks).

## 0. Guarda de exclusividade do pipeline (CRÍTICO — pré-requisito de todo disparo)

Regra inviolável: **nenhum disparo pode atingir lead ATIVO no pipeline**. Antes de montar a audiência, cruzar telefone **e** e-mail contra `pipeline_leads` ativos (não arquivados e fora de Descarte/Inativado) e **remover** esses contatos.
- Vale para TODAS as fontes: Oferta Ativa, descartados, listas customizadas e retries.
- Match por `telefone_normalizado` (last8) e e-mail.
- Checagem **em tempo de disparo** (não só no cadastro): se um contato virou lead ativo depois, é excluído automaticamente.
- Registra motivo "ativo no pipeline" para auditoria.

## 1. Governador de frequência por destinatário (correção central do 131049)

- Antes de cada envio, checar a última mensagem de marketing àquele número (reengajamento + campanhas).
- Se foi há menos de **X dias** (configurável, padrão 14), pula nesta rodada e volta a ficar elegível depois.

## 2. Auto-retry rotacionando a própria base (131049 ≠ descarte)

- 131049 vira **retry agendado** (padrão 5 dias, configurável), contando tentativas; ao expirar, volta sozinho à fila — a base "gira" até entregar.
- Após N tentativas (padrão 3), vira descarte.
- `Message undeliverable` (inválido) e opt-out ("Não") seguem descarte permanente.

## 3. Pacing adaptativo + warm-up

- **Warm-up diário:** começa menor e sobe enquanto a qualidade está verde; recua se a falha subir.
- **Desaceleração suave** antes da pausa dura ao detectar aumento de 131049.
- **Janela de melhor horário** para concentrar envios em faixas de maior leitura.

## 4. Recomendação de melhor lista (central 100% inteligente)

- Por lista/segmento: **limpos elegíveis** (já descontando pipeline ativo, frequência e supressão), em cooldown, bloqueados e **taxa histórica de leitura**.
- Destaque **"Melhor lista para disparar agora"** + **estimativa de entrega** antes de iniciar.
- Botão **"Rotacionar base"**: re-enfileira retries vencidos + limpos numa nova rodada.

## 5. Painel de saúde do número (Graph API)

- Função lê **quality rating** + **messaging tier** (limite de destinatários únicos/24h) via Graph API; alerta quando sai do verde ou perto do teto.

## 6. Auditoria e refatoração completa da central (UI · disparo · ao vivo · webhooks · usabilidade)

A central tem hoje: `CentralNutricao` + abas `ReengajamentoTab` (1.204 linhas), `DisparoCustomizadoCard` (790), `CampanhaOndasTab`, `VisitaAmanhaTab`, `RespostasRecebidasHoje`, `AuditoriaWebhookTab` (648) e `LiveDispatchBanner`. Vamos auditar e corrigir ponta a ponta:

**Montagem do disparo (UX)**
- Fluxo guiado em etapas: escolher fonte/lista → ver estimativa (limpos / cooldown / bloqueados / removidos por pipeline) → confirmar cadência → disparar.
- Bloquear o botão de disparar quando não há elegíveis ou o número está em cooldown de qualidade, com mensagem clara do motivo.
- Unificar os parâmetros (template, imagem de header, janela, volume) num só lugar, sem duplicação entre abas.
- Refatorar arquivos grandes (`ReengajamentoTab`, `DisparoCustomizadoCard`) em subcomponentes (>800/>300 linhas, conforme regra de manutenção).

**Ao vivo (live)**
- `LiveDispatchBanner`: métricas em tempo real coerentes (enviados / entregues / lidos / falhas / 131049 / retries agendados), progresso, motivo de pausa e próximo horário elegível.
- Garantir recuperação de run travado (já há timeout de 4 min) e sincronizar contadores com `reengajamento_dispatch_runs`.

**Webhooks**
- Revisar `whatsapp-webhook` (status delivered/read/failed, classificação de erro, opt-out por botão "Não") e a `AuditoriaWebhookTab`: confirmar que todo status volta e atualiza `reengajamento_meta_disparos` e a supressão.
- Validar `reengajamento-audience-preview` (estimativas batem com o disparo real, incluindo a guarda de pipeline).
- Checar idempotência e tratamento de payloads sem telefone (visto nos logs do `receive-meta-lead`).

**Usabilidade geral**
- Estados vazios, loading e erro consistentes; tokens do design system (sem cores hardcoded); responsividade; rótulos em PT-BR claros.

## Passo a passo de operação

```text
1. Abrir a central → "Melhor lista para disparar agora" + saúde do número.
2. Escolher lista → estimativa: X limpos / Y cooldown / Z bloqueados / W removidos (pipeline ativo).
3. Disparar: warm-up; só números fora do cooldown de frequência E fora do pipeline ativo.
4. Ao vivo: pacing se ajusta sozinho; 131049 vira retry agendado; tudo visível no banner.
5. Dias depois: retries vencidos voltam à fila automaticamente.
6. Repetir com a próxima melhor lista enquanto o número descansa.
```

## Detalhes técnicos

**Banco**
- `reengajamento_config`: `freq_cooldown_dias` (14), `retry_131049_dias` (5), `retry_max_tentativas` (3), `warmup_inicial`, `warmup_incremento_pct`, `janela_melhor_horario`.
- `meta_supressao` para retry: 131049 → `codigo='throttle_131049'`, `suprimir_ate=now()+retry_131049_dias`, `ocorrencias`; expira → reelegível. Inválido/opt-out permanecem `suprimir_ate=NULL`.
- Views: `v_pipeline_ativo_contatos` (telefone last8 + e-mail de leads ativos), `v_ultimo_marketing_por_telefone` (last8 → max(sent_at) de reengajamento + campanhas), RPC `v_deliverability_listas`.

**Edge functions**
- `reengajamento-descartados-enqueue`: guarda de pipeline ativo + governador de frequência na audiência; warm-up + pacing adaptativo; ordenação por horário/score.
- `whatsapp-webhook`: 131049 → `throttle_131049` (cooldown curto + tentativas, promoção a permanente após máximo).
- `reengajamento-audience-preview`: incluir as mesmas exclusões para estimativa fiel.
- Nova `meta-number-quality`: rating + tier via Graph API.

**Frontend** (`CentralNutricao`, `ReengajamentoTab`, `DisparoCustomizadoCard`, `LiveDispatchBanner`, `AuditoriaWebhookTab`)
- Refatoração em subcomponentes, fluxo guiado, "Melhor lista", estimativa com "removidos por pipeline", fila de retry, próximo horário, ação "Rotacionar base".

## Nota estratégica (opcional, sem trocar template)
A alavanca estrutural mais forte contra o 131049 é o template aprovado como **categoria UTILITY** (sem frequency cap de marketing). Respeitando a decisão de não criar outro template, fica como recomendação futura.

## Fora de escopo
- Múltiplos números Meta (arquitetura fica preparada para plugar depois).
- Canal Evolution / não-oficial.
