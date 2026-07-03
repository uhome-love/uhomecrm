# Mostrar o empreendimento da campanha nos leads de Reengajamento (Fila CEO)

## Problema

Na aba **Reengajamento** da Fila CEO, os leads reativados aparecem só como "Reengajamento (Nutrição)" com o badge de empreendimento vazio (`—`). Quando o lead respondeu SIM a um disparo específico (ex.: **Lake Baikal** — template `lakebaical_novidade`), essa informação não é exibida, mesmo já existindo no banco.

Causa: alguns caminhos do webhook do WhatsApp criam/reativam o lead sem herdar o empreendimento da campanha, então `pipeline_leads.empreendimento` fica vazio. O template do disparo (registrado em `reengajamento_meta_disparos`), porém, identifica o empreendimento.

## Solução

Duas frentes: (1) exibir corretamente no card usando o template do disparo, e (2) preencher o empreendimento na origem para novos casos.

### 1. Mapa template → empreendimento (novo utilitário)

Criar um helper compartilhado que traduz o nome do template da campanha para o rótulo do empreendimento:

```text
lakebaical_novidade          → Lake Baikal
casatua_maio / casatua_*     → Casa Tua
vividterrace2                → Vivid Terrace
atrio_lancamento             → Átrio
engajamento_visitasabado     → (genérico: "Reengajamento")
reativacao_opcoes_perfil_v2  → (genérico)
reengajamento_imovel_v1      → (genérico)
```

Regra: casamento por prefixo/inclusão, case-insensitive; quando não houver empreendimento específico, mantém o comportamento atual (sem badge de empreendimento).

### 2. Exibição no card da Fila CEO (`FilaCeoDispatchModal.tsx`)

- Para os leads da aba Reengajamento cujo `empreendimento` estiver vazio, buscar em `reengajamento_meta_disparos` o disparo mais recente com resposta positiva daquele lead (por `lead_id` e, como fallback, pelos últimos 10 dígitos do telefone).
- Resolver o `template_name` → empreendimento com o helper acima.
- Exibir no badge o empreendimento resolvido (ex.: **Lake Baikal**) em vez de `—`, deixando claro que veio do disparo de reengajamento.
- A busca é feita em lote para os leads de reengajamento visíveis (sem impacto perceptível de performance).

### 3. Preencher na origem (`whatsapp-webhook`)

Nos caminhos que reativam/criam o lead a partir de uma resposta a disparo (incluindo o caminho "remetente novo"), quando houver um disparo correlacionado pelo `wamid`/telefone, gravar o `empreendimento` resolvido pelo template no `pipeline_leads`. Assim, novos leads de reengajamento já nascem com o empreendimento correto, sem depender da correção de exibição.

## Detalhes técnicos

- Novo arquivo utilitário (ex.: `src/lib/reengajamentoEmpreendimento.ts`) com a função de mapeamento template → empreendimento, reutilizável no frontend.
- `FilaCeoDispatchModal.tsx`: adicionar consulta a `reengajamento_meta_disparos` (a policy de SELECT é restrita a admin/gestor — compatível com quem acessa a Fila CEO) e aplicar o rótulo no render dos cards de reengajamento.
- `supabase/functions/whatsapp-webhook/index.ts`: no bloco de reativação por disparo e no fallback "remetente novo", setar `empreendimento` a partir do template quando disponível.
- Sem migration de schema. Opcionalmente, um backfill pontual (via inserção controlada) poderia preencher o empreendimento dos leads de reengajamento atuais que têm disparo correlacionado — confirmo com você antes de rodar, pois altera dados existentes.

## Resultado esperado

O card do lead na Fila CEO passa a mostrar, por exemplo, "**Lake Baikal** · Reengajamento (Nutrição)", tornando claro de qual campanha/empreendimento o lead veio.
