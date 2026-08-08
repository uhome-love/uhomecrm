# CAPI da Uhome — limpeza de payload, auditoria e detecção

Independente da Lia. Só o Bloco 2 é execução de código; o resto é levantamento e observabilidade.

## Levantamento fechado (leitura feita agora, nada alterado)

**Duplicidade (item 1) — não há inflação relevante.** O `_trg_pipeline_lead_capi()` dispara em **toda** transição para a etapa Qualificação (`NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id = <uuid Qualificação>`), não só na primeira — então repetição é possível por desenho. Na prática, nos últimos 14 dias: **401 eventos `LeadQualificado` para 398 leads distintos** (recomputei o `event_id` md5 para cruzar). Só 3 leads geraram evento repetido. A conta que não fechava era outra: os 82 eventos sem `lead_id` não vêm só de leads criados nos últimos 14 dias — a maioria é de lead antigo reativado.

**Origem dos 82 `LeadQualificado` sem `lead_id` (14 dias):**

| Origem | Eventos |
|---|---|
| Reengajamento | 39 |
| meta_ads | 16 |
| imovelweb | 6 |
| Oferta Ativa | 5 |
| Facebook Leads Ads | 4 |
| site_uhome | 3 |
| Manual | 3 |
| outro / Formulário / Nutrição / Open Bosque / não informado | 6 |

Leitura: ~20 são de origem Meta (`meta_ads` + `Facebook Leads Ads`) e perderam o `meta_lead_id` — lead antigo, anterior à captura do identificador. Os 39 de Reengajamento são leads velhos de base, também sem identificador. O restante (~23) é claramente não-Meta.

**CEP (item 4) — não está fixo, mas está sempre vazio.** A função hasheia `pipeline_leads.cep`, ou seja, vem do cadastro real. Só que **0 de 1.410 leads dos últimos 30 dias têm CEP preenchido** — então `zp` nunca sai no payload. Não é dado falso, é campo morto. Não faz parte da correção; fica registrado.

**Cidade/estado — fixos no código.** `v_cidade := 'porto alegre'` e `v_uf := 'rs'` para todo lead, sempre. Dado falso.

**IP e user-agent — do servidor.** Nos últimos 14 dias os únicos valores gravados são `Deno/2.1.4 (SupabaseEdgeRuntime)` (477) e `Make/production` (6).

## Regra permanente (item 3)

Em formulário instantâneo do Meta o lead **nunca toca a infraestrutura da Uhome** — preenche dentro do Instagram. `client_ip_address` e `client_user_agent` **não existem** para lead de anúncio e **não são pendência a resolver**. Proibido inventar valor para esses campos ou "reativar" a captura mais adiante. O identificador desse fluxo é o `lead_id`. Isso vai para a memória do projeto junto com o build.

## Bloco 2 · Limpeza do payload + rastreabilidade (execução)

Uma migration (só DDL, substituindo a função) e uma coluna aditiva:

1. **`ct`/`st` deixam de ser fixos.** Só entram se houver cidade/UF reais no cadastro do lead; senão, omitidos. `country` (`br`) fica, porque é verdadeiro.
2. **`client_ip_address` e `client_user_agent` só entram se forem do cliente.** Filtro que descarta valores de servidor (`Deno/`, `SupabaseEdgeRuntime`, `Make/`, vazio). Na prática hoje isso zera os dois campos — e é o resultado correto, conforme a regra acima.
3. **Nova coluna `lead_id_interno uuid` em `meta_capi_queue`** (aditiva, sem backfill), preenchida pela função em todo evento novo. Torna trivial qualquer auditoria futura de origem, duplicidade e cobertura, sem recomputar md5.
4. Nada mais muda: hashes de e-mail/telefone/nome/CEP, `fbc`/`fbp`, `lead_id`, trava de 7 dias e `event_id` ficam idênticos.

Mesma limpeza de `ct`/`st` em `supabase/functions/meta-capi-track/index.ts`.

Os eventos sem `lead_id` **continuam disparando por enquanto** — a decisão de parar de disparar para origens não-Meta é sua, e agora está informada pela tabela acima.

## Bloco 3 · Detecção (migration própria, separada da Lia)

Migration **distinta** da Fase 0 da Lia, no mesmo dia se couber na janela (limite 2/dia) — se uma falhar, a outra não volta junto.

- **Alerta de evento silencioso**: evento que vinha chegando e fica >6h sem chegar (dedup 24h por nome de evento), no padrão do `edge_health_aggregate`.
- **Alerta de campanha gastando sem lead** em 6h.
- **Painel** em `/admin/ingestao`: eventos por dia por tipo, cobertura de `lead_id` e taxa de descarte da fila.

Canal do alerta: sua decisão (só in-app, ou também push no celular).

## Medição, com prazo realista (item 6)

- **48h após o Bloco 2**: reporto só cobertura de campo nos **eventos novos** — quantos saíram sem cidade/estado fixos, quantos sem IP/UA de servidor, e a cobertura de `lead_id`.
- **7 dias após**: reavalio o `pixel_has_low_event_source_match_rate` no Diagnóstico, porque ele é calculado sobre janela e 48h não bastam para virar o indicador.

## Fora deste plano (seu, manual, hoje)

O conjunto **ativo, em outra campanha, ainda otimizando por `SCHEDULE`** — evento que ninguém dispara desde 06/08. Dois minutos no Gerenciador de Anúncios e é o melhor retorno por esforço da lista. Depois os dois conjuntos da campanha da Lia (pausada) e a consolidação dos seis em dois.

Também fora: enriquecer dados de usuário, valor monetário no evento de Venda, e qualquer coisa da Lia além da Fase 0 já combinada.
