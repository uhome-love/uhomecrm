# Central de Reengajamento com a Base Única de Leads

Hoje a Central de Reengajamento só sabe disparar para três públicos antigos: descartados do pipeline, leads ativos do pipeline (por etapa) e listas fixas de Oferta Ativa. A Base Única (`base_leads`, ~37 mil contatos com situação CRM, empreendimento canônico, formulário, safra e opt-out) não existe como público. O objetivo é tornar a Base Única a fonte principal de disparo e permitir escolher exatamente que recorte enviar — inéditos da base, quem já está no pipeline, quem está em campanha de Oferta Ativa, ou descartados.

## O que muda para você

1. **Nova fonte "Base única"** no Disparo manual, ao lado de Descartados / Pipeline ativo / Oferta Ativa.
2. **Filtros iguais aos de `/base-leads`**: empreendimento canônico, formulário de origem, campanha, safra (recência da última conversão), situação no CRM (inédito, já no pipeline, na Oferta Ativa, ambos), ordem de seleção e limite.
3. **Higiene explícita**: opt-out sempre fora; telefone inválido fora; cooldown/dedup por template mantido. O painel lateral do funil passa a mostrar quantos saíram por cada motivo (opt-out, sem telefone, já disparado, cooldown, supressão Meta).
4. **Resposta SIM continua indo para a Fila do CEO**, mesmo quando o contato ainda não existe no pipeline — nesse caso o lead é criado a partir da base e vinculado de volta ao registro da base.
5. **Oferta Ativa atualizada**: o seletor de listas antigas passa a listar as campanhas temporárias ativas do novo modelo, não as 66 listas fixas arquivadas.

## Sequência de trabalho

Fase A — mockup visual da aba "Disparo manual" com a nova fonte e o painel de higiene, para sua aprovação.
Fase B — banco (migration única).
Fase C — edge functions.
Fase D — frontend.
Fase E — validação ao vivo no preview com uma campanha de teste pequena (modo teste cauteloso já existente).

## Detalhes técnicos

### Banco (1 migration)
- `reengajamento_dispatch_queue`: ampliar o CHECK de `lead_ref` para aceitar `'base_lead'`.
- Nova RPC `preview_reengajamento_base(filtros jsonb)`: retorna candidatos elegíveis da `base_leads` já com higiene (opt_out = false, telefone_key não nulo), aplicando empreendimento, formulário, campanha, janela de conversão, `situacao_crm` e ordem/limite. Reaproveita a lógica de `preview_campanha_da_base_v2`, mas sem excluir quem está no pipeline/OA (aqui isso é filtro, não exclusão).
- Nova RPC `reativar_base_lead_para_fila_ceo(p_base_lead_id uuid, p_template_name text)`: se já existe pipeline ativo pelo telefone, devolve `already_active` + `corretor_id`; senão cria `pipeline_leads` na Fila do CEO com histórico do template, grava `base_leads.pipeline_lead_id` e atualiza `situacao_crm`.
- GRANTs: `authenticated` (preview) e `service_role` (ambas).

### Edge functions
- `reengajamento-audience-preview`: novo ramo `base_unica` (e participação no modo combinado, com prioridade após descartados), chamando `preview_reengajamento_base`; funil com contadores de opt-out/sem telefone/já disparado.
- `reengajamento-descartados-enqueue`: aceitar `source/sources = "base_unica"`, enfileirar com `lead_ref = 'base_lead'`, `lead_id = base_leads.id`, `audience_source = 'base_unica'`; dedup por `phone_last8` mantido.
- `whatsapp-webhook`: incluir `base_unica` nas fontes que roteiam para a Fila do CEO e, quando `lead_ref = 'base_lead'`, chamar `reativar_base_lead_para_fila_ceo`. Resposta NÃO grava `opt_out = true` na `base_leads`.

### Frontend
- `DisparoCustomizadoCard.tsx`: novo tipo de fonte `base_unica`; bloco de filtros da base na aba "Público" (reaproveitando `EmpreendimentoMultiSelect` e os pickers já usados em `/base-leads`); ajuste do payload `audience`.
- Query das listas de Oferta Ativa passa a filtrar campanhas ativas/liberadas do modelo novo (`oferta_ativa_listas` não arquivadas e não expiradas).
- `FunilLateral.tsx`: novas linhas de higiene específicas da base.

### Fora de escopo
Nada de disparo automático — a Central segue 100% manual, com o gate `system_flags.campaign_dispatch_enabled` e o warm-up do Motor inalterados.
