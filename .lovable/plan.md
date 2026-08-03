# HOMI Fase 0 — Passo 0 (levantamento) + plano do Context Builder

Nada foi alterado. Tudo abaixo veio de consulta de leitura ao banco de produção agora.

## Passo 0 — os cinco levantamentos

### 1. pipeline_stages (todas ativas, pipeline_tipo = leads)

| ordem | nome | tipo | ativo | leads |
|---|---|---|---|---|
| 0 | Novo Lead | novo_lead | true | 115 |
| 1 | Sem Contato | sem_contato | true | 856 |
| 2 | Qualificação | qualificacao | true | 1.031 |
| 3 | Aquecimento | aquecimento | true | 629 |
| 4 | Visita | visita | true | 136 |
| 5 | **Pós-Visita** | pos_visita | **true** | **83** |
| 6 | Em Negociação | proposta | true | 29 |
| 7 | Contrato | contrato_gerado | true | 1 |
| 8 | Ganho | venda | true | 79 |
| 11 | Caiu | caiu | true | 2 |
| 12 | Descarte | descarte | true | 6.106 |

Não existe nenhuma linha com `ativo=false`: a tabela tem exatamente estas 11 linhas, todas ativas, todas `pipeline_tipo='leads'`.

**Sobre Pós-Visita — o parecer está desatualizado, não errado por método.** A limpeza de 17/07 rodou: as 12 stages mortas não estão mais lá. Mas a Pós-Visita que aparece hoje **não é o vestígio antigo** — ela foi criada depois, em pedido explícito seu ("Criar uma etapa Pós-Visita no pipeline"), com ordem 5, tipo `pos_visita`, e hoje tem 83 leads reais e substatus próprio já implementado em `leadHelpers.ts`. O inventário leu o banco, não os tipos TypeScript.

Isso não invalida a crítica de método do guardião — pós-visita como *régua* (mesmo dia / 24h / 3d / 7d) e pós-visita como *etapa* são coisas diferentes, e hoje o CRM tem a etapa. **Isto é decisão sua, não minha**: manter a etapa (e a régua roda dentro dela) ou aposentar a etapa e devolver os 83 leads para Visita. Não mexo nisso na Fase 0 — o Stage Router v1 vai refletir o banco como ele está, com as 11 etapas.

### 2. pipeline_leads — 111 colunas, e por que não são 94

111 confirmado em `information_schema.columns`. As 17 a mais em relação ao mapeamento de 16-17/07 são todas de trabalho feito **depois** daquela data, e são nomeáveis uma a uma:

- CAPI/Meta v2–v4 (11): `meta_lead_id`, `capi_enviado_at`, `adset_id`, `ad_id`, `form_id`, `form_name`, `placement`, `ad_format`, `fbc`, `fbp`, `event_source_url`
- Enriquecimento de correspondência CAPI (3): `client_user_agent`, `client_ip_address`, `cep`
- Formulário Meta (1): `form_respostas`
- Qualificação (2): `faixa_valor`, `prazo_decisao`

Não é crescimento misterioso: é o rastreamento Meta que construímos nas últimas duas semanas.

**Três baldes (proposta, para você aprovar):**

*Entra sempre (≈30):* identidade operacional e estado — `id`, `nome`, `stage_id`, `stage_changed_at`, `flag_status`, `corretor_id`, `gerente_id`, `empreendimento`, `empreendimento_canonico_id`, `segmento_id`, `origem`, `origem_detalhe`, `campanha`, `temperatura`, `lead_score`, `oportunidade_score`, `valor_estimado`, `faixa_valor`, `prazo_decisao`, `objetivo_cliente`, `bairro_regiao`, `forma_pagamento`, `radar_*` (5), `proxima_acao`, `data_proxima_acao`, `ultima_acao_at`, `primeiro_contato_em`, `created_at`, `arquivado`, `estagnado`, `tipo_descarte`, `motivo_descarte`.

*Entra sob condição:* `telefone`, `telefone2`, `email`, `cep` — **só depois de `aceito_em` preenchido** (mesma regra de máscara PII já vigente na roleta) e só quando a tarefa do usuário exige contato. `observacoes`, `form_respostas` — entram truncados. `negocio_id`, `imovel_codigo`, `imovel_url` — só quando existem.

*Nunca entra (motivo):* `fbc`, `fbp`, `client_ip_address`, `client_user_agent`, `event_source_url`, `meta_lead_id`, `capi_enviado_at`, `jetimob_lead_id`, `dedup_grupo_id`, `requer_revisao_dedup`, `telefone_normalizado`, `dados_site`, `origem_ref`, `ordem_no_stage`, `modulo_atual`, `escalation_level`, `last_escalation_at`, `reciclagem_aviso_at`, `estagnado_aviso*`, `roleta_distribuido_em`, `aceite_expira_em`, `motivo_rejeicao`, `is_redistribuicao`, `corretor_anterior_id`, `reengajamento_*`, `ai_replied`, `complexidade_score`, `lead_score_at`, `conversation_window_until`, `created_by`, `tipo_acao`, `modo_conducao`, `prioridade_acao`, `visita_amanha_resposta`, `imovel_troca`, `nivel_interesse`, `lead_temperatura`, `motivo_pendencia`, `reativado_*`, `distribuido_em`, `aceite_status`, `produto_id`, `campanha_id`, `conjunto_anuncio`, `anuncio`, `formulario`, `plataforma`, `radar_status_imovel`, `radar_atualizado_em`, `tags`, `hora_proxima_acao`, `prioridade_lead`, `updated_at`, `stage_id` duplicado por nome. Motivo em três grupos: identificador de rastreamento publicitário (risco LGPD, zero valor de conduta), plumbing interno (ruído puro), e campo duplicado/derivado (`temperatura` × `lead_temperatura`, ambos 100% preenchidos — o contexto usa `temperatura`).

### 3. Estado definitivo — ele existe

`tipo_descarte` tem três valores em produção:

| valor | leads |
|---|---|
| reengajavel | 3.676 |
| (nulo) | 3.592 |
| **definitivo** | **1.799** |

Dos 1.799 definitivos, 1.787 já estão `arquivado=true`. E o `motivo_descarte` mostra os casos N1 nomeados: "Inativado: Solicitou retirada do nome" (89), "Inativado: Solicitou retirada (LGPD)" (23), "Inativado: Não quer mais contato" (210), "Inativado: respondeu NÃO ao reengajamento" (84 + 79).

**Conclusão: não precisa criar campo.** O estado definitivo é `tipo_descarte='definitivo'`. O que falta não é estrutura, é o *motivo* estar em texto livre — hoje "pediu descadastramento" e "não atende" caem no mesmo balde definitivo. A Fase 0 expõe `tipo_descarte` no contexto e marca `nao_recontatar = tipo_descarte='definitivo'`; a subdivisão LGPD × comercial fica registrada como pendência para a próxima fase (exige classificar 1.799 textos livres, o que é migração de dados, não Fase 0).

### 4. homi_memoria_lead

Existe, **0 linhas**, criada por nós na Fase 1 do HOMI Workspace. Uma policy só:

```
memoria_lead_own — ALL, authenticated, USING/WITH CHECK (user_id = auth.uid())
```

O guardião está certo no risco, mas ele é diferente do descrito: a policy escopa por *autor da memória*, não por *acesso ao lead*. Um corretor não lê memória de outro. O furo real é que ela não revalida se o autor ainda tem acesso àquele `lead_id` — memória escrita quando o lead era dele continua legível depois da redistribuição. Correção: acrescentar `AND can_access_lead(lead_id)` na policy. Uma migration.

### 5. homi_briefing_diario — morta

**0 linhas.** A tabela existe com as 4 policies, e nada nunca escreveu nela. O briefing que hoje aparece no `/homi` é calculado na hora pelo `useHomiBriefing`, sem persistir. A Fase 1 não deve duplicá-la: ou passa a usá-la, ou ela é dropada.

## Bônus de segurança (fora do que foi pedido, mas relevante)

`homi_chunks` e `homi_documents` têm `SELECT ... USING (true)` para todo autenticado — e `homi_chunks` tem 695 linhas hoje. Enquanto o conteúdo é método, tudo bem. No dia em que um chunk carregar tabela de preço ou condição de desconto, todo corretor lê sem filtro. Não é problema da Fase 0 (nenhum chunk de tabela existe hoje), mas entra na Fase 0 como **regra de ingestão**: chunk sem `fonte` e sem `vigencia` não entra no contexto — e o Context Builder simplesmente não lê chunk de produto.

---

## Plano da Fase 0 (depois da sua aprovação)

### Etapa A — fonte canônica de etapas e substatus (sem migration)
`src/lib/pipelineStages.ts`: única fonte com as 11 etapas ativas, e para cada uma a chave de substatus em `flag_status` (`status_atendimento`, `prazo`, `status_visita`, `status_negociacao`, `status_contrato`). Helpers e componentes passam a importar daqui. Substatus nunca é lido como coluna.

### Etapa B — Context Builder v1 (read-only, sem migration)
`supabase/functions/_shared/homi-context/` com os 11 blocos do contrato. Ordem obrigatória: **permissão → etapa → contexto → (RAG só depois)**. Tudo temporal em BRT via `brt-time.ts`. Permissão resolvida por `app_role` (admin, diretor, gestor, corretor, backoffice, rh) e equipe por `team_members` — nada deduzido. Tarefas de `pipeline_tarefas` (com o cap de +30d tratado como desenho, não como dado faltando). Empreendimento nunca aponta para `properties`: preço/condição de lançamento entram como `missing_context` com [CONFIRMAR NO CRM].

`missing_context` não vazio → o HOMI pergunta, nunca infere; se o item for preço, tabela, taxa, disponibilidade, percentual ou unidade, a resposta é confirmar no CRM. `conflicts` não vazio → CRM vence RAG e o conflito é declarado.

### Etapa C — Stage Router v1 (sem migration)
Por etapa: objetivo, contexto obrigatório, categorias permitidas/excluídas, saídas permitidas. **Negativa por padrão**: stage fora das 11 → `missing_context`, nunca conduta genérica.

### Etapa D — testes nomeados (sem migration)
Corretor não recebe lead de outro; gestor só a própria equipe por `team_members`; stage desconhecida → `missing_context`; disponibilidade/unidade/condomínio marcados como voláteis; chunk sem fonte/vigência não entra; dias sem contato corretos às 22h BRT; lead `tipo_descarte='definitivo'` identificável como não-recontatável.

### Etapa E — tela de inspeção read-only
`/admin/homi-contexto` (gestor + admin): escolhe um lead, vê o JSON exato que o HOMI receberia. Única saída visível da fase.

### Etapa F — 1 migration, dentro da janela 08–19h BRT
Policy de `homi_memoria_lead` com `can_access_lead(lead_id)`. É a única migration da fase (teto de 2/dia respeitado, usamos 1).

### Fica para a próxima fase
Briefing persistido (decidir sobre `homi_briefing_diario`), classificação LGPD × comercial dos 1.799 definitivos, escrita/ações, RAG novo, versionamento da base de conhecimento.

## Três decisões suas antes de eu começar

1. **Pós-Visita**: mantenho como etapa (11 no router) ou é para aposentar e devolver os 83 leads para Visita? Fase 0 assume manter.
2. **Baldes das 111 colunas**: o balde "nunca entra" acima está certo? Em especial: `observacoes` truncado e telefone/e-mail só após aceite.
3. **Estado definitivo**: concorda em usar `tipo_descarte='definitivo'` como o estado de não-recontato, sem criar campo novo agora?
